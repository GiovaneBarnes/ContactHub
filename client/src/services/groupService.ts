import { Group } from "@/lib/types";
import { api } from "@/lib/mock-api";

// Simulate Firestore Groups interactions
export const groupService = {
  getAll: async (userId: string): Promise<Group[]> => {
    return api.groups.list();
  },

  getById: async (id: string): Promise<Group | undefined> => {
    return api.groups.get(id);
  },

  create: async (group: Omit<Group, 'id'>, userId: string): Promise<Group> => {
    return api.groups.create(group);
  },

  update: async (id: string, data: Partial<Group>): Promise<Group> => {
    return api.groups.update(id, data);
  },

  delete: async (id: string): Promise<void> => {
    return api.groups.delete(id);
  },

  // Mock Cloud Function call
  generateAiMessage: async (groupId: string): Promise<string> => {
    return api.ai.generateMessage(groupId);
  }
};
