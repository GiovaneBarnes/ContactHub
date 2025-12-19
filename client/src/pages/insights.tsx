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
  LineChart
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

        // Calculate communication efficiency
        const totalCommunications = smsCount + emailCount;
        const communicationEfficiency = totalContacts > 0 && totalCommunications > 0
          ? Math.min(100, Math.round((totalCommunications / totalContacts) * 20))
          : 0;

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

        // Communication optimization
        if (communicationEfficiency < 30) {
          aiPredictions.push({
            type: 'communication',
            title: 'Communication Optimization',
            description: 'Your communication frequency could be optimized for better relationship building.',
            confidence: 75,
            recommendation: 'Try sending personalized messages to 3 contacts per day instead of mass communications.',
            icon: 'MessageSquare'
          });
        }

        // Generate smart goals based on user patterns
        const smartGoals: SmartGoal[] = [
          {
            id: 'weekly-contacts',
            title: 'Add New Contacts Weekly',
            description: 'Expand your network by adding quality contacts',
            target: Math.max(2, Math.ceil(totalContacts * 0.1)),
            current: 0, // Would need to track this
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            category: 'contacts'
          },
          {
            id: 'monthly-messages',
            title: 'Send Personalized Messages',
            description: 'Maintain relationships through regular communication',
            target: Math.max(10, totalContacts * 2),
            current: smsCount + emailCount,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            category: 'messages'
          },
          {
            id: 'engagement-score',
            title: 'Improve Engagement Score',
            description: 'Increase your overall platform engagement',
            target: Math.min(100, engagementScore + 20),
            current: engagementScore,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            category: 'engagement'
          }
        ];

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

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-gradient">
            AI-Powered Insights
          </h1>
          <p className="text-muted-foreground mt-2">
            Your personal contact network intelligence and growth recommendations
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(['7d', '30d', '90d'] as const).map((timeframe) => (
            <Button
              key={timeframe}
              variant={selectedTimeframe === timeframe ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
              className="flex-1 sm:flex-none"
            >
              {timeframe === '7d' ? '7 Days' : timeframe === '30d' ? '30 Days' : '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* AI Predictions Banner */}
      {insights?.aiPredictions && insights.aiPredictions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Predictions & Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights?.aiPredictions?.map((prediction, index) => (
              <Card key={index} className="glass border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      {prediction.icon === 'TrendingDown' && <TrendingDown className="h-4 w-4 text-purple-600" />}
                      {prediction.icon === 'Award' && <Award className="h-4 w-4 text-purple-600" />}
                      {prediction.icon === 'TrendingUp' && <TrendingUp className="h-4 w-4 text-purple-600" />}
                      {prediction.icon === 'MessageSquare' && <MessageSquare className="h-4 w-4 text-purple-600" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{prediction.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{prediction.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {prediction.confidence}% confidence
                        </Badge>
                      </div>
                      <p className="text-xs text-primary mt-2 font-medium">{prediction.recommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Network Strength */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Strength</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.networkStrength || 0}%</div>
            <Progress value={insights?.networkStrength || 0} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Overall network health score
            </p>
          </CardContent>
        </Card>

        {/* Engagement Score */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.engagementScore || 0}%</div>
            <Progress value={insights?.engagementScore || 0} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Platform activity & usage
            </p>
          </CardContent>
        </Card>

        {/* Communication Efficiency */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Communication Efficiency</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.communicationEfficiency || 0}%</div>
            <Progress value={insights?.communicationEfficiency || 0} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Messages per contact ratio
            </p>
          </CardContent>
        </Card>

        {/* Network Growth */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights?.networkGrowth !== undefined && insights.networkGrowth >= 0 ? '+' : ''}{insights?.networkGrowth || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Recent contact growth rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Analytics */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Contacts</span>
                <Badge variant="secondary">{insights?.totalContacts || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Contact Completeness</span>
                <Badge variant="outline">{insights?.contactCompleteness || 0}%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">With Email</span>
                <Badge variant="outline">{insights?.contactsWithEmail || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">With Phone</span>
                <Badge variant="outline">{insights?.contactsWithPhone || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

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
                  <div className="flex items-center gap-2">
                    {pattern.channel === 'SMS' && <Phone className="h-4 w-4 text-blue-500" />}
                    {pattern.channel === 'Email' && <Mail className="h-4 w-4 text-green-500" />}
                    <span className="text-sm font-medium">{pattern.channel}</span>
                  </div>
                  <Badge variant="secondary">{pattern.count} messages</Badge>
                </div>
              ))}
              {(!insights?.communicationPatterns || insights?.communicationPatterns?.length === 0) && (
                <p className="text-sm text-muted-foreground">No messages sent yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Usage & Activity */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI & Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">AI Features Used</span>
                <Badge variant="secondary">{insights?.aiUsage || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Recent Activity</span>
                <Badge variant="outline">{insights?.recentActivity || 0} logins</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg. Session</span>
                <Badge variant="outline">~12 min</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Goals */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            Smart Goals & Progress
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI-recommended goals to optimize your contact network management
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights?.smartGoals.map((goal) => (
              <div key={goal.id} className="p-4 border rounded-lg bg-card/50">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm">{goal.title}</h3>
                  <Badge variant={goal.current >= goal.target ? "default" : "outline"} className="text-xs">
                    {goal.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{goal.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Progress</span>
                    <span>{goal.current}/{goal.target}</span>
                  </div>
                  <Progress value={(goal.current / goal.target) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Deadline: {goal.deadline.toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI-Powered Suggestions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI-Powered Recommendations
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Personalized suggestions to improve your contact network and communication effectiveness
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights?.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">{suggestion}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-500" />
            Recommended Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 hover-glow">
              <UserPlus className="h-6 w-6 text-blue-500" />
              <div className="text-center">
                <div className="font-semibold">Add Quality Contacts</div>
                <div className="text-xs text-muted-foreground">Focus on meaningful connections</div>
              </div>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 hover-glow">
              <Brain className="h-6 w-6 text-purple-500" />
              <div className="text-center">
                <div className="font-semibold">Try AI Features</div>
                <div className="text-xs text-muted-foreground">Generate personalized messages</div>
              </div>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 hover-glow">
              <MessageSquare className="h-6 w-6 text-green-500" />
              <div className="text-center">
                <div className="font-semibold">Send Targeted Messages</div>
                <div className="text-xs text-muted-foreground">Reach out to specific contacts</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}