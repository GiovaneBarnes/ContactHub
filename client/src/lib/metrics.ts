import { analytics } from './firebase';
import { logEvent, setUserProperties, setUserId } from 'firebase/analytics';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getAuth } from 'firebase/auth';

export interface MetricEvent {
  eventType: string;
  category: 'user' | 'contact' | 'group' | 'message' | 'ai' | 'system';
  action: string;
  properties?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId: string;
}

export interface UserMetrics {
  totalContacts: number;
  totalGroups: number;
  messagesSent: number;
  aiRequests: number;
  loginCount: number;
  lastActive: Date;
  sessionDuration: number;
  featureUsage: Record<string, number>;
  emailCount?: number;
}

export interface AnalyticsPrediction {
  userId: string;
  predictionType: 'churn_risk' | 'engagement_score' | 'feature_adoption' | 'contact_growth';
  probability: number;
  confidence: number;
  factors: string[];
  predictedDate: Date;
  actualOutcome?: boolean;
}

class MetricsService {
  private sessionId: string;
  private sessionStart: Date;
  private userId: string | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStart = new Date();

    // Listen for auth state changes
    getAuth().onAuthStateChanged((user) => {
      this.userId = user?.uid || null;
      if (user && analytics) {
        setUserId(analytics, user.uid);
        this.trackEvent('user', 'login', { method: 'firebase' });
      }
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Track custom events
  async trackEvent(
    category: MetricEvent['category'],
    action: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    try {
      const event: MetricEvent = {
        eventType: `${category}_${action}`,
        category,
        action,
        properties,
        timestamp: new Date(),
        userId: this.userId || undefined,
        sessionId: this.sessionId
      };

      // Store in Firestore for detailed analytics (only if user is authenticated)
      let firestoreSuccess = false;
      if (this.userId) {
        try {
          await addDoc(collection(db, 'analytics_events'), {
            ...event,
            timestamp: Timestamp.fromDate(event.timestamp)
          });
          firestoreSuccess = true;
        } catch (firestoreError) {
          const errorMessage = firestoreError instanceof Error ? firestoreError.message : 'Unknown error';
        }
      }

      // Send to Firebase Analytics (always try this, it's client-side)
      if (analytics) {
        try {
          logEvent(analytics, event.eventType, {
            ...properties,
            category,
            session_id: this.sessionId,
            user_id: this.userId
          });
        } catch (analyticsError) {
          // Analytics failed but Firestore succeeded - continue silently
          // Don't throw - analytics failures shouldn't break the app
        }
      }

    } catch (error) {
      // Analytics tracking failed - continue silently to not break the app
    }
  }

  // User engagement tracking
  async trackUserEngagement(action: string, properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('user', action, properties);
  }

  // Contact management tracking
  async trackContactAction(action: 'create' | 'update' | 'delete' | 'import' | 'export', properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('contact', action, properties);
  }

  // Group management tracking
  async trackGroupAction(action: 'create' | 'update' | 'delete' | 'schedule', properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('group', action, properties);
  }

  // Message tracking
  async trackMessageAction(action: 'send' | 'schedule' | 'cancel', properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('message', action, properties);
  }

  // AI feature tracking
  async trackAIAction(action: 'generate_message' | 'categorize_contact' | 'analyze_communication', properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('ai', action, properties);
  }

  // System performance tracking
  async trackSystemAction(action: 'page_load' | 'api_call' | 'error', properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('system', action, properties);
  }

  // Page view tracking
  async trackPageView(page: string, properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('user', 'page_view', { page, ...properties });
  }

  // Feature usage tracking
  async trackFeatureUsage(feature: string, properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('user', 'feature_use', { feature, ...properties });
  }

  // Session tracking
  endSession(): void {
    const duration = Date.now() - this.sessionStart.getTime();
    this.trackEvent('user', 'session_end', {
      duration_ms: duration,
      duration_minutes: Math.round(duration / 60000)
    });
  }

  // Analytics queries
  async getUserMetrics(userId: string, days: number = 30): Promise<UserMetrics> {
    try {

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const eventsQuery = query(
        collection(db, 'analytics_events'),
        where('userId', '==', userId),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      const events = await getDocs(eventsQuery);
      const eventData = events.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp
        };
      }) as MetricEvent[];


      // Calculate metrics
      const metrics: UserMetrics = {
        totalContacts: eventData.filter(e => e.category === 'contact' && e.action === 'create').length,
        totalGroups: eventData.filter(e => e.category === 'group' && e.action === 'create').length,
        messagesSent: eventData.filter(e => e.category === 'message' && e.action === 'send').length,
        aiRequests: eventData.filter(e => e.category === 'ai').length,
        loginCount: eventData.filter(e => e.category === 'user' && e.action === 'login').length,
        lastActive: eventData[0]?.timestamp || new Date(),
        sessionDuration: 0, // Calculate from session events
        featureUsage: {},
        emailCount: eventData.filter(e => e.category === 'message' && e.action === 'send' && e.properties?.channels?.includes('email')).length
      };

      // Calculate feature usage
      eventData.forEach(event => {
        if (event.category === 'user' && event.action === 'feature_use') {
          const feature = event.properties?.feature;
          if (feature) {
            metrics.featureUsage[feature] = (metrics.featureUsage[feature] || 0) + 1;
          }
        }
      });

      return metrics;

    } catch (error) {
      // Return default metrics if we can't fetch analytics
      return {
        totalContacts: 0,
        totalGroups: 0,
        messagesSent: 0,
        aiRequests: 0,
        loginCount: 1, // At least 1 since they're logged in now
        lastActive: new Date(),
        sessionDuration: 0,
        featureUsage: {},
        emailCount: 0
      };
    }
  }

