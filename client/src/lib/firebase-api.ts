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
import { db } from "./firebase";
import { Contact, Group, MessageLog, User } from "./types";
import ContactHubAI from './contact-hub-ai';

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
      const docRef = await addDoc(contactsRef, {
        ...data,
        userId,
        createdAt: serverTimestamp()
      });
      return {
        id: docRef.id,
        ...data
      };
    },

    update: async (id: string, data: Partial<Contact>): Promise<Contact> => {
      const docRef = doc(db, CONTACTS_COLLECTION, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { id, ...data } as Contact;
    },

    delete: async (id: string): Promise<void> => {
      const docRef = doc(db, CONTACTS_COLLECTION, id);
      await deleteDoc(docRef);
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const groupDoc = snapshot.docs.find(doc => doc.id === groupId);
      
      if (!groupDoc) throw new Error('Group not found');
      
      const group = docToGroup(groupDoc);
      
      const logsRef = collection(db, LOGS_COLLECTION);
      await addDoc(logsRef, {
        groupId: group.id,
        groupName: group.name,
        messageContent: content,
        recipients: group.contactIds.length,
        userId,
        timestamp: serverTimestamp(),
        status: 'sent'
      });
    }
  }
};
