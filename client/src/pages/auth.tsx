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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, MessageSquare, Clock, ArrowLeft, Info } from "lucide-react";
import { validateEmail, sanitizeInput, rateLimiter, SECURITY_CONFIG } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { Check, X } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { useEffect } from "react";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .refine((password) => {
    const requirements = [];
    if (!/[a-z]/.test(password)) requirements.push("lowercase letter");
    if (!/[A-Z]/.test(password)) requirements.push("uppercase letter");
    if (!/\d/.test(password)) requirements.push("number");
    
    if (requirements.length > 0) {
      return {
        message: `Password must contain at least one ${requirements.join(", ")}`,
        path: ["password"]
      };
    }
    return true;
  });

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
});

export default function AuthPage() {
  const { login, signup } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [location] = useLocation();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  
  // Get mode from query parameters
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const defaultTab = urlParams.get('mode') === 'signup' ? 'signup' : 'login';

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
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

  async function handlePasswordReset() {
    if (!resetEmail || !validateEmail(resetEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      
      const actionCodeSettings = {
        url: 'https://contact-hub.net/',
        handleCodeInApp: false,
      };
      
      await sendPasswordResetEmail(auth, resetEmail, actionCodeSettings);
      
      toast({
        title: "Reset email sent!",
        description: "Check your email for password reset instructions",
      });
      
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      let errorMessage = "Failed to send reset email";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email address";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many requests. Please try again later";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10 flex items-center justify-center p-4 relative">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.location.href = '/'}
        className="absolute top-4 left-4 gap-2 z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

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
              {/* SMS Temporary Notice */}
              {!isFeatureEnabled('SMS_ENABLED') && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-3 mb-6">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-semibold text-xs text-blue-900 dark:text-blue-100">
                        SMS Temporarily Unavailable
                      </h4>
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Our SMS service is completing carrier verification (expected Dec 23-26). 
                        <strong> Messages will be sent via email only</strong> until verification completes.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
              {showForgotPassword ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">Reset Your Password</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your email and we'll send you a link to reset your password
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="your@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        disabled={isResetting}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetEmail("");
                        }}
                        disabled={isResetting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                        onClick={handlePasswordReset}
                        disabled={isResetting}
                      >
                        {isResetting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                        ) : (
                          "Send Reset Link"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-muted-foreground hover:text-primary"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot your password?
                    </Button>
                  </div>
                </form>
              </Form>
              )}
            </TabsContent>

            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="name"
                    render={({ field }) => {
                      const nameValue = signupForm.watch("name");
                      const isValidLength = nameValue.length >= 2;
                      
                      return (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                          {nameValue && (
                            <div className="mt-1 flex items-center gap-2 text-sm">
                              {isValidLength ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-red-500" />
                              )}
                              <span className={isValidLength ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                At least 2 characters
                              </span>
                            </div>
                          )}
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => {
                      const emailValue = signupForm.watch("email");
                      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
                      
                      return (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                          {emailValue && (
                            <div className="mt-1 flex items-center gap-2 text-sm">
                              {isValidEmail ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-red-500" />
                              )}
                              <span className={isValidEmail ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                Valid email format
                              </span>
                            </div>
                          )}
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => {
                      const passwordValue = signupForm.watch("password");
                      
                      const requirements = [
                        { label: "At least 8 characters", met: passwordValue.length >= 8 },
                        { label: "One lowercase letter", met: /[a-z]/.test(passwordValue) },
                        { label: "One uppercase letter", met: /[A-Z]/.test(passwordValue) },
                        { label: "One number", met: /\d/.test(passwordValue) },
                      ];

                      return (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                          {passwordValue && (
                            <div className="mt-2 space-y-1">
                              {requirements.map((req, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  {req.met ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <X className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className={req.met ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                    {req.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </FormItem>
                      );
                    }}
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
          
          <div className="mt-6 space-y-3">
            <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-xs text-center text-muted-foreground">
                🔒 Your data is encrypted and secure. We use AI to enhance your experience.{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary font-medium">
                  Learn more
                </a>
              </p>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              By using ContactHub, you agree to our{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                Privacy Policy
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}
