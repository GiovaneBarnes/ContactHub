import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { Contact, Group, MessageLog, User } from "./types";
import ContactHubAI from './contact-hub-ai';
import { metricsService } from './metrics';

// Collections
const CONTACTS_COLLECTION = "contacts";
const GROUPS_COLLECTION = "groups";
const LOGS_COLLECTION = "messageLogs";

// Performance: Query limits to prevent massive data fetches
const DEFAULT_PAGE_SIZE = 100;
const MAX_BATCH_SIZE = 500;

// Helper to get current user ID
const getCurrentUserId = (): string => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user.uid;
};

// Helper to get current user ID safely (returns null if not authenticated)
const getCurrentUserIdSafe = (): string | null => {
  const auth = getAuth();
  const user = auth.currentUser;
  return user ? user.uid : null;
};

// Helper to clean data for Firestore (remove undefined values)
const cleanFirestoreData = (data: any): any => {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

// Helper to format phone number to E.164 format for Twilio
const formatPhoneForTwilio = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it already starts with country code (11 digits for US), use as is
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it's 10 digits (US number without country code), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it already has +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Default: assume US number and add +1
  return `+1${digits}`;
};

// Helper to convert Firestore doc to Contact
const docToContact = (doc: any): Contact => {
  const data = doc.data();
  const contact = {
    id: doc.id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    notes: data.notes || "",
    // AI-enhanced fields
    timezone: data.timezone,
    preferredContactTimes: data.preferredContactTimes,
    communicationStyle: data.communicationStyle,
    relationship: data.relationship,
    lastContact: data.lastContact,
    tags: data.tags,
    // AI-generated categorization
    aiCategories: data.aiCategories,
    aiTags: data.aiTags,
    aiCategorizedAt: data.aiCategorizedAt
  };
  return contact;
};

// Helper to convert Firestore doc to Group
const docToGroup = (doc: any): Group => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    description: data.description,
    contactIds: data.contactIds || [],
    schedules: data.schedules || [],
    backgroundInfo: data.backgroundInfo || "",
    enabled: data.enabled !== false, // Default to true if not specified
    isSystem: data.isSystem || false
  };
};

// Helper to convert Firestore doc to MessageLog
const docToMessageLog = (doc: any): MessageLog => {
  const data = doc.data();
  return {
    id: doc.id,
    groupId: data.groupId,
    groupName: data.groupName,
    messageContent: data.messageContent,
    recipients: data.recipients,
    timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : data.timestamp,
    status: data.status,
    deliveryMethod: data.deliveryMethod || 'sms',
    recipientDetails: data.recipientDetails || []
  };
};