  // Prediction engine
  async generatePredictions(userId: string): Promise<AnalyticsPrediction[]> {
    const metrics = await this.getUserMetrics(userId, 90); // 90 days of data

    const predictions: AnalyticsPrediction[] = [];

    // Churn risk prediction
    const churnRisk = this.calculateChurnRisk(metrics);
    if (churnRisk.probability > 0.3) {
      predictions.push({
        userId,
        predictionType: 'churn_risk',
        probability: churnRisk.probability,
        confidence: churnRisk.confidence,
        factors: churnRisk.factors,
        predictedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
    }

    // Engagement score prediction
    const engagementScore = this.calculateEngagementScore(metrics);
    predictions.push({
      userId,
      predictionType: 'engagement_score',
      probability: engagementScore.score,
      confidence: engagementScore.confidence,
      factors: engagementScore.factors,
      predictedDate: new Date()
    });

    // Feature adoption prediction
    const featureAdoption = this.predictFeatureAdoption(metrics);
    if (featureAdoption.probability > 0.5) {
      predictions.push({
        userId,
        predictionType: 'feature_adoption',
        probability: featureAdoption.probability,
        confidence: featureAdoption.confidence,
        factors: featureAdoption.factors,
        predictedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      });
    }

    // Contact growth prediction
    const contactGrowth = this.predictContactGrowth(metrics);
    predictions.push({
      userId,
      predictionType: 'contact_growth',
      probability: contactGrowth.growthRate,
      confidence: contactGrowth.confidence,
      factors: contactGrowth.factors,
      predictedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    return predictions;
  }

  private calculateChurnRisk(metrics: UserMetrics): { probability: number; confidence: number; factors: string[] } {
    let riskScore = 0;
    const factors: string[] = [];

    // Low activity indicators
    if (metrics.loginCount < 5) {
      riskScore += 0.3;
      factors.push('Low login frequency');
    }

    if (metrics.lastActive.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      riskScore += 0.4;
      factors.push('Inactive for 7+ days');
    }

    if (Object.keys(metrics.featureUsage).length < 3) {
      riskScore += 0.2;
      factors.push('Limited feature usage');
    }

    return {
      probability: Math.min(riskScore, 1),
      confidence: 0.8,
      factors
    };
  }

  private calculateEngagementScore(metrics: UserMetrics): { score: number; confidence: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];

    // Positive indicators
    if (metrics.loginCount > 10) {
      score += 0.3;
      factors.push('High login frequency');
    }

    if (metrics.messagesSent > 20) {
      score += 0.25;
      factors.push('Active messaging');
    }

    if (metrics.aiRequests > 10) {
      score += 0.2;
      factors.push('AI feature usage');
    }

    if (metrics.totalContacts > 50) {
      score += 0.15;
      factors.push('Large contact database');
    }

    if (Object.keys(metrics.featureUsage).length > 5) {
      score += 0.1;
      factors.push('Diverse feature usage');
    }

    return {
      score: Math.min(score, 1),
      confidence: 0.85,
      factors
    };
  }

  private predictFeatureAdoption(metrics: UserMetrics): { probability: number; confidence: number; factors: string[] } {
    const factors: string[] = [];
    let probability = 0;

    // Users with high engagement are more likely to adopt new features
    if (metrics.loginCount > 15) {
      probability += 0.3;
      factors.push('High engagement indicates feature curiosity');
    }

    if (metrics.aiRequests > 5) {
      probability += 0.4;
      factors.push('Already using AI features');
    }

    if (metrics.totalGroups > 5) {
      probability += 0.2;
      factors.push('Active group management suggests feature adoption');
    }

    return {
      probability: Math.min(probability, 1),
      confidence: 0.75,
      factors
    };
  }

  private predictContactGrowth(metrics: UserMetrics): { growthRate: number; confidence: number; factors: string[] } {
    const factors: string[] = [];
    let growthRate = 0.1; // Base growth rate

    // Recent activity boosts growth prediction
    if (metrics.lastActive.getTime() > Date.now() - 24 * 60 * 60 * 1000) {
      growthRate += 0.2;
      factors.push('Recent activity');
    }

    if (metrics.loginCount > 20) {
      growthRate += 0.15;
      factors.push('High engagement');
    }

    if (metrics.totalContacts > 100) {
      growthRate += 0.1;
      factors.push('Large existing contact base');
    }

    return {
      growthRate: Math.min(growthRate, 1),
      confidence: 0.7,
      factors
    };
  }
}

// Export singleton instance
export const metricsService = new MetricsService();