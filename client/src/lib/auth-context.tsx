import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from './types';
import { api } from './mock-api';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

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
    // Check session
    api.auth.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const user = await api.auth.login(email, pass);
      setUser(user);
      setLocation('/');
      toast({ title: "Welcome back!", description: `Logged in as ${user.name}` });
    } catch (e) {
      toast({ title: "Login failed", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  };

  const signup = async (email: string, pass: string, name: string) => {
    try {
      const user = await api.auth.signup(email, pass, name);
      setUser(user);
      setLocation('/');
      toast({ title: "Account created", description: "Welcome to Contact App!" });
    } catch (e) {
      toast({ title: "Signup failed", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  };

  const logout = () => {
    setUser(null);
    setLocation('/auth');
    toast({ title: "Logged out" });
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
