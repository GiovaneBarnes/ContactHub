import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from './types';
import { firebaseApi } from './firebase-api';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { metricsService } from './metrics';
import { getUserTimezone } from './timezone-utils';

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Load user profile from Firestore to get timezone
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userDoc.data();
        
        const userTimezone = userData?.timezone || getUserTimezone();
        
        // If timezone not stored, store it now
        if (!userData?.timezone) {
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            timezone: userTimezone,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email,
          }, { merge: true });
        }
        
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email || '',
          timezone: userTimezone,
          preferences: userData?.preferences,
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
      
      // Store user profile with timezone in Firestore
      const userTimezone = getUserTimezone();
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        name,
        timezone: userTimezone,
        createdAt: new Date().toISOString(),
      });
      
      // Wait a moment for auth state to propagate before redirecting
      await new Promise(resolve => setTimeout(resolve, 100));
      setLocation('/');
      toast({ title: "Account created", description: "Welcome to ContactHub!" });
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
