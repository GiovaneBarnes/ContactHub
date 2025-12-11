import { User } from "@/lib/types";
import { api } from "@/lib/mock-api";

// Simulate Firebase Auth Service
export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    return api.auth.login(email, password);
  },
  
  signup: async (email: string, password: string, name: string): Promise<User> => {
    return api.auth.signup(email, password, name);
  },

  logout: async (): Promise<void> => {
    // Firebase signOut logic
    return Promise.resolve();
  },

  onAuthStateChanged: (callback: (user: User | null) => void) => {
    // Mock observer
    api.auth.getCurrentUser().then(callback);
    return () => {}; // unsubscribe
  }
};
