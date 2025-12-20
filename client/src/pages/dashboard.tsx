import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Layers, MessageSquare, History, Plus, Send, Clock, LogIn, UserPlus, Sparkles, AlertTriangle, Upload, Brain, Zap, Shield, TrendingUp, Target, BarChart3, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { UpcomingSchedules } from "@/components/upcoming-schedules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { metricsService } from "@/lib/metrics";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default function Dashboard() {
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [sendImmediately, setSendImmediately] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  // Track page view
  useEffect(() => {
    metricsService.trackPageView('dashboard');
  }, []);

  // Check if user should see onboarding
  useEffect(() => {
    if (user && !authLoading) {
      const hasCompletedOnboarding = localStorage.getItem(
        `onboarding_completed_${user.id}`
      );
      
      // Show onboarding if not completed and user has no contacts
      if (!hasCompletedOnboarding) {
        // Small delay to let the dashboard render first
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }

  }, [user, authLoading]);

  const handleOnboardingComplete = () => {
    if (user) {
      localStorage.setItem(`onboarding_completed_${user.id}`, "true");
      setShowOnboarding(false);
      // Refresh queries to show new data
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast({
        title: "Welcome to ContactHub! 🎉",
        description: "You're all set up and ready to go.",
      });
    }
  };

  const { data: contacts, isLoading: contactsLoading, error: contactsError } = useQuery({ 
    queryKey: ['contacts'], 
    queryFn: async () => {
      const result = await firebaseApi.contacts.list();
      return result;
    },
    enabled: !!user, // Only fetch if user is authenticated
    retry: 1,
    retryDelay: 1000,
    staleTime: 30000
  });
  const { data: groups, isLoading: groupsLoading, error: groupsError } = useQuery({ 
    queryKey: ['groups'], 
    queryFn: async () => {
      const result = await firebaseApi.groups.list();
      return result;
    },
    enabled: !!user, // Only fetch if user is authenticated
    retry: 1,
    retryDelay: 1000,
    staleTime: 30000
  });
  const { data: logs, isLoading: logsLoading, error: logsError } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => {
      const result = await firebaseApi.logs.list();
      return result;
    },
    enabled: !!user, // Only fetch if user is authenticated
    retry: 1,
    retryDelay: 1000,
    staleTime: 30000
  });

  const safeContacts = contacts || [];
  const safeGroups = groups || [];
  const safeLogs = logs || [];

  const sendMessageMutation = useMutation({
    mutationFn: ({ groupId, content }: { groupId: string; content: string }) => {
      return firebaseApi.messaging.send(groupId, content, ['sms', 'email']);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast({ title: "Message sent successfully" });
      handleCloseDraftModal();
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  });

  const scheduleMessageMutation = useMutation({
    mutationFn: ({ groupId, schedule }: { groupId: string; schedule: any }) => {
      return firebaseApi.groups.createSchedule(groupId, schedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({ title: "Message scheduled successfully" });
      handleCloseDraftModal();
    },
    onError: () => {
      toast({ title: "Failed to schedule message", variant: "destructive" });
    }
  });

  const handleOpenDraftModal = () => {
    if (!user) {
      toast({ 
        title: "Authentication Required", 
        description: "Please sign up or log in to send messages",
        variant: "destructive" 
      });
      return;
    }
    setIsDraftModalOpen(true);
    metricsService.trackFeatureUsage('draft_message_modal');
  };

  const handleCloseDraftModal = () => {
    setIsDraftModalOpen(false);
    setSelectedGroupId("");
    setMessageContent("");
    setScheduledDate("");
    setScheduledTime("");
    setSendImmediately(true);
  };

  const handleSendMessage = () => {
    if (!user) {
      toast({ 
        title: "Authentication Required", 
        description: "Please sign up or log in to send messages",
        variant: "destructive" 
      });
      return;
    }

    if (!selectedGroupId || !messageContent.trim()) {
      toast({ title: "Please select a group and enter a message", variant: "destructive" });
      return;
    }

    if (sendImmediately) {
      sendMessageMutation.mutate({ groupId: selectedGroupId, content: messageContent });
      metricsService.trackFeatureUsage('send_message_immediate');
    } else {
      if (!scheduledDate || !scheduledTime) {
        toast({ title: "Please select date and time for scheduling", variant: "destructive" });
        return;
      }

      const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const schedule = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'one-time' as const,
        name: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : ''),
        message: messageContent,
        startDate: scheduleDateTime.toISOString().split('T')[0],
        startTime: scheduledTime,
        enabled: true
      };

      scheduleMessageMutation.mutate({ groupId: selectedGroupId, schedule });
      metricsService.trackFeatureUsage('schedule_message');
    }
  };

  const handleAuthRequiredAction = (action: string) => {
    if (!user) {
      toast({ 
        title: "Authentication Required", 
        description: `Please sign up or log in to ${action}`,
        variant: "destructive" 
      });
      return false;
    }
    return true;
  };

  const stats = user ? [
    {
      label: "Total Contacts",
      value: safeContacts.length,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
      border: "border-blue-500/30"
    },
    {
      label: "Enabled Groups",
      value: safeGroups.filter(group => group.enabled).length,
      icon: Layers,
      color: "text-purple-400",
      bg: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
      border: "border-purple-500/30"
    },
    {
      label: "Messages Sent",
      value: safeLogs.length,
      icon: MessageSquare,
      color: "text-emerald-400",
      bg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20",
      border: "border-emerald-500/30"
    },
  ] : [
    {
      label: "Total Contacts",
      value: 247,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
      border: "border-blue-500/30"
    },
    {
      label: "Enabled Groups",
      value: 12,
      icon: Layers,
      color: "text-purple-400",
      bg: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
      border: "border-purple-500/30"
    },
    {
      label: "Messages Sent",
      value: 1847,
      icon: MessageSquare,
      color: "text-emerald-400",
      bg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20",
      border: "border-emerald-500/30"
    },
  ];

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Check if we have partial data even with errors - don't block the whole page
  const hasAnyError = contactsError || groupsError || logsError;
  const hasPartialData = contacts || groups || logs;

  // Simple loading check - only show loading on truly first load
  const hasAnyData = contacts || groups || logs;
  const isStillLoading = (contactsLoading || groupsLoading || logsLoading);
  
  if (user && !hasAnyData && isStillLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your data...</p>
          <p className="text-xs text-muted-foreground">First load may take a moment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Inline error banner - doesn't block the page */}
      {user && hasAnyError && (
        <Alert variant="default" className="border-amber-200 bg-amber-50/50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Some data couldn't load. {hasPartialData ? 'Showing available data.' : 'Try refreshing the page.'}
            {!hasPartialData && (
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="ml-2 h-auto p-0 text-amber-800 underline"
              >
                Refresh now
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Hero Section for non-authenticated users */}
      {!user && !authLoading && (
        <>
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-emerald-600 p-12 text-white animate-slide-up">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6TTI0IDM0YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bTAtMTBjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00ek00OCAzNGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bTAtMTBjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
            <div className="relative z-10 max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-sm font-medium mb-6 animate-fade-in">
                <Sparkles className="h-4 w-4" />
                AI-Powered Contact Management
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight animate-slide-up" style={{ animationDelay: '100ms' }}>
                Manage Contacts.<br />Build Relationships.
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '200ms' }}>
                Import from anywhere, automate everything, and let AI help you stay connected with the people that matter.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 animate-slide-up" style={{ animationDelay: '300ms' }}>
                <Link href="/auth?mode=signup">
                  <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 shadow-2xl hover:shadow-3xl transition-all duration-300 px-8 py-6 text-lg font-semibold">
                    <UserPlus className="h-5 w-5 mr-2" />
                    Start Free Today
                  </Button>
                </Link>
                <Link href="/auth?mode=login">
                  <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 backdrop-blur-sm px-8 py-6 text-lg">
                    <LogIn className="h-5 w-5 mr-2" />
                    Sign In
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-center gap-8 text-sm text-white/80 animate-fade-in" style={{ animationDelay: '400ms' }}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full" />
                  Free forever plan
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full" />
                  Setup in 2 minutes
                </div>
              </div>
            </div>
          </div>

          {/* Core Value Props - Only 3 Main Features */}
          <div className="grid gap-8 md:grid-cols-3 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <Card className="group relative overflow-hidden glass hover-lift border-2 border-blue-200/50 hover:border-blue-400/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="relative p-8">
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 w-fit hover-scale">
                  <Upload className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground group-hover:text-blue-600 transition-colors">
                  Import Instantly
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  One-click import from Google, Apple, or any vCard file. Your entire network, ready in seconds. Zero manual entry.
                </p>
                <div className="flex items-center text-blue-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  Learn more →
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden glass hover-lift border-2 border-purple-200/50 hover:border-purple-400/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="relative p-8">
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 w-fit hover-scale">
                  <Brain className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground group-hover:text-purple-600 transition-colors">
                  AI That Gets You
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Smart message generation, automatic categorization, and insights that help you communicate better with everyone.
                </p>
                <div className="flex items-center text-purple-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  Learn more →
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden glass hover-lift border-2 border-emerald-200/50 hover:border-emerald-400/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="relative p-8">
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 w-fit hover-scale">
                  <Zap className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground group-hover:text-emerald-600 transition-colors">
                  Automate Everything
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Schedule messages, create smart groups, and never miss important connections. Set it once, stay connected forever.
                </p>
                <div className="flex items-center text-emerald-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  Learn more →
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Features Grid - Compact */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/30 p-8 border border-slate-200 dark:border-slate-800 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-2xl font-bold text-center mb-8 text-foreground">Everything you need to manage relationships</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/30 mb-3 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6 text-cyan-600" />
                </div>
                <h4 className="font-semibold text-sm mb-1">Contact Insights</h4>
                <p className="text-xs text-muted-foreground">AI-powered analytics</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 mb-3 group-hover:scale-110 transition-transform">
                  <Target className="h-6 w-6 text-orange-600" />
                </div>
                <h4 className="font-semibold text-sm mb-1">Smart Reminders</h4>
                <p className="text-xs text-muted-foreground">Never forget to follow up</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/20 border border-pink-500/30 mb-3 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6 text-pink-600" />
                </div>
                <h4 className="font-semibold text-sm mb-1">Advanced Analytics</h4>
                <p className="text-xs text-muted-foreground">Track engagement metrics</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500/20 to-slate-600/20 border border-slate-500/30 mb-3 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-slate-600" />
                </div>
                <h4 className="font-semibold text-sm mb-1">Private & Secure</h4>
                <p className="text-xs text-muted-foreground">Encrypted by default</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 p-10 text-white text-center animate-slide-up" style={{ animationDelay: '300ms' }}>
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-4">Ready to transform your contact management?</h3>
              <p className="text-lg text-white/90 mb-6 max-w-2xl mx-auto">
                Join professionals who've automated their networking and never miss a connection.
              </p>
              <Link href="/auth?mode=signup">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 shadow-2xl hover:shadow-3xl transition-all duration-300 px-10 py-6 text-lg font-semibold">
                  <UserPlus className="h-5 w-5 mr-2" />
                  Get Started Free - No Credit Card
                </Button>
              </Link>
              <p className="text-sm text-white/70 mt-4">Already have an account? <Link href="/auth?mode=login"><span className="underline font-medium hover:text-white cursor-pointer">Sign in here</span></Link></p>
            </div>
          </div>
        </>
      )}

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-chart-2/10 rounded-2xl blur-3xl -z-10" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-4xl font-display font-bold tracking-tight text-gradient mb-2">
                {user ? 'Dashboard' : 'ContactHub Preview'}
              </h2>
              <p className="text-muted-foreground text-lg">
                {user ? `Welcome back, ${user.name}!` : "See what automated contact management can do for you"}
              </p>
            </div>
            {user && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem(`onboarding_completed_${user.id}`);
                    setShowOnboarding(true);
                    metricsService.trackFeatureUsage('onboarding_restarted');
                  }}
                  className="w-full sm:w-auto gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Quick Start Guide
                </Button>
                <div className="text-center sm:text-right">
                  <div className="text-sm text-muted-foreground">Welcome back!</div>
                  <div className="font-medium text-foreground">{user.name}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat, i) => (
          <Card key={i} className={`relative overflow-hidden border ${stat.border} interactive-card animate-slide-up glass`} style={{ animationDelay: `${i * 100}ms` }}>
            <div className={`absolute inset-0 ${stat.bg} opacity-50`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div className={`p-3 rounded-xl ${stat.bg} border border-border/50 backdrop-blur-sm hover-scale`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {stat.label.toLowerCase()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 glass hover-lift animate-slide-up" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {user ? (
                logs?.slice(0, 5).map((log, index) => (
                  <div key={log.id} className="flex items-center interactive-card p-3 rounded-lg animate-fade-in" style={{ animationDelay: `${400 + index * 50}ms` }}>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center text-primary hover-scale">
                      <History className="h-4 w-4" />
                    </div>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none hover:text-primary transition-colors cursor-pointer">
                        Sent message to <span className="font-semibold text-primary">{log.groupName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full border border-border/30">
                      {log.recipients} recipients
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center interactive-card p-3 rounded-lg animate-fade-in opacity-75 hover:opacity-100 transition-opacity">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        Welcome message sent to <span className="font-semibold text-emerald-600">New Team Members</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Just now • Automated onboarding sequence
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-xs text-muted-foreground bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                      3 recipients
                    </div>
                  </div>
                  <div className="flex items-center interactive-card p-3 rounded-lg animate-fade-in opacity-75 hover:opacity-100 transition-opacity" style={{ animationDelay: '50ms' }}>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        Monthly newsletter scheduled for <span className="font-semibold text-blue-600">VIP Customers</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tomorrow at 9:00 AM • Recurring campaign
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-xs text-muted-foreground bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
                      127 recipients
                    </div>
                  </div>
                  <div className="flex items-center interactive-card p-3 rounded-lg animate-fade-in opacity-75 hover:opacity-100 transition-opacity" style={{ animationDelay: '100ms' }}>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        Birthday greetings sent to <span className="font-semibold text-purple-600">December Celebrants</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        2 hours ago • Smart automation triggered
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-xs text-muted-foreground bg-purple-50 px-2 py-1 rounded-full border border-purple-200">
                      8 recipients
                    </div>
                  </div>
                </div>
              )}
              {user && !logs?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {user ? <UpcomingSchedules /> : (
          <Card className="col-span-1 glass hover-lift animate-slide-up" style={{ animationDelay: '400ms' }}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center interactive-card p-3 rounded-lg animate-fade-in opacity-75 hover:opacity-100 transition-opacity">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="ml-4 space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">
                      Welcome message to <span className="font-semibold text-emerald-600">New Clients</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tomorrow at 9:00 AM • Automated onboarding
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200">
                    Scheduled
                  </Badge>
                </div>
                <div className="flex items-center interactive-card p-3 rounded-lg animate-fade-in opacity-75 hover:opacity-100 transition-opacity" style={{ animationDelay: '50ms' }}>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="ml-4 space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">
                      Monthly newsletter to <span className="font-semibold text-blue-600">All Contacts</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dec 20, 2025 at 10:00 AM • Recurring campaign
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-auto bg-blue-50 text-blue-700 border-blue-200">
                    Recurring
                  </Badge>
                </div>
                <div className="flex items-center interactive-card p-3 rounded-lg animate-fade-in opacity-75 hover:opacity-100 transition-opacity" style={{ animationDelay: '100ms' }}>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="ml-4 space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">
                      Holiday greetings to <span className="font-semibold text-purple-600">VIP Customers</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dec 25, 2025 at 8:00 AM • Seasonal campaign
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-auto bg-purple-50 text-purple-700 border-purple-200">
                    One-time
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="col-span-1 glass hover-lift animate-slide-up" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Link href={user ? "/contacts?create=true" : "#"} onClick={(e) => !handleAuthRequiredAction("create contacts") && e.preventDefault()} className="group">
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover-lift hover-glow transition-all duration-300 cursor-pointer">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-blue-400 transition-colors">Add New Contact</h3>
                    <p className="text-sm text-muted-foreground">Create and manage contact entries</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Plus className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
              </Link>

              <Link href={user ? "/groups?create=true" : "#"} onClick={(e) => !handleAuthRequiredAction("create groups") && e.preventDefault()} className="group">
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover-lift hover-glow transition-all duration-300 cursor-pointer">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Layers className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-purple-400 transition-colors">Create New Group</h3>
                    <p className="text-sm text-muted-foreground">Organize contacts into groups</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Plus className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
              </Link>

              <button onClick={handleOpenDraftModal} className="group w-full text-left">
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover-lift hover-glow transition-all duration-300 cursor-pointer">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                    <MessageSquare className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-emerald-400 transition-colors">Draft Message</h3>
                    <p className="text-sm text-muted-foreground">Compose and send group messages</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Send className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Draft Message Modal */}
      <Dialog open={isDraftModalOpen} onOpenChange={setIsDraftModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Draft Message
            </DialogTitle>
            <DialogDescription>
              Compose and send a message to a group of contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group">Select Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a group to message" />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.contactIds.length} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message Content</Label>
              <Textarea
                id="message"
                placeholder="Enter your message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This message will be sent to all contacts in the selected group
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="send-now"
                  name="send-option"
                  checked={sendImmediately}
                  onChange={() => setSendImmediately(true)}
                  className="text-primary"
                />
                <Label htmlFor="send-now" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4" />
                  Send immediately
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="schedule"
                  name="send-option"
                  checked={!sendImmediately}
                  onChange={() => setSendImmediately(false)}
                  className="text-primary"
                />
                <Label htmlFor="schedule" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4" />
                  Schedule for later
                </Label>
              </div>

              {!sendImmediately && (
                <div className="ml-6 space-y-2 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Scheduled Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Scheduled Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose when the message should be sent
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCloseDraftModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending || scheduleMessageMutation.isPending}
              className="flex items-center gap-2"
            >
              {sendMessageMutation.isPending || scheduleMessageMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {sendImmediately ? 'Sending...' : 'Scheduling...'}
                </>
              ) : (
                <>
                  {sendImmediately ? <Send className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  {sendImmediately ? 'Send Now' : 'Schedule Message'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}
