import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { db } from "./firebase";
import { Contact, Group, MessageLog, User } from "./types";
import ContactHubAI from './contact-hub-ai';
import { metricsService } from './metrics';

// Collections
const CONTACTS_COLLECTION = "contacts";
const GROUPS_COLLECTION = "groups";
const LOGS_COLLECTION = "messageLogs";

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

// Helper to convert Firestore doc to Contact
const docToContact = (doc: any): Contact => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    notes: data.notes || ""
  };
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
    enabled: data.enabled !== false // Default to true if not specified
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
      const q = query(contactsRef, where("userId", "==", userId), orderBy("name"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToContact);
    },

    create: async (data: Omit<Contact, 'id'>): Promise<Contact> => {
      const userId = getCurrentUserId();
      const contactsRef = collection(db, CONTACTS_COLLECTION);
      const cleanedData = cleanFirestoreData(data);
      const docRef = await addDoc(contactsRef, {
        ...cleanedData,
        userId,
        createdAt: serverTimestamp()
      });
      const contact = {
        id: docRef.id,
        ...data
      };
      await metricsService.trackContactAction('create', {
        contactId: contact.id,
        hasEmail: !!data.email,
        hasPhone: !!data.phone
      });
      return contact;
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
      const docRef = doc(db, CONTACTS_COLLECTION, id);
      await deleteDoc(docRef);
      await metricsService.trackContactAction('delete', { contactId: id });
    }
  },

  groups: {
    list: async (): Promise<Group[]> => {
      const userId = getCurrentUserIdSafe();
      if (!userId) return []; // Return empty array if not authenticated
      
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, where("userId", "==", userId), orderBy("name"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToGroup);
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

    update: async (id: string, data: Partial<Group>): Promise<Group> => {
      const docRef = doc(db, GROUPS_COLLECTION, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { id, ...data } as Group;
    },

    delete: async (id: string): Promise<void> => {
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
        lastContactDate
      );
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

      if (!contact) throw new Error('Contact not found');

      const contactData = docToContact(contact);
      return await ContactHubAI.categorizeContact(
        contactData.name,
        contactData.email,
        contactData.phone,
        contactData.notes,
        contactData.tags
      );
    },

    analyzeCommunicationPatterns: async (contactId: string): Promise<{
      frequency: string;
      preferredMethod: string;
      nextContactSuggestion: string;
      insights: string[];
    }> => {
      const userId = getCurrentUserId();

      // Get contact details
      const contactDoc = await getDocs(query(
        collection(db, CONTACTS_COLLECTION),
        where("userId", "==", userId)
      ));
      const contact = contactDoc.docs.find(doc => doc.id === contactId);

      if (!contact) throw new Error('Contact not found');

      const contactData = docToContact(contact);

      // Get communication history
      const logsRef = collection(db, LOGS_COLLECTION);
      const logsQuery = query(
        logsRef,
        where("userId", "==", userId),
        where("contactId", "==", contactId),
        orderBy("timestamp", "desc")
      );
      const logsSnapshot = await getDocs(logsQuery);
      const messageLogs = logsSnapshot.docs.map(docToMessageLog);

      return await ContactHubAI.analyzeCommunicationPatterns(
        contactData.name,
        messageLogs,
        contactData.lastContact || 'Unknown',
        contactData.relationship || 'professional'
      );
    },

    suggestContactTime: async (contactId: string): Promise<{
      recommendedTime: string;
      reasoning: string;
      alternatives: string[];
    }> => {
      const userId = getCurrentUserId();
      const contactDoc = await getDocs(query(
        collection(db, CONTACTS_COLLECTION),
        where("userId", "==", userId)
      ));
      const contact = contactDoc.docs.find(doc => doc.id === contactId);

      if (!contact) throw new Error('Contact not found');

      const contactData = docToContact(contact);

      // Get communication patterns from logs
      const logsRef = collection(db, LOGS_COLLECTION);
      const logsQuery = query(
        logsRef,
        where("userId", "==", userId),
        where("contactId", "==", contactId),
        orderBy("timestamp", "desc")
      );
      const logsSnapshot = await getDocs(logsQuery);
      const responsePatterns = logsSnapshot.docs.slice(0, 10).map(doc => {
        const data = doc.data();
        return data.timestamp.toDate().toISOString();
      });

      return await ContactHubAI.suggestContactTime(
        contactData.name,
        contactData.timezone || 'UTC',
        contactData.preferredContactTimes,
        contactData.communicationStyle || 'professional',
        contactData.lastContact,
        responsePatterns
      );
    },

    generateContactSummary: async (contactId: string): Promise<string> => {
      const userId = getCurrentUserId();

      // Get contact details
      const contactDoc = await getDocs(query(
        collection(db, CONTACTS_COLLECTION),
        where("userId", "==", userId)
      ));
      const contact = contactDoc.docs.find(doc => doc.id === contactId);

      if (!contact) throw new Error('Contact not found');

      const contactData = docToContact(contact);

      // Get recent interactions
      const logsRef = collection(db, LOGS_COLLECTION);
      const logsQuery = query(
        logsRef,
        where("userId", "==", userId),
        where("contactId", "==", contactId),
        orderBy("timestamp", "desc")
      );
      const logsSnapshot = await getDocs(logsQuery);
      const interactions = logsSnapshot.docs.slice(0, 10).map(doc => ({
        date: doc.data().timestamp.toDate().toISOString(),
        type: doc.data().type,
        content: doc.data().content
      }));

      return await ContactHubAI.generateContactSummary(contactData, interactions);
    }
  },

  messaging: {
    send: async (groupId: string, content: string, channels: ('sms' | 'email')[]): Promise<void> => {
      // Debug logging removed for production

      try {
        // Validate input
        if (!content || content.trim().length === 0) {
          console.error('❌ Validation failed: Empty message content');
          throw new Error('Message content cannot be empty');
        }
        if (!channels || channels.length === 0) {
          console.error('❌ Validation failed: No channels specified');
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
          console.error('❌ No authenticated user found');
          throw new Error('User not authenticated');
        }

        const groupsRef = collection(db, GROUPS_COLLECTION);
        const q = query(groupsRef, where("userId", "==", userId));
        const snapshot = await getDocs(q);

        const groupDoc = snapshot.docs.find(doc => doc.id === groupId);

        if (!groupDoc) {
          console.error('❌ Group not found:', groupId);
          throw new Error('Group not found');
        }

        const group = docToGroup(groupDoc);

        // Validate group has contacts
        if (!group.contactIds || group.contactIds.length === 0) {
          console.error('❌ Group has no members');
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
          console.error('❌ No valid contacts found in group after filtering');
          throw new Error('Cannot send message: no valid contacts found in group');
        }

        // Check if any contacts have valid delivery methods
        const hasValidEmailContacts = groupContacts.some(contact => contact.email && contact.email.trim().length > 0);
        const hasValidSmsContacts = groupContacts.some(contact => contact.phone && contact.phone.trim().length > 0);

        const requestingEmail = channels.includes('email');
        const requestingSms = channels.includes('sms');

        if (requestingEmail && !hasValidEmailContacts) {
          console.error('❌ Email validation failed: no valid email contacts in group');
          throw new Error('Cannot send email: no group members have valid email addresses');
        }
        if (requestingSms && !hasValidSmsContacts) {
          console.error('❌ SMS validation failed: no valid SMS contacts in group');
          throw new Error('Cannot send SMS: no group members have valid phone numbers');
        }

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
            if (requestingEmail && contact.email) {
              try {
                const response = await fetch('https://us-central1-contacthub-29950.cloudfunctions.net/sendEmail', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({
                    to: contact.email,
                    subject: `Message from ${group.name}`,
                    text: content,
                    fromName: group.name
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
                console.error(`❌ Failed to send email to ${contact.name}:`, error);
                recipientDetail.emailStatus = 'failed';
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                recipientDetail.errorMessage = `Email failed: ${errorMessage}`;
                failureCount++;
              }
            }

            // Send SMS if requested and contact has phone
            if (requestingSms && contact.phone) {
              try {
                const response = await fetch('https://us-central1-contacthub-29950.cloudfunctions.net/sendSMS', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({
                    to: contact.phone,
                    message: content
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
                console.error(`❌ Failed to send SMS to ${contact.name}:`, error);
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
          console.error('💥 Unexpected error in sending loop:', loopError);
          throw loopError;
        }

        // Determine delivery method
        let deliveryMethod: 'sms' | 'email' | 'both' = 'sms';
        if (channels.includes('email') && channels.includes('sms')) {
          deliveryMethod = 'both';
        } else if (channels.includes('email')) {
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

        await metricsService.trackMessageAction('send', {
          groupId,
          groupName: group.name,
          recipientCount: recipientDetails.length,
          channels,
          messageLength: content.length,
          isGroupMessage: true
        });

      } catch (error) {
        console.error('💥 Message send failed with error:', error);
        throw error;
      }
    }
  }
};
