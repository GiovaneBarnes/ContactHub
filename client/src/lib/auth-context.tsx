import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from './types';
import { firebaseApi } from './firebase-api';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth';
import { auth } from './firebase';
import { metricsService } from './metrics';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email || ''
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // Wait a moment for auth state to propagate before redirecting
      await new Promise(resolve => setTimeout(resolve, 100));
      setLocation('/');
      toast({ title: "Welcome back!", description: `Logged in as ${email}` });
      await metricsService.trackUserEngagement('login', { method: 'email' });
    } catch (e) {
      await metricsService.trackUserEngagement('login_failed', { error: (e as Error).message });
      toast({ title: "Login failed", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  };

  const signup = async (email: string, pass: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      // Update display name
      await updateProfile(userCredential.user, {
        displayName: name
      });
      // Wait a moment for auth state to propagate before redirecting
      await new Promise(resolve => setTimeout(resolve, 100));
      setLocation('/');
      toast({ title: "Account created", description: "Welcome to Contact App!" });
      await metricsService.trackUserEngagement('signup', { method: 'email' });
    } catch (e) {
      await metricsService.trackUserEngagement('signup_failed', { error: (e as Error).message });
      toast({ title: "Signup failed", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setLocation('/');
      toast({ title: "Logged out", description: "See you next time!" });
      await metricsService.trackUserEngagement('logout');
      metricsService.endSession();
    } catch (e) {
      toast({ title: "Logout failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return a default context to prevent crashes
    return {
      user: null,
      login: async () => {},
      signup: async () => {},
      logout: () => {},
      isLoading: true
    };
  }
  return context;
};
