import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { validateEmail, sanitizeInput, rateLimiter, SECURITY_CONFIG } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2),
});

export default function AuthPage() {
  const { login, signup } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "user@example.com", password: "password" },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  async function onLogin(values: z.infer<typeof loginSchema>) {
    // Rate limiting
    if (!rateLimiter.isAllowed(`login_${values.email}`, SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS, SECURITY_CONFIG.LOGIN_WINDOW_MS)) {
      toast({ title: "Too many attempts", description: "Please wait before trying again.", variant: "destructive" });
      return;
    }

    // Input validation and sanitization
    const sanitizedEmail = sanitizeInput(values.email);
    if (!validateEmail(sanitizedEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await login(sanitizedEmail, values.password);
      rateLimiter.reset(`login_${values.email}`); // Reset on successful login
    } catch {
      // Handled by context
    } finally {
      setIsLoading(false);
    }
  }

  async function onSignup(values: z.infer<typeof signupSchema>) {
    // Rate limiting
    if (!rateLimiter.isAllowed(`signup_${values.email}`, SECURITY_CONFIG.MAX_SIGNUP_ATTEMPTS, SECURITY_CONFIG.SIGNUP_WINDOW_MS)) {
      toast({ title: "Too many attempts", description: "Please wait before trying again.", variant: "destructive" });
      return;
    }

    // Input validation and sanitization
    const sanitizedEmail = sanitizeInput(values.email);
    const sanitizedName = sanitizeInput(values.name);

    if (!validateEmail(sanitizedEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    if (sanitizedName.length < 2) {
      toast({ title: "Invalid name", description: "Name must be at least 2 characters.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await signup(sanitizedEmail, values.password, sanitizedName);
      rateLimiter.reset(`signup_${values.email}`); // Reset on successful signup
    } catch {
      // Handled by context
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-display font-bold text-primary">ContactApp</CardTitle>
          <CardDescription>
            Manage your contacts and automate your messaging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Demo credentials: user@example.com / password
                  </p>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Account
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
