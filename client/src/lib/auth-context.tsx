import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from './types';
import { firebaseApi } from './firebase-api';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

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
      setLocation('/');
      toast({ title: "Welcome back!", description: `Logged in as ${email}` });
    } catch (e) {
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
      setLocation('/');
      toast({ title: "Account created", description: "Welcome to Contact App!" });
    } catch (e) {
      toast({ title: "Signup failed", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setLocation('/auth');
      toast({ title: "Logged out", description: "See you next time!" });
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
    console.error('useAuth must be used within AuthProvider - context is undefined');
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
