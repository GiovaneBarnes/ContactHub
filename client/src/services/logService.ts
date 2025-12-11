import { MessageLog } from "@/lib/types";
import { api } from "@/lib/mock-api";

export const logService = {
  getAll: async (userId: string): Promise<MessageLog[]> => {
    return api.logs.list();
  },

  // Mock function to send message (which creates a log)
  sendMessage: async (groupId: string, content: string, channels: string[]) => {
    // In real app, this calls a Cloud Function
    return api.messaging.send(groupId, content, channels as any);
  }
};