export const firebaseApi = {
  // Auth functions are handled directly in auth-context.tsx using Firebase Auth
  // auth: {
  //   login: async (email: string, password: string): Promise<User> => { ... },
  //   signup: async (email: string, password: string, name: string): Promise<User> => { ... },
  //   getCurrentUser: async (): Promise<User | null> => { ... }
  // },

  contacts: {
    list: async (): Promise<Contact[]> => {
      const userId = getCurrentUserIdSafe();
      if (!userId) return []; // Return empty array if not authenticated
      
      const contactsRef = collection(db, CONTACTS_COLLECTION);
      // Load all contacts - Firebase persistence caches locally after first load
      // No artificial limit - let users see all their contacts
      const q = query(
        contactsRef, 
        where("userId", "==", userId), 
        orderBy("name")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToContact);
    },

    create: async (data: Omit<Contact, 'id'>): Promise<Contact> => {
      const userId = getCurrentUserId();
      console.log(`[FirebaseAPI] Creating contact: ${data.name} (user: ${userId})`);
      
      const contactsRef = collection(db, CONTACTS_COLLECTION);
      const cleanedData = cleanFirestoreData(data);
      
      console.log(`[FirebaseAPI] Cleaned data:`, cleanedData);
      
      try {
        const docRef = await addDoc(contactsRef, {
          ...cleanedData,
          userId,
          createdAt: serverTimestamp()
        });
        
        console.log(`[FirebaseAPI] Contact created with ID: ${docRef.id}`);
        
        const contact = {
          id: docRef.id,
          ...data
        };
        
        await metricsService.trackContactAction('create', {
          contactId: contact.id,
          hasEmail: !!data.email,
          hasPhone: !!data.phone
        });
        
        // Sync All Contacts group
        try {
          await firebaseApi.groups.syncAllContactsGroup();
        } catch (error) {
          console.error('Error syncing All Contacts group:', error);
        }
        
        return contact;
      } catch (error: any) {
        console.error(`[FirebaseAPI] Error creating contact:`, error);
        console.error(`[FirebaseAPI] Error code:`, error.code);
        console.error(`[FirebaseAPI] Error message:`, error.message);
        throw error;
      }
    },

    update: async (id: string, data: Partial<Contact>): Promise<Contact> => {
      const docRef = doc(db, CONTACTS_COLLECTION, id);
      const cleanedData = cleanFirestoreData(data);
      await updateDoc(docRef, {
        ...cleanedData,
        updatedAt: serverTimestamp()
      });
      const contact = { id, ...data } as Contact;
      await metricsService.trackContactAction('update', {
        contactId: id,
        fieldsUpdated: Object.keys(data)
      });
      return contact;
    },

    delete: async (id: string): Promise<void> => {
      const userId = getCurrentUserId();
      
      // First, remove contact from all groups
      try {
        const groupsSnapshot = await getDocs(
          query(collection(db, GROUPS_COLLECTION), where("userId", "==", userId))
        );
        
        const updatePromises = groupsSnapshot.docs
          .filter(groupDoc => {
            const group = groupDoc.data();
            return group.contactIds?.includes(id);
          })
          .map(async (groupDoc) => {
            const group = groupDoc.data();
            const updatedContactIds = group.contactIds.filter((contactId: string) => contactId !== id);
            return updateDoc(doc(db, GROUPS_COLLECTION, groupDoc.id), {
              contactIds: updatedContactIds,
              updatedAt: serverTimestamp()
            });
          });
        
        await Promise.all(updatePromises);
      } catch (error) {
        console.error('Error removing contact from groups:', error);
        // Continue with deletion even if group update fails
      }
      
      // Then delete the contact
      const docRef = doc(db, CONTACTS_COLLECTION, id);
      await deleteDoc(docRef);
      await metricsService.trackContactAction('delete', { contactId: id });
      
      // Sync All Contacts group
      try {
        await firebaseApi.groups.syncAllContactsGroup();
      } catch (error) {
        console.error('Error syncing All Contacts group:', error);
      }
    },

    // New AI-powered features
    categorizeContact: async (contactId: string): Promise<{
      categories: string[];
      tags: string[];
      reasoning: string;
    }> => {
      const userId = getCurrentUserId();
      
      const contactDoc = await getDocs(query(
        collection(db, CONTACTS_COLLECTION),
        where("userId", "==", userId)
      ));
      const contact = contactDoc.docs.find(doc => doc.id === contactId);

      if (!contact) {
        throw new Error('Contact not found');
      }

      const contactData = docToContact(contact);
      
      const result = await ContactHubAI.categorizeContact(
        contactData.name,
        contactData.email,
        contactData.phone,
        contactData.notes,
        contactData.tags,
        contactId
      );
      
      return result;
    }
  },

  groups: {
    // Ensure the "All Contacts" system group exists for a user
    ensureAllContactsGroup: async (): Promise<Group> => {
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      
      // Check if All Contacts group already exists
      const q = query(
        groupsRef, 
        where("userId", "==", userId),
        where("isSystem", "==", true)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.docs.length > 0) {
        return docToGroup(snapshot.docs[0]);
      }
      
      // Create the All Contacts group
      const allContactsGroup = {
        name: "All Contacts",
        description: "Automatically includes all your contacts. Perfect for holiday greetings and announcements.",
        contactIds: [],
        schedules: [],
        backgroundInfo: "This is a system group that automatically syncs with all your contacts. Use it to send messages to everyone at once, like holiday greetings or important announcements.",
        enabled: true,
        isSystem: true
      };
      
      const docRef = await addDoc(groupsRef, {
        ...allContactsGroup,
        userId,
        createdAt: serverTimestamp()
      });
      
      return {
        id: docRef.id,
        ...allContactsGroup
      };
    },

    // Sync All Contacts group with current contacts
    syncAllContactsGroup: async (): Promise<void> => {
      const userId = getCurrentUserId();
      
      // Get all contacts
      const contactsRef = collection(db, CONTACTS_COLLECTION);
      const contactsQuery = query(contactsRef, where("userId", "==", userId));
      const contactsSnapshot = await getDocs(contactsQuery);
      const allContactIds = contactsSnapshot.docs.map(doc => doc.id);
      
      // Find the All Contacts group
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const groupsQuery = query(
        groupsRef,
        where("userId", "==", userId),
        where("isSystem", "==", true)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      
      if (groupsSnapshot.docs.length > 0) {
        const allContactsGroupDoc = groupsSnapshot.docs[0];
        await updateDoc(doc(db, GROUPS_COLLECTION, allContactsGroupDoc.id), {
          contactIds: allContactIds,
          updatedAt: serverTimestamp()
        });
      }
    },

    list: async (): Promise<Group[]> => {
      const userId = getCurrentUserIdSafe();
      if (!userId) return []; // Return empty array if not authenticated
      
      // Only ensure/sync All Contacts group if it doesn't exist yet
      // This prevents writes on every read operation
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const checkSystemQuery = query(
        groupsRef,
        where("userId", "==", userId),
        where("isSystem", "==", true)
      );
      const systemGroupCheck = await getDocs(checkSystemQuery);
      
      // Only create if it doesn't exist
      if (systemGroupCheck.docs.length === 0) {
        try {
          await firebaseApi.groups.ensureAllContactsGroup();
          await firebaseApi.groups.syncAllContactsGroup();
        } catch (error) {
          console.error('Error ensuring All Contacts group:', error);
        }
      }
      
      const q = query(groupsRef, where("userId", "==", userId), orderBy("name"));
      const snapshot = await getDocs(q);
      const allGroups = snapshot.docs.map(docToGroup);
      
      // Sort to show system groups (All Contacts) first
      return allGroups.sort((a, b) => {
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return 0; // Keep alphabetical order within same type
      });
    },

    get: async (id: string): Promise<Group | undefined> => {
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const groupDoc = snapshot.docs.find(doc => doc.id === id);
      return groupDoc ? docToGroup(groupDoc) : undefined;
    },

    create: async (data: Omit<Group, 'id'>): Promise<Group> => {
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const docRef = await addDoc(groupsRef, {
        ...data,
        userId,
        createdAt: serverTimestamp()
      });
      return {
        id: docRef.id,
        ...data
      };
    },

    duplicate: async (id: string): Promise<Group> => {
      const userId = getCurrentUserId();
      const originalGroup = await firebaseApi.groups.get(id);
      
      if (!originalGroup) {
        throw new Error('Group not found');
      }
      
      // Create a copy with modified name and no system flag
      const duplicatedGroup = {
        name: `${originalGroup.name} (Copy)`,
        description: originalGroup.description,
        contactIds: [...originalGroup.contactIds], // Copy all contacts
        schedules: [], // Don't copy schedules for safety
        backgroundInfo: originalGroup.backgroundInfo,
        enabled: true,
        isSystem: false // Duplicates are never system groups
      };
      
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const docRef = await addDoc(groupsRef, {
        ...duplicatedGroup,
        userId,
        createdAt: serverTimestamp()
      });
      
      return {
        id: docRef.id,
        ...duplicatedGroup
      };
    },

    update: async (id: string, data: Partial<Group>): Promise<Group> => {
      const docRef = doc(db, GROUPS_COLLECTION, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { id, ...data } as Group;
    },

    delete: async (id: string): Promise<void> => {
      const userId = getCurrentUserId();
      
      // Check if this is a system group
      const groupDoc = await getDoc(doc(db, GROUPS_COLLECTION, id));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        if (groupData.isSystem) {
          throw new Error('Cannot delete system groups. You can disable them instead.');
        }
      }
      
      const docRef = doc(db, GROUPS_COLLECTION, id);
      await deleteDoc(docRef);
    },

    updateSchedule: async (groupId: string, scheduleId: string, updates: Partial<import('./types').Schedule>): Promise<Group> => {
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const groupDoc = snapshot.docs.find(doc => doc.id === groupId);
      
      if (!groupDoc) throw new Error('Group not found');
      
      const group = docToGroup(groupDoc);
      const updatedSchedules = group.schedules.map(s => 
        s.id === scheduleId ? { ...s, ...updates } : s
      );
      
      const docRef = doc(db, GROUPS_COLLECTION, groupId);
      await updateDoc(docRef, {
        schedules: updatedSchedules,
        updatedAt: serverTimestamp()
      });
      
      return { ...group, schedules: updatedSchedules };
    },

    deleteSchedule: async (groupId: string, scheduleId: string): Promise<Group> => {
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const groupDoc = snapshot.docs.find(doc => doc.id === groupId);
      
      if (!groupDoc) throw new Error('Group not found');
      
      const group = docToGroup(groupDoc);
      const updatedSchedules = group.schedules.filter(s => s.id !== scheduleId);
      
      const docRef = doc(db, GROUPS_COLLECTION, groupId);
      await updateDoc(docRef, {
        schedules: updatedSchedules,
        updatedAt: serverTimestamp()
      });
      
      return { ...group, schedules: updatedSchedules };
    },

    createSchedule: async (groupId: string, schedule: Omit<import('./types').Schedule, 'id'>): Promise<Group> => {
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const groupDoc = snapshot.docs.find(doc => doc.id === groupId);
      
      if (!groupDoc) throw new Error('Group not found');
      
      const group = docToGroup(groupDoc);
      const newSchedule = { 
        ...schedule, 
        id: Math.random().toString(36).substr(2, 9) 
      };
      
      const docRef = doc(db, GROUPS_COLLECTION, groupId);
      await updateDoc(docRef, {
        schedules: [...group.schedules, newSchedule],
        updatedAt: serverTimestamp()
      });
      
      return { ...group, schedules: [...group.schedules, newSchedule] };
    },

    // One-time cleanup to remove stale contact IDs from groups
    cleanupStaleMembers: async (): Promise<{
      success: boolean;
      totalGroups: number;
      groupsUpdated: number;
      staleContactsRemoved: number;
      validContactsInDB: number;
    }> => {
      const userId = getCurrentUserId();
      
      try {
        const cleanupFunction = httpsCallable(functions, 'cleanupStaleGroupMembers');
        const result = await cleanupFunction({});
        return result.data as any;
      } catch (error) {
        console.error('Error cleaning up stale group members:', error);
        throw error;
      }
    }
  },

  smartGroups: {
    suggestGroups: async (): Promise<{
      suggestedGroups: Array<{
        name: string;
        purpose: string;
        contacts: string[];
        contactIds: string[];
        contactCount: number;
        rationale: string;
      }>;
      insights: string;
    }> => {
      const userId = getCurrentUserId();
      
      try {
        const result = await httpsCallable(functions, 'suggestSmartGroups')({});
        return result.data as any;
      } catch (error) {
        throw error;
      }
    }
  },

  logs: {
    list: async (): Promise<MessageLog[]> => {
      const userId = getCurrentUserIdSafe();
      if (!userId) return []; // Return empty array if not authenticated
      
      const logsRef = collection(db, LOGS_COLLECTION);
      const q = query(logsRef, where("userId", "==", userId), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToMessageLog);
    }
  },

  ai: {
    generateMessage: async (groupId: string): Promise<string> => {
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const groupDoc = snapshot.docs.find(doc => doc.id === groupId);

      if (!groupDoc) throw new Error('Group not found');

      const group = docToGroup(groupDoc);

      // Get contact count for the group
      const contactCount = group.contactIds?.length || 0;

      // Get last contact date from message logs
      const logsRef = collection(db, LOGS_COLLECTION);
      const logsQuery = query(
        logsRef,
        where("userId", "==", userId),
        where("groupId", "==", groupId),
        orderBy("timestamp", "desc")
      );
      const logsSnapshot = await getDocs(logsQuery);
      const lastLog = logsSnapshot.docs[0];
      const lastContactDate = lastLog ? lastLog.data().timestamp.toDate().toISOString() : undefined;

      // Use AI to generate personalized message
      return await ContactHubAI.generatePersonalizedMessage(
        group.name,
        group.backgroundInfo || 'General group communication',
        contactCount,
        lastContactDate,
        groupId
      );
    }, // <-- Missing comma here

    analyzeCommunicationPatterns: async (contactId: string): Promise<{
      frequency: string;
      preferredMethod: string;
      nextContactSuggestion: string;
      insights: string[];
    }> => {
      const userId = getCurrentUserId();

      try {
        // Get contact details
        const contactDoc = await getDocs(query(
          collection(db, CONTACTS_COLLECTION),
          where("userId", "==", userId)
        ));
        const contact = contactDoc.docs.find(doc => doc.id === contactId);

        if (!contact) {
          throw new Error('Contact not found');
        }

        const contactData = docToContact(contact);

        // Get communication history
        const logsRef = collection(db, LOGS_COLLECTION);
        const logsQuery = query(
          logsRef,
          where("userId", "==", userId),
          orderBy("timestamp", "desc")
        );
        const logsSnapshot = await getDocs(logsQuery);
        
        // Filter logs that include this contact in recipientDetails
        const allLogs = logsSnapshot.docs.map(docToMessageLog);
        const messageLogs = allLogs.filter(log => 
          log.recipientDetails?.some(recipient => recipient.contactId === contactId)
        );

        const result = await ContactHubAI.analyzeCommunicationPatterns(
          contactId,
          contactData.name,
          messageLogs,
          contactData.lastContact || 'Unknown',
          contactData.relationship || 'professional'
        );
        return result;
      } catch (error) {
        throw error;
      }
    },

    suggestContactTime: async (contactId: string): Promise<{
      recommendedTime: string;
      reasoning: string;
      alternatives: string[];
    }> => {
      const userId = getCurrentUserId();

      try {
        // Get user's timezone
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userTimezone = userDoc.data()?.timezone;

        const contactDoc = await getDocs(query(
          collection(db, CONTACTS_COLLECTION),
          where("userId", "==", userId)
        ));
        const contact = contactDoc.docs.find(doc => doc.id === contactId);

        if (!contact) {
          throw new Error('Contact not found');
        }

        const contactData = docToContact(contact);

        // Get communication patterns from logs
        const logsRef = collection(db, LOGS_COLLECTION);
        const logsQuery = query(
          logsRef,
          where("userId", "==", userId),
          orderBy("timestamp", "desc")
        );
        const logsSnapshot = await getDocs(logsQuery);
        
        // Filter and extract timestamps for this contact
        const allLogs = logsSnapshot.docs.map(docToMessageLog);
        const contactLogs = allLogs.filter(log => 
          log.recipientDetails?.some(recipient => recipient.contactId === contactId)
        );
        const responsePatterns = contactLogs.slice(0, 10).map(log => log.timestamp);

        const result = await ContactHubAI.suggestContactTime(
          contactId,
          contactData.name,
          contactData.timezone || 'America/New_York',
          contactData.preferredContactTimes,
          contactData.communicationStyle || 'professional',
          contactData.lastContact,
          responsePatterns,
          userTimezone
        );
        return result;
      } catch (error) {
        throw error;
      }
    },

    generateContactSummary: async (contactId: string): Promise<string> => {
      const userId = getCurrentUserId();

      try {
        // Get contact details
        const contactDoc = await getDocs(query(
          collection(db, CONTACTS_COLLECTION),
          where("userId", "==", userId)
        ));
        const contact = contactDoc.docs.find(doc => doc.id === contactId);

        if (!contact) {
          throw new Error('Contact not found');
        }

        const contactData = docToContact(contact);

        // Get recent interactions
        const logsRef = collection(db, LOGS_COLLECTION);
        const logsQuery = query(
          logsRef,
          where("userId", "==", userId),
          orderBy("timestamp", "desc")
        );
        const logsSnapshot = await getDocs(logsQuery);
        
        // Filter logs for this contact and extract interactions
        const allLogs = logsSnapshot.docs.map(docToMessageLog);
        const contactLogs = allLogs.filter(log => 
          log.recipientDetails?.some(recipient => recipient.contactId === contactId)
        );
        const interactions = contactLogs.slice(0, 10).map(log => ({
          date: log.timestamp,
          type: log.deliveryMethod,
          content: `Message sent to ${log.groupName || 'group'} - ${log.status}`
        }));

        const result = await ContactHubAI.generateContactSummary(contactData, interactions);
        return result;
      } catch (error) {
        throw error;
      }
    }
  },

  messaging: {
    send: async (groupId: string, content: string, channels: ('sms' | 'email')[]): Promise<void> => {
      // Debug logging removed for production

      try {
        // Validate input
        if (!content || content.trim().length === 0) {
          throw new Error('Message content cannot be empty');
        }
        if (!channels || channels.length === 0) {
          throw new Error('At least one delivery channel must be selected');
        }

        // Input validation passed

        // Simulate realistic processing time (2-5 seconds for actual sending)
        // Skip delay in test environment
        if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
        }

        // Get current user
        const userId = getCurrentUserId();

        if (!userId) {
          throw new Error('User not authenticated');
        }

        const groupsRef = collection(db, GROUPS_COLLECTION);
        const q = query(groupsRef, where("userId", "==", userId));
        const snapshot = await getDocs(q);

        const groupDoc = snapshot.docs.find(doc => doc.id === groupId);

        if (!groupDoc) {
          throw new Error('Group not found');
        }

        const group = docToGroup(groupDoc);

        // Validate group has contacts
        if (!group.contactIds || group.contactIds.length === 0) {
          throw new Error('Cannot send message: group has no members');
        }

        // Get actual contacts for the group
        const contactsRef = collection(db, CONTACTS_COLLECTION);
        const contactsQuery = query(contactsRef, where("userId", "==", userId));
        const contactsSnapshot = await getDocs(contactsQuery);
        const allContacts = contactsSnapshot.docs.map(docToContact);

        // Filter contacts that are in this group
        const groupContacts = allContacts.filter(contact => group.contactIds.includes(contact.id));

        if (groupContacts.length === 0) {
          throw new Error('Cannot send message: no valid contacts found in group');
        }

        // Check if any contacts have valid delivery methods for the requested channels
        const hasValidEmailContacts = groupContacts.some(contact => contact.email && contact.email.trim().length > 0);
        const hasValidSmsContacts = groupContacts.some(contact => contact.phone && contact.phone.trim().length > 0);

        const requestingEmail = channels.includes('email');
        const requestingSms = channels.includes('sms');

        // Smart validation: fail only if we can't reach anyone through ANY requested channel
        const canReachViaEmail = requestingEmail && hasValidEmailContacts;
        const canReachViaSms = requestingSms && hasValidSmsContacts;
        
        if (!canReachViaEmail && !canReachViaSms) {
          // Build helpful error message
          if (requestingEmail && requestingSms) {
            throw new Error('Cannot send message: no group members have valid email addresses or phone numbers');
          } else if (requestingEmail) {
            throw new Error('Cannot send email: no group members have valid email addresses. Try SMS instead?');
          } else {
            throw new Error('Cannot send SMS: no group members have valid phone numbers. Try email instead?');
          }
        }

        // Success case: we can reach at least some people through at least one channel
        // Filter channels to only use those that can actually reach someone
        const effectiveChannels = channels.filter(channel => {
          if (channel === 'email') return hasValidEmailContacts;
          if (channel === 'sms') return hasValidSmsContacts;
          return false;
        });

        // All validations passed, proceeding with message delivery

        // Get the current user's ID token
        const user = getAuth().currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }
        const idToken = await user.getIdToken();

        const recipientDetails = [];
        let successCount = 0;
        let failureCount = 0;

        try {

          for (const contact of groupContacts) {

            const recipientDetail = {
              contactId: contact.id,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              smsStatus: 'not_sent' as 'sent' | 'failed' | 'not_sent',
              emailStatus: 'not_sent' as 'sent' | 'failed' | 'not_sent',
              errorMessage: undefined as string | undefined
            };

            // Send email if requested and contact has email
            if (effectiveChannels.includes('email') && contact.email) {
              try {
                const auth = getAuth();
                const response = await fetch('https://us-central1-contacthub-29950.cloudfunctions.net/sendEmail', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({
                    to: contact.email,
                    subject: `Message for ${contact.name}`,
                    text: content,
                    fromName: auth.currentUser?.displayName || auth.currentUser?.email || 'ContactHub'
                  }),
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const result = await response.json();
                recipientDetail.emailStatus = 'sent';
                successCount++;
              } catch (error) {
                recipientDetail.emailStatus = 'failed';
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                recipientDetail.errorMessage = `Email failed: ${errorMessage}`;
                failureCount++;
              }
            }

            // Send SMS if requested and contact has phone
            if (effectiveChannels.includes('sms') && contact.phone) {
              try {
                const auth = getAuth();
                const formattedPhone = formatPhoneForTwilio(contact.phone);
                const response = await fetch('https://us-central1-contacthub-29950.cloudfunctions.net/sendSMS', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({
                    to: formattedPhone,
                    message: content,
                    senderName: auth.currentUser?.displayName || auth.currentUser?.email || 'ContactHub'
                  }),
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const result = await response.json();
                recipientDetail.smsStatus = 'sent';
                successCount++;
              } catch (error) {
                recipientDetail.smsStatus = 'failed';
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (recipientDetail.errorMessage) {
                  recipientDetail.errorMessage += `; SMS failed: ${errorMessage}`;
                } else {
                  recipientDetail.errorMessage = `SMS failed: ${errorMessage}`;
                }
                failureCount++;
              }
            }

            recipientDetails.push(recipientDetail);
          }
        } catch (loopError) {
          throw loopError;
        }

        // Determine delivery method based on what was actually used
        let deliveryMethod: 'sms' | 'email' | 'both' = 'sms';
        if (effectiveChannels.includes('email') && effectiveChannels.includes('sms')) {
          deliveryMethod = 'both';
        } else if (effectiveChannels.includes('email')) {
          deliveryMethod = 'email';
        }

        const logsRef = collection(db, LOGS_COLLECTION);

        // Clean recipient details to remove undefined values (Firestore doesn't allow them)
        const cleanedRecipientDetails = recipientDetails.map(recipient =>
          cleanFirestoreData(recipient)
        );

        await addDoc(logsRef, cleanFirestoreData({
          groupId: group.id,
          groupName: group.name,
          messageContent: content,
          recipients: recipientDetails.length,
          deliveryMethod,
          recipientDetails: cleanedRecipientDetails,
          userId,
          timestamp: serverTimestamp(),
          status: successCount > 0 ? 'sent' : 'failed'
        }));

        // Update lastContact field for each contact that was successfully messaged
        const currentTimestamp = new Date().toISOString();
        for (const recipient of cleanedRecipientDetails) {
          if (recipient.smsStatus === 'sent' || recipient.emailStatus === 'sent') {
            try {
              const contactDocRef = doc(db, CONTACTS_COLLECTION, recipient.contactId);
              await updateDoc(contactDocRef, {
                lastContact: currentTimestamp,
                updatedAt: serverTimestamp()
              });
            } catch (error) {
            }
          }
        }

        await metricsService.trackMessageAction('send', {
          groupId,
          groupName: group.name,
          recipientCount: recipientDetails.length,
          channels,
          messageLength: content.length,
          isGroupMessage: true
        });

      } catch (error) {
        throw error;
      }
    }
  }
};
