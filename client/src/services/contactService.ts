import { Contact } from "@/lib/types";
import { api } from "@/lib/mock-api";

// Simulate Firestore Contacts Collection interactions
export const contactService = {
  getAll: async (userId: string): Promise<Contact[]> => {
    // In real firebase: db.collection('contacts').where('userId', '==', userId).get()
    return api.contacts.list();
  },

  create: async (contact: Omit<Contact, 'id'>, userId: string): Promise<Contact> => {
    // In real firebase: db.collection('contacts').add({ ...contact, userId, createdAt: serverTimestamp() })
    return api.contacts.create(contact);
  },

  update: async (id: string, data: Partial<Contact>): Promise<Contact> => {
    return api.contacts.update(id, data);
  },

  delete: async (id: string): Promise<void> => {
    return api.contacts.delete(id);
  }
};
