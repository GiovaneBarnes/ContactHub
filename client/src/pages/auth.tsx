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
import { Loader2, Users, MessageSquare, Clock } from "lucide-react";
import { validateEmail, sanitizeInput, rateLimiter, SECURITY_CONFIG } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";

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
  const [location] = useLocation();
  
  // Get mode from query parameters
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const defaultTab = urlParams.get('mode') === 'signup' ? 'signup' : 'login';

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10 flex items-center justify-center p-4 relative">

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-primary/2 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-chart-2/10 to-chart-2/5 dark:from-chart-2/5 dark:to-chart-2/2 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Features */}
        <div className="hidden md:block space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ContactHub
              </h1>
              <p className="text-xl text-gray-600">
                Smart contact management, automated messaging
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/60 backdrop-blur-sm border border-border/20 shadow-sm dark:bg-card/60 dark:border-border/10">
                <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/5">
                  <Users className="h-5 w-5 text-primary dark:text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground dark:text-card-foreground">Organize Contacts</h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">Create groups, manage contacts, and keep everything organized</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/60 backdrop-blur-sm border border-border/20 shadow-sm dark:bg-card/60 dark:border-border/10">
                <div className="p-2 rounded-lg bg-chart-1/10 dark:bg-chart-1/5">
                  <MessageSquare className="h-5 w-5 text-chart-1 dark:text-chart-1" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground dark:text-card-foreground">Automated Messaging</h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">Schedule messages, send to groups, and automate your communication</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/60 backdrop-blur-sm border border-border/20 shadow-sm dark:bg-card/60 dark:border-border/10">
                <div className="p-2 rounded-lg bg-chart-2/10 dark:bg-chart-2/5">
                  <Clock className="h-5 w-5 text-chart-2 dark:text-chart-2" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground dark:text-card-foreground">Smart Scheduling</h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">Set up recurring messages and never miss important communications</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-chart-1/10 border border-primary/20 dark:from-primary/5 dark:to-chart-1/5 dark:border-primary/10">
              <p className="text-sm text-card-foreground dark:text-card-foreground">
                <span className="font-semibold">✨ Free to start:</span> No credit card required. Upgrade anytime for advanced features.
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <div className="w-full max-w-md mx-auto">
          <Card className="shadow-2xl border-0 bg-card/80 backdrop-blur-sm dark:bg-card/80 dark:backdrop-blur-sm">
            <CardHeader className="text-center space-y-2 pb-2">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-2xl font-display font-bold text-card-foreground dark:text-card-foreground">
                {defaultTab === 'signup' ? 'Join ContactHub' : 'Welcome Back'}
              </CardTitle>
              <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                {defaultTab === 'signup'
                  ? 'Create your account and start managing contacts smarter'
                  : 'Sign in to your account to continue'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted dark:bg-muted">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm dark:data-[state=active]:bg-background dark:data-[state=active]:text-card-foreground"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm dark:data-[state=active]:bg-background dark:data-[state=active]:text-card-foreground"
                  >
                    Sign Up
                  </TabsTrigger>
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
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={isLoading}
                  >
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
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={isLoading}
                  >
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
      </div>
    </div>
  );
}
