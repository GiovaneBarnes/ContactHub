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
  Star,
  Lightbulb,
  TrendingDown,
  Calendar,
  Mail,
  Phone,
  Award,
  Rocket,
  Compass,
  Eye,
  BarChart,
  PieChart,
  LineChart,
  Info,
  X
} from 'lucide-react';
import { metricsService, UserMetrics } from '@/lib/metrics';
import { useAuth } from '@/lib/auth-context';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseApi } from '@/lib/firebase-api';
import { cn } from '@/lib/utils';

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
  aiPredictions: AIPrediction[];
  engagementScore: number;
  communicationEfficiency: number;
  networkGrowth: number;
  smartGoals: SmartGoal[];
}

interface AIPrediction {
  type: 'engagement' | 'churn_risk' | 'growth' | 'communication';
  title: string;
  description: string;
  confidence: number;
  recommendation: string;
  icon: string;
}

interface SmartGoal {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  deadline: Date;
  category: 'contacts' | 'messages' | 'engagement' | 'networking';
}

export default function PersonalAnalytics() {
  const { user } = useAuth();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [showGuide, setShowGuide] = useState(false);

  // Track page view
  useEffect(() => {
    metricsService.trackPageView('personal-analytics');
  }, []);

  // Fetch user's personal analytics data
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['personal-insights', user?.id, selectedTimeframe],
    queryFn: async (): Promise<PersonalInsights> => {
      if (!user?.id) {
        return {
          contactCompleteness: 0,
          totalContacts: 0,
          contactsWithEmail: 0,
          contactsWithPhone: 0,
          recentActivity: 0,
          topCategories: [],
          communicationPatterns: [],
          aiUsage: 0,
          networkStrength: 0,
          suggestions: [],
          aiPredictions: [],
          engagementScore: 0,
          communicationEfficiency: 0,
          networkGrowth: 0,
          smartGoals: []
        };
      }

      try {

        // Get user's contacts
        const contactsRef = collection(db, 'contacts');
        const contactsQuery = query(
          contactsRef,
          where('userId', '==', user.id)
        );
        const contactsSnapshot = await getDocs(contactsQuery);
        const contacts = contactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Get user's metrics (with fallback)
        let userMetrics;
        try {
          userMetrics = await metricsService.getUserMetrics(user.id);
        } catch (metricsError) {
          userMetrics = {
            messagesSent: 0,
            aiRequests: 0,
            loginCount: 1,
            emailCount: 0
          };
        }

        // Calculate insights
        const totalContacts = contacts.length;
        const contactsWithEmail = contacts.filter((c: any) => c.email).length;
        const contactsWithPhone = contacts.filter((c: any) => c.phone).length;
        const contactCompleteness = totalContacts > 0
          ? Math.round(((contactsWithEmail + contactsWithPhone) / (totalContacts * 2)) * 100)
          : 0;

        // Get communication patterns from message logs instead of just metrics
        // Only get logs from the last 90 days to avoid query limits
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        let smsCount = 0;
        let emailCount = 0;

        try {
          const logsRef = collection(db, 'messageLogs');
          const logsQuery = query(
            logsRef,
            where('userId', '==', user.id),
            where('timestamp', '>=', Timestamp.fromDate(ninetyDaysAgo)),
            orderBy('timestamp', 'desc')
          );
          const logsSnapshot = await getDocs(logsQuery);
          const messageLogs = logsSnapshot.docs.map(doc => doc.data());

          // Calculate communication patterns from actual message logs
          messageLogs.forEach(log => {
            if (log.deliveryMethod === 'sms') {
              smsCount++;
            } else if (log.deliveryMethod === 'email') {
              emailCount++;
            } else if (log.deliveryMethod === 'both') {
              // For 'both', count based on actual sent messages
              const recipients = log.recipientDetails || [];
              recipients.forEach((recipient: any) => {
                if (recipient.smsStatus === 'sent') smsCount++;
                if (recipient.emailStatus === 'sent') emailCount++;
              });
            }
          });

        } catch (logsError) {
          // Keep smsCount and emailCount as 0
        }

        const communicationPatterns = [
          { channel: 'SMS', count: smsCount },
          { channel: 'Email', count: emailCount },
        ];

        // Calculate network strength based on contact completeness and activity
        const networkStrength = Math.min(100, Math.round(
          (contactCompleteness * 0.6) +
          ((userMetrics?.loginCount || 0) > 5 ? 20 : (userMetrics?.loginCount || 0) * 4) +
          ((userMetrics?.aiRequests || 0) > 3 ? 20 : (userMetrics?.aiRequests || 0) * 6.67)
        ));

        // Calculate engagement score (0-100)
        const engagementScore = Math.min(100, Math.round(
          (userMetrics?.loginCount || 0) * 10 +
          (userMetrics?.aiRequests || 0) * 5 +
          (userMetrics?.messagesSent || 0) * 2 +
          (totalContacts > 0 ? contactCompleteness * 0.5 : 0)
        ));

        // Calculate communication efficiency - more fair scoring
        // Uses a logarithmic-inspired scale to reward any outreach and scale reasonably
        const totalCommunications = smsCount + emailCount;
        let communicationEfficiency = 0;
        if (totalContacts > 0 && totalCommunications > 0) {
          const messagesPerContact = totalCommunications / totalContacts;
          // More generous scoring: 1 msg per 10 contacts = 25%, 1 per 5 = 40%, 1 per 2 = 70%, 1:1 = 100%
          if (messagesPerContact >= 1) {
            communicationEfficiency = 100;
          } else if (messagesPerContact >= 0.5) {
            communicationEfficiency = Math.round(70 + (messagesPerContact - 0.5) * 60); // 70-100%
          } else if (messagesPerContact >= 0.2) {
            communicationEfficiency = Math.round(40 + (messagesPerContact - 0.2) * 100); // 40-70%
          } else if (messagesPerContact >= 0.1) {
            communicationEfficiency = Math.round(25 + (messagesPerContact - 0.1) * 150); // 25-40%
          } else {
            communicationEfficiency = Math.round(messagesPerContact * 250); // 0-25%
          }
        }
        communicationEfficiency = Math.min(100, Math.max(0, communicationEfficiency));

        // Calculate network growth (simplified - shows growth rate)
        const networkGrowth = totalContacts > 0 ? Math.round((totalContacts - 1) * 50) : 0; // Simplified growth calculation

        // Generate AI-powered predictions
        const aiPredictions: AIPrediction[] = [];

        // Engagement prediction
        if (engagementScore < 40) {
          aiPredictions.push({
            type: 'engagement',
            title: 'Low Engagement Detected',
            description: 'Your activity levels suggest you might benefit from more regular contact management.',
            confidence: 85,
            recommendation: 'Set a goal to log in at least 3 times per week and send 1-2 messages daily.',
            icon: 'TrendingDown'
          });
        } else if (engagementScore > 80) {
          aiPredictions.push({
            type: 'engagement',
            title: 'High Engagement Champion',
            description: 'You\'re highly engaged with your network! Keep up the excellent work.',
            confidence: 95,
            recommendation: 'Consider mentoring others or sharing your contact management strategies.',
            icon: 'Award'
          });
        }

        // Growth prediction
        if (totalContacts < 5) {
          aiPredictions.push({
            type: 'growth',
            title: 'Network Expansion Opportunity',
            description: 'Your contact network is still growing. Focus on quality connections.',
            confidence: 90,
            recommendation: 'Aim to add 2-3 high-quality contacts per week through networking events.',
            icon: 'TrendingUp'
          });
        }

        // Communication optimization - more realistic thresholds
        if (communicationEfficiency < 25) {
          aiPredictions.push({
            type: 'communication',
            title: 'Start Building Connections',
            description: 'You have a large network but limited recent outreach. Small steps make a big difference.',
            confidence: 80,
            recommendation: 'Start by reaching out to 3-5 contacts this week with personalized messages.',
            icon: 'MessageSquare'
          });
        } else if (communicationEfficiency >= 25 && communicationEfficiency < 60) {
          aiPredictions.push({
            type: 'communication',
            title: 'Growing Your Engagement',
            description: 'You\'re making good progress with outreach. Consistency is key to maintaining relationships.',
            confidence: 85,
            recommendation: 'Keep up the momentum! Try to connect with 5-10 contacts weekly.',
            icon: 'MessageSquare'
          });
        }

        // Generate smart goals based on user patterns - realistic and achievable
        const smartGoals: SmartGoal[] = [];
        
        // Weekly contacts goal - always realistic (2-5 contacts per week)
        if (totalContacts < 50) {
          smartGoals.push({
            id: 'weekly-contacts',
            title: 'Add New Contacts Weekly',
            description: 'Grow your network with 3-5 quality contacts',
            target: 5,
            current: 0, // Would need to track this
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            category: 'contacts'
          });
        } else {
          smartGoals.push({
            id: 'weekly-contacts',
            title: 'Add New Contacts Weekly',
            description: 'Maintain network growth with quality over quantity',
            target: 2,
            current: 0,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            category: 'contacts'
          });
        }
        
        // Monthly messages goal - scaled to network size but capped reasonably
        const messageTarget = totalContacts < 50 
          ? Math.max(15, Math.ceil(totalContacts * 0.5)) // Reach out to half your small network
          : totalContacts < 200
          ? Math.max(30, Math.ceil(totalContacts * 0.25)) // 25% of medium network
          : Math.min(100, Math.max(50, Math.ceil(totalContacts * 0.1))); // 10% of large network, capped at 100
        
        smartGoals.push({
          id: 'monthly-messages',
          title: 'Send Personalized Messages',
          description: 'Stay connected with meaningful outreach',
          target: messageTarget,
          current: smsCount + emailCount,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          category: 'messages'
        });
        
        // Engagement goal - only show if not already maxed out
        if (engagementScore < 90) {
          smartGoals.push({
            id: 'engagement-score',
            title: 'Boost Your Activity',
            description: 'Increase platform usage and engagement',
            target: Math.min(100, engagementScore + 20),
            current: engagementScore,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            category: 'engagement'
          });
        } else {
          // Alternative goal for highly engaged users
          smartGoals.push({
            id: 'complete-profiles',
            title: 'Complete Contact Info',
            description: 'Add missing email or phone numbers',
            target: Math.ceil(totalContacts * 0.8), // 80% completion
            current: contactsWithEmail + contactsWithPhone,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            category: 'contacts'
          });
        }

        // Get AI usage from analytics events
        let aiUsage = 0;
        try {
          const aiEventsQuery = query(
            collection(db, 'analytics_events'),
            where('userId', '==', user.id),
            where('category', '==', 'ai'),
            orderBy('timestamp', 'desc')
          );
          const aiEventsSnapshot = await getDocs(aiEventsQuery);
          aiUsage = aiEventsSnapshot.docs.length;
        } catch (aiError) {
          // Keep aiUsage as 0
        }

        // Generate AI-powered suggestions based on actual data
        const suggestions = [];
        if (contactCompleteness < 70) {
          suggestions.push("Add email addresses or phone numbers to your contacts for better connectivity");
        }
        if (aiUsage < 2) {
          suggestions.push("Try our AI features to generate personalized messages and categorize contacts");
        }
        if (totalContacts < 10) {
          suggestions.push("Expand your network by adding more contacts and organizing them into groups");
        }
        if ((smsCount + emailCount) < 5) {
          suggestions.push("Start communicating with your contacts regularly to build stronger relationships");
        }
        if (engagementScore < 50) {
          suggestions.push("Increase your engagement by logging in regularly and using platform features");
        }
        if (communicationEfficiency < 40) {
          suggestions.push("Focus on quality over quantity - send meaningful messages to fewer contacts");
        }
        if (suggestions.length === 0) {
          suggestions.push("Your contact network looks great! Keep up the good work maintaining your connections.");
        }

        const result = {
          contactCompleteness,
          totalContacts,
          contactsWithEmail,
          contactsWithPhone,
          recentActivity: userMetrics?.loginCount || 0,
          topCategories: [], // TODO: Implement category analysis
          communicationPatterns,
          aiUsage,
          networkStrength,
          suggestions,
          aiPredictions,
          engagementScore,
          communicationEfficiency,
          networkGrowth,
          smartGoals
        };

        return result;

      } catch (error) {
        // Return fallback data instead of crashing
        return {
          contactCompleteness: 0,
          totalContacts: 0,
          contactsWithEmail: 0,
          contactsWithPhone: 0,
          recentActivity: 0,
          topCategories: [],
          communicationPatterns: [],
          aiUsage: 0,
          networkStrength: 0,
          suggestions: [],
          aiPredictions: [],
          engagementScore: 0,
          communicationEfficiency: 0,
          networkGrowth: 0,
          smartGoals: []
        };
      }
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

  // Don't show error state if we have fallback data
  const hasData = insights ? (
    insights.totalContacts > 0 ||
    insights.communicationPatterns?.length > 0 ||
    insights.topCategories?.length > 0
  ) : false;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Show subtle error banner if there was an error but we have no data */}
      {error && !insights && (
        <Alert variant="default" className="border-amber-200 bg-amber-50/50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            We're having trouble loading fresh insights. Showing cached data while we reconnect.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight text-gradient">
              Your Contact Insights
            </h1>
            <p className="text-muted-foreground mt-2">
              Understand your networking patterns and get personalized tips to strengthen relationships
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="w-full sm:w-auto"
          >
            <Info className="h-4 w-4 mr-2" />
            {showGuide ? 'Hide' : 'Show'} Guide
          </Button>
        </div>
        
        {/* Timeframe selector on its own line for better spacing */}
        <div className="flex justify-center sm:justify-end gap-2">
          {(['7d', '30d', '90d'] as const).map((timeframe) => (
            <Button
              key={timeframe}
              variant={selectedTimeframe === timeframe ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
              className="flex-1 sm:flex-none min-w-[100px]"
            >
              {timeframe === '7d' ? '7 Days' : timeframe === '30d' ? '30 Days' : '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Helpful Guide Card */}
      {showGuide && (
        <Card className="glass border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Understanding Your Insights</h3>
                  <p className="text-sm text-muted-foreground">Here's what each metric means and how to improve them</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowGuide(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold text-sm">Network Quality</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Measures how complete your contacts' information is. Higher scores mean more contacts have both email and phone numbers, making it easier to stay connected.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span className="font-semibold text-sm">Your Activity</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tracks how often you use ContactHub—logins, AI features, and messages sent. Regular activity helps maintain strong relationships.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold text-sm">Outreach Rate</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Measures your messaging activity relative to network size. You don't need to message everyone—focus on quality connections. Even 10% of your network monthly is excellent!
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="font-semibold text-sm">Network Size</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Simply the total number of contacts in your network. Quality matters more than quantity—focus on meaningful connections.
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-950/50 dark:to-blue-950/50 border border-purple-200 dark:border-purple-800">
              <p className="text-sm">
                <span className="font-semibold">💡 Pro Tip: </span>
                <span className="text-muted-foreground">
                  Focus on one improvement area at a time. Complete your contacts' info first, then work on regular communication patterns.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Predictions Banner - With Better Context */}
      {insights?.aiPredictions && insights.aiPredictions.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Smart Insights & Recommendations
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered analysis of your contact management patterns with personalized tips
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights?.aiPredictions?.map((prediction, index) => (
              <Card key={index} className="glass border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                      {prediction.icon === 'TrendingDown' && <TrendingDown className="h-5 w-5 text-purple-600" />}
                      {prediction.icon === 'Award' && <Award className="h-5 w-5 text-purple-600" />}
                      {prediction.icon === 'TrendingUp' && <TrendingUp className="h-5 w-5 text-purple-600" />}
                      {prediction.icon === 'MessageSquare' && <MessageSquare className="h-5 w-5 text-purple-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm leading-tight">{prediction.title}</h3>
                        <Badge variant="secondary" className="text-xs whitespace-nowrap flex-shrink-0">
                          {prediction.confidence}% sure
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{prediction.description}</p>
                      <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <p className="text-xs font-medium text-purple-900 dark:text-purple-100 leading-relaxed">
                          <span className="font-semibold">Action: </span>{prediction.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics Dashboard - With Clear Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Network Strength */}
        <Card className="glass group hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Quality</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.networkStrength || 0}%</div>
            <Progress value={insights?.networkStrength || 0} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              How complete your contact info is
            </p>
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium mb-1">What this means:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {insights?.contactCompleteness || 0}% of contacts have email/phone</li>
                <li>• {insights?.totalContacts || 0} total contacts</li>
              </ul>
              {(insights?.networkStrength || 0) < 70 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                  💡 Add missing contact details to improve
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Score */}
        <Card className="glass group hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Activity</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.engagementScore || 0}%</div>
            <Progress value={insights?.engagementScore || 0} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              How actively you're using ContactHub
            </p>
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium mb-1">Based on:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {insights?.recentActivity || 0} logins in past {selectedTimeframe === '7d' ? '7' : selectedTimeframe === '30d' ? '30' : '90'} days</li>
                <li>• {insights?.aiUsage || 0} AI features used</li>
                <li>• {(insights?.communicationPatterns?.reduce((sum, p) => sum + p.count, 0)) || 0} messages sent</li>
              </ul>
              {(insights?.engagementScore || 0) < 50 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                  💡 Log in more often to boost this score
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Communication Efficiency */}
        <Card className="glass group hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outreach Rate</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.communicationEfficiency || 0}%</div>
            <Progress value={insights?.communicationEfficiency || 0} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              How actively you're reaching out
            </p>
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium mb-1">Your activity:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {(insights?.communicationPatterns?.reduce((sum, p) => sum + p.count, 0)) || 0} messages sent</li>
                <li>• {insights?.totalContacts || 0} total contacts</li>
                <li>• ~{(insights?.totalContacts && insights.totalContacts > 0) ? Math.round(insights.totalContacts / Math.max(1, (insights?.communicationPatterns?.reduce((sum, p) => sum + p.count, 0) || 1))) : '0'} contacts per message</li>
              </ul>
              {(insights?.communicationEfficiency || 0) < 25 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                  💡 Try messaging 3-5 contacts this week
                </p>
              )}
              {(insights?.communicationEfficiency || 0) >= 25 && (insights?.communicationEfficiency || 0) < 60 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                  👍 Good start! Keep building connections
                </p>
              )}
              {(insights?.communicationEfficiency || 0) >= 60 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                  ⭐ Excellent outreach activity!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Network Growth */}
        <Card className="glass group hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Size</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.totalContacts || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total contacts in your network
            </p>
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium mb-1">Breakdown:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {insights?.contactsWithEmail || 0} with email</li>
                <li>• {insights?.contactsWithPhone || 0} with phone</li>
                <li>• {Math.round(((insights?.contactsWithEmail || 0) + (insights?.contactsWithPhone || 0)) / Math.max(1, (insights?.totalContacts || 0) * 2) * 100)}% info completeness</li>
              </ul>
              {(insights?.totalContacts || 0) < 20 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                  💡 Add more contacts to grow your network
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Analytics - More Intuitive */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Contact Book
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Overview of your contacts and their information
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
                <div>
                  <div className="text-2xl font-bold">{insights?.totalContacts || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Contacts</div>
                </div>
                <Users className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-500" />
                    Have email address
                  </span>
                  <Badge variant="secondary">{insights?.contactsWithEmail || 0}</Badge>
                </div>
                <Progress value={((insights?.contactsWithEmail || 0) / Math.max(1, insights?.totalContacts || 0)) * 100} className="h-1.5" />
                
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-500" />
                    Have phone number
                  </span>
                  <Badge variant="secondary">{insights?.contactsWithPhone || 0}</Badge>
                </div>
                <Progress value={((insights?.contactsWithPhone || 0) / Math.max(1, insights?.totalContacts || 0)) * 100} className="h-1.5" />
              </div>
              
              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-1">Info Completeness</div>
                <div className="flex items-center gap-2">
                  <Progress value={insights?.contactCompleteness || 0} className="h-2 flex-1" />
                  <span className="text-sm font-semibold">{insights?.contactCompleteness || 0}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(insights?.contactCompleteness || 0) < 50 && "Most contacts are missing info"}
                  {(insights?.contactCompleteness || 0) >= 50 && (insights?.contactCompleteness || 0) < 80 && "Good! More contacts have info"}
                  {(insights?.contactCompleteness || 0) >= 80 && "Excellent! Most contacts have full info"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Communication Patterns - Clearer Explanation */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Your Messages
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How you've been communicating with contacts
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights?.communicationPatterns && (insights?.communicationPatterns?.reduce((sum, p) => sum + p.count, 0) || 0) > 0 ? (
                <>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-950/30 dark:to-emerald-900/30">
                    <div className="text-2xl font-bold">
                      {insights?.communicationPatterns?.reduce((sum, p) => sum + p.count, 0) || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Messages Sent</div>
                  </div>
                  
                  <div className="space-y-3">
                    {insights?.communicationPatterns.map((pattern) => (
                      <div key={pattern.channel}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {pattern.channel === 'SMS' && <Phone className="h-4 w-4 text-blue-500" />}
                            {pattern.channel === 'Email' && <Mail className="h-4 w-4 text-green-500" />}
                            <span className="text-sm font-medium">{pattern.channel}</span>
                          </div>
                          <Badge variant="secondary">{pattern.count}</Badge>
                        </div>
                        <Progress 
                          value={(pattern.count / Math.max(1, insights?.communicationPatterns?.reduce((sum, p) => sum + p.count, 0) || 1)) * 100} 
                          className="h-1.5"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Average: </span>
                      {((insights?.communicationPatterns?.reduce((sum, p) => sum + p.count, 0) || 0) / Math.max(1, insights?.totalContacts || 0)).toFixed(1)} messages per contact
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No messages sent yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start reaching out to your contacts!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Usage & Activity - More Context */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Activity & AI Usage
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Your platform engagement and AI feature usage
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30">
                <div className="text-2xl font-bold">{insights?.recentActivity || 0}</div>
                <div className="text-xs text-muted-foreground">Times Logged In</div>
                <p className="text-xs text-muted-foreground mt-1">
                  in the last {selectedTimeframe === '7d' ? '7' : selectedTimeframe === '30d' ? '30' : '90'} days
                </p>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  AI Features Used
                </span>
                <Badge variant="secondary">{insights?.aiUsage || 0}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {(insights?.aiUsage || 0) === 0 && "Try AI to generate messages, categorize contacts, and get insights"}
                {(insights?.aiUsage || 0) > 0 && (insights?.aiUsage || 0) < 5 && "You're starting to use AI features"}
                {(insights?.aiUsage || 0) >= 5 && (insights?.aiUsage || 0) < 15 && "You're actively using AI features"}
                {(insights?.aiUsage || 0) >= 15 && "You're a power user of AI features!"}
              </p>
              
              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-2">Engagement Level</div>
                <div className="flex items-center gap-2 mb-1">
                  <Progress value={insights?.engagementScore || 0} className="h-2 flex-1" />
                  <span className="text-sm font-semibold">{insights?.engagementScore || 0}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(insights?.engagementScore || 0) < 30 && "👋 Start using ContactHub more often"}
                  {(insights?.engagementScore || 0) >= 30 && (insights?.engagementScore || 0) < 60 && "📈 You're getting active!"}
                  {(insights?.engagementScore || 0) >= 60 && (insights?.engagementScore || 0) < 80 && "🔥 Great engagement!"}
                  {(insights?.engagementScore || 0) >= 80 && "⭐ Outstanding activity!"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Goals - More User-Friendly */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            Your Goals
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Personalized goals to help you build stronger relationships
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights?.smartGoals.map((goal) => {
              const progress = (goal.current / goal.target) * 100;
              const isComplete = goal.current >= goal.target;
              
              return (
                <div key={goal.id} className={cn(
                  "p-4 border rounded-lg transition-all",
                  isComplete 
                    ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700" 
                    : "bg-card/50 hover:shadow-md"
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      {isComplete && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {goal.title}
                    </h3>
                    <Badge variant={isComplete ? "default" : "outline"} className="text-xs">
                      {goal.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{goal.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">
                        {goal.current}/{goal.target}
                        {isComplete && " ✓"}
                      </span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>
                        {isComplete ? "Completed!" : `${Math.max(0, goal.target - goal.current)} to go`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {goal.deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {(!insights?.smartGoals || insights.smartGoals.length === 0) && (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No goals set yet</p>
              <p className="text-xs text-muted-foreground mt-1">Goals will appear based on your activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI-Powered Suggestions - Clearer and More Actionable */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Tips to Improve
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Personalized suggestions based on your contact management patterns
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights?.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow">
                <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm leading-relaxed">{suggestion}</p>
              </div>
            ))}
          </div>
          {(!insights?.suggestions || insights.suggestions.length === 0) && (
            <div className="text-center py-8">
              <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No suggestions at the moment</p>
              <p className="text-xs text-muted-foreground mt-1">Keep using ContactHub to get personalized tips</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions - More Descriptive */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-500" />
            Quick Actions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Common tasks to help you manage your contacts better
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center gap-3 hover-glow group transition-all"
              onClick={() => window.location.href = '/contacts'}
            >
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                <UserPlus className="h-6 w-6 text-blue-500" />
              </div>
              <div className="text-center">
                <div className="font-semibold mb-1">Add Contacts</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Grow your network with quality connections
                </div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center gap-3 hover-glow group transition-all"
              onClick={() => window.location.href = '/contacts'}
            >
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                <Brain className="h-6 w-6 text-purple-500" />
              </div>
              <div className="text-center">
                <div className="font-semibold mb-1">Use AI Features</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Let AI write personalized messages for you
                </div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center gap-3 hover-glow group transition-all"
              onClick={() => window.location.href = '/groups'}
            >
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 group-hover:scale-110 transition-transform">
                <MessageSquare className="h-6 w-6 text-green-500" />
              </div>
              <div className="text-center">
                <div className="font-semibold mb-1">Message Groups</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Send bulk messages to organized groups
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}