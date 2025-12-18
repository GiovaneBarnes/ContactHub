import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  UserPlus,
  Sparkles,
  Heart,
  Star
} from 'lucide-react';
import { metricsService, UserMetrics } from '@/lib/metrics';
import { useAuth } from '@/lib/auth-context';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseApi } from '@/lib/firebase-api';

interface PersonalInsights {
  contactCompleteness: number;
  totalContacts: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
  recentActivity: number;
  topCategories: { category: string; count: number }[];
  communicationPatterns: { channel: string; count: number }[];
  aiUsage: number;
  networkStrength: number;
  suggestions: string[];
}

export default function PersonalAnalytics() {
  const { user } = useAuth();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  // Track page view
  useEffect(() => {
    metricsService.trackPageView('personal-analytics');
  }, []);

  // Fetch user's personal analytics data
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['personal-insights', user?.id, selectedTimeframe],
    queryFn: async (): Promise<PersonalInsights> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get user's contacts
      const contactsRef = collection(db, 'contacts');
      const contactsQuery = query(
        contactsRef,
        where('userId', '==', user.id)
      );
      const contactsSnapshot = await getDocs(contactsQuery);
      const contacts = contactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get user's metrics
      const userMetrics = await metricsService.getUserMetrics(user.id);

      // Calculate insights
      const totalContacts = contacts.length;
      const contactsWithEmail = contacts.filter((c: any) => c.email).length;
      const contactsWithPhone = contacts.filter((c: any) => c.phone).length;
      const contactCompleteness = totalContacts > 0
        ? Math.round(((contactsWithEmail + contactsWithPhone) / (totalContacts * 2)) * 100)
        : 0;

      // Get communication patterns from metrics
      const communicationPatterns = [
        { channel: 'SMS', count: userMetrics?.messagesSent || 0 },
        { channel: 'Email', count: userMetrics?.emailCount || 0 },
      ];

      // Calculate network strength based on contact completeness and activity
      const networkStrength = Math.min(100, Math.round(
        (contactCompleteness * 0.6) +
        ((userMetrics?.loginCount || 0) > 5 ? 20 : (userMetrics?.loginCount || 0) * 4) +
        ((userMetrics?.aiRequests || 0) > 3 ? 20 : (userMetrics?.aiRequests || 0) * 6.67)
      ));

      // Generate AI-powered suggestions
      const suggestions = [];
      if (contactCompleteness < 70) {
        suggestions.push("Add email addresses or phone numbers to your contacts for better connectivity");
      }
      if ((userMetrics?.aiRequests || 0) < 2) {
        suggestions.push("Try our AI features to generate personalized messages and categorize contacts");
      }
      if (totalContacts < 10) {
        suggestions.push("Expand your network by adding more contacts and organizing them into groups");
      }
      if (suggestions.length === 0) {
        suggestions.push("Your contact network looks great! Keep up the good work maintaining your connections.");
      }

      return {
        contactCompleteness,
        totalContacts,
        contactsWithEmail,
        contactsWithPhone,
        recentActivity: userMetrics?.loginCount || 0,
        topCategories: [], // TODO: Implement category analysis
        communicationPatterns,
        aiUsage: userMetrics?.aiRequests || 0,
        networkStrength,
        suggestions
      };
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load your personal insights. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-gradient">
            My Insights
          </h1>
          <p className="text-muted-foreground mt-2">
            Discover insights about your contact network and communication patterns
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((timeframe) => (
            <Button
              key={timeframe}
              variant={selectedTimeframe === timeframe ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
            >
              {timeframe === '7d' ? '7 Days' : timeframe === '30d' ? '30 Days' : '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Network Strength Overview */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Network Strength
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={insights?.networkStrength || 0} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {insights?.networkStrength || 0}% - Based on contact completeness, activity, and AI usage
              </p>
            </div>
            <div className="text-2xl font-bold text-primary">
              {insights?.networkStrength || 0}%
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Contact Completeness */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contact Completeness</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.contactCompleteness || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {insights?.contactsWithEmail || 0} with email, {insights?.contactsWithPhone || 0} with phone
            </p>
          </CardContent>
        </Card>

        {/* Total Contacts */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.totalContacts || 0}</div>
            <p className="text-xs text-muted-foreground">
              People in your network
            </p>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.recentActivity || 0}</div>
            <p className="text-xs text-muted-foreground">
              Logins in selected period
            </p>
          </CardContent>
        </Card>

        {/* AI Usage */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Features Used</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.aiUsage || 0}</div>
            <p className="text-xs text-muted-foreground">
              AI-powered actions taken
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Communication Patterns */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Communication Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights?.communicationPatterns.map((pattern) => (
                <div key={pattern.channel} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{pattern.channel}</span>
                  <Badge variant="secondary">{pattern.count} messages</Badge>
                </div>
              ))}
              {(!insights?.communicationPatterns || insights.communicationPatterns.length === 0) && (
                <p className="text-sm text-muted-foreground">No messages sent yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI-Powered Suggestions */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Insights & Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights?.suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <Heart className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{suggestion}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add New Contact
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Try AI Features
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Send Group Message
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}