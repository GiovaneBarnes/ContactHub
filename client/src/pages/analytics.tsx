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
  Zap
} from 'lucide-react';
import { metricsService, UserMetrics, AnalyticsPrediction } from '@/lib/metrics';
import { useAuth } from '@/lib/auth-context';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalContacts: number;
  totalMessages: number;
  aiRequests: number;
  topFeatures: { feature: string; usage: number }[];
  userGrowth: { date: string; users: number }[];
  engagementTrends: { date: string; logins: number; messages: number; aiUsage: number }[];
}

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  // Track page view
  useEffect(() => {
    metricsService.trackPageView('analytics');
  }, []);

  // Admin access control
  const adminEmails = import.meta.env.VITE_ADMIN_EMAILS?.split(',').map((email: string) => email.trim()) || [];
  const isAdmin = user?.email && adminEmails.includes(user.email);

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', selectedTimeframe],
    queryFn: async (): Promise<AnalyticsData> => {
      const days = selectedTimeframe === '7d' ? 7 : selectedTimeframe === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all analytics events
      const eventsQuery = query(
        collection(db, 'analytics_events'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      const events = await getDocs(eventsQuery);
      const eventData = events.docs.map(doc => doc.data());

      // Calculate metrics
      const userIdSet = new Set(eventData.map(e => e.userId).filter(Boolean));
      const userIds: string[] = [];
      userIdSet.forEach(id => userIds.push(id));
      const activeUsers = userIds.length;

      const totalContacts = eventData.filter(e => e.category === 'contact' && e.action === 'create').length;
      const totalMessages = eventData.filter(e => e.category === 'message' && e.action === 'send').length;
      const aiRequests = eventData.filter(e => e.category === 'ai').length;

      // Top features
      const featureUsage: Record<string, number> = {};
      eventData.forEach(event => {
        if (event.category === 'user' && event.action === 'feature_use') {
          const feature = event.properties?.feature;
          if (feature) {
            featureUsage[feature] = (featureUsage[feature] || 0) + 1;
          }
        }
      });

      const topFeatures = Object.entries(featureUsage)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([feature, usage]) => ({ feature, usage }));

      // Mock growth data (in real app, this would be calculated from historical data)
      const userGrowth = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        return {
          date: date.toISOString().split('T')[0],
          users: Math.floor(Math.random() * 10) + activeUsers
        };
      });

      // Engagement trends
      const engagementTrends = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        const dayEvents = eventData.filter(e =>
          new Date(e.timestamp.toDate()).toDateString() === date.toDateString()
        );

        return {
          date: date.toISOString().split('T')[0],
          logins: dayEvents.filter(e => e.category === 'user' && e.action === 'login').length,
          messages: dayEvents.filter(e => e.category === 'message' && e.action === 'send').length,
          aiUsage: dayEvents.filter(e => e.category === 'ai').length
        };
      });

      return {
        totalUsers: userIds.length,
        activeUsers,
        totalContacts,
        totalMessages,
        aiRequests,
        topFeatures,
        userGrowth,
        engagementTrends
      };
    },
    enabled: !!user
  });

  // Get user predictions
  const { data: predictions } = useQuery({
    queryKey: ['predictions', user?.id],
    queryFn: () => user?.id ? metricsService.generatePredictions(user.id) : [],
    enabled: !!user?.id
  });

  // Get user's personal metrics
  const { data: userMetrics } = useQuery({
    queryKey: ['user-metrics', user?.id, selectedTimeframe],
    queryFn: () => user?.id ? metricsService.getUserMetrics(user.id) : null,
    enabled: !!user?.id
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please log in to view analytics.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto" />
          <div>
            <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
            <p className="text-muted-foreground mt-2">
              Advanced analytics and insights for product optimization.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              This feature is currently available to administrators only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into user behavior and system performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={selectedTimeframe === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe('7d')}
          >
            7 Days
          </Button>
          <Button
            variant={selectedTimeframe === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe('30d')}
          >
            30 Days
          </Button>
          <Button
            variant={selectedTimeframe === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe('90d')}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.activeUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacts Created</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.totalContacts || 0}</div>
            <p className="text-xs text-muted-foreground">
              +8% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.totalMessages || 0}</div>
            <p className="text-xs text-muted-foreground">
              +15% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Requests</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.aiRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              +25% from last period
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="features">Feature Usage</TabsTrigger>
          <TabsTrigger value="personal">Your Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData?.topFeatures.map((feature, index) => (
                    <div key={feature.feature} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-sm capitalize">{feature.feature.replace('_', ' ')}</span>
                      </div>
                      <Badge variant="secondary">{feature.usage}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>API Response Time</span>
                      <span>245ms</span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Error Rate</span>
                      <span>0.1%</span>
                    </div>
                    <Progress value={2} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>AI Success Rate</span>
                      <span>94%</span>
                    </div>
                    <Progress value={94} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <div className="grid gap-4">
            {predictions?.map((prediction, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {prediction.predictionType === 'churn_risk' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                      {prediction.predictionType === 'engagement_score' && <TrendingUp className="h-5 w-5 text-green-500" />}
                      {prediction.predictionType === 'feature_adoption' && <Zap className="h-5 w-5 text-blue-500" />}
                      {prediction.predictionType === 'contact_growth' && <Target className="h-5 w-5 text-purple-500" />}
                      {prediction.predictionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </CardTitle>
                    <Badge variant={prediction.probability > 0.7 ? 'destructive' : prediction.probability > 0.4 ? 'default' : 'secondary'}>
                      {(prediction.probability * 100).toFixed(0)}% probability
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Confidence</div>
                      <Progress value={prediction.confidence * 100} className="h-2" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Key Factors</div>
                      <div className="flex flex-wrap gap-1">
                        {prediction.factors.map((factor, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Predicted for: {prediction.predictedDate.toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Adoption Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.engagementTrends.slice(-7).map((day, index) => (
                  <div key={day.date} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{new Date(day.date).toLocaleDateString()}</div>
                        <div className="text-sm text-muted-foreground">
                          {day.logins} logins, {day.messages} messages, {day.aiUsage} AI requests
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {day.logins + day.messages + day.aiUsage} total actions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="space-y-4">
          {userMetrics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Your Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userMetrics.totalContacts}</div>
                  <p className="text-sm text-muted-foreground">Contacts you've created</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Messages Sent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userMetrics.messagesSent}</div>
                  <p className="text-sm text-muted-foreground">Group messages sent</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userMetrics.aiRequests}</div>
                  <p className="text-sm text-muted-foreground">AI features used</p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Feature Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(userMetrics.featureUsage).map(([feature, count]) => (
                      <div key={feature} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm capitalize">{feature.replace('_', ' ')}</span>
                        <Badge>{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}