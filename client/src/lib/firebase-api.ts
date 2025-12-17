import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";
import { Contact, Group, MessageLog, User } from "./types";

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
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      // For now, using mock auth - you can implement Firebase Auth later
      return { id: '1', email, name: 'Demo User' };
    },
    signup: async (email: string, password: string, name: string): Promise<User> => {
      return { id: '1', email, name };
    },
    getCurrentUser: async (): Promise<User | null> => {
      return { id: '1', email: 'user@example.com', name: 'Demo User' };
    }
  },

  contacts: {
    list: async (): Promise<Contact[]> => {
      const contactsRef = collection(db, CONTACTS_COLLECTION);
      const q = query(contactsRef, orderBy("name"));
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
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const q = query(groupsRef, orderBy("name"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToGroup);
    },

    get: async (id: string): Promise<Group | undefined> => {
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);
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
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);
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
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);
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
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);
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
      const logsRef = collection(db, LOGS_COLLECTION);
      const q = query(logsRef, orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToMessageLog);
    }
  },

  ai: {
    generateMessage: async (groupId: string): Promise<string> => {
      // Simulate AI processing - you can integrate with OpenAI or other services later
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);
      const groupDoc = snapshot.docs.find(doc => doc.id === groupId);
      
      if (!groupDoc) throw new Error('Group not found');
      
      const group = docToGroup(groupDoc);
      
      const prompts = [
        `Hey everyone in ${group.name}, just checking in! ${group.backgroundInfo}`,
        `Update for ${group.name}: ${group.backgroundInfo}. Let me know if you have questions.`,
        `Greetings ${group.name} members! meaningful update based on: ${group.backgroundInfo}`,
      ];
      return prompts[Math.floor(Math.random() * prompts.length)];
    }
  },

  messaging: {
    send: async (groupId: string, content: string, channels: ('sms' | 'email')[]): Promise<void> => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const userId = getCurrentUserId();
      const groupsRef = collection(db, GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);
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
