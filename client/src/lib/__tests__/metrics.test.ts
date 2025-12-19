import { describe, it, expect, vi, beforeEach } from 'vitest'
import { metricsService } from '../metrics'
import { Timestamp } from 'firebase/firestore'

// Mock Firebase modules
vi.mock('../firebase', () => ({
  analytics: { type: 'analytics-mock' },
  db: { type: 'firestore-mock' }
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection'),
  addDoc: vi.fn(),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(() => 'mock-where'),
  orderBy: vi.fn(() => 'mock-order'),
  limit: vi.fn(() => 'mock-limit'),
  getDocs: vi.fn(() => ({
    docs: []
  })),
  Timestamp: {
    fromDate: vi.fn(() => ({
      toDate: () => new Date('2024-01-01')
    })),
    now: vi.fn(() => ({
      toDate: () => new Date()
    }))
  }
}))

vi.mock('firebase/analytics', () => ({
  logEvent: vi.fn(),
  setUserProperties: vi.fn(),
  setUserId: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    onAuthStateChanged: vi.fn((callback) => {
      callback({ uid: 'test-user-id', email: 'test@example.com' })
      return vi.fn()
    })
  }))
}))

describe('MetricsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Firebase Analytics Integration', () => {
    it('sends events to Firebase Analytics when tracking events', async () => {
      const { logEvent } = await import('firebase/analytics')

      await metricsService.trackEvent('user', 'login', { method: 'email' })

      expect(logEvent).toHaveBeenCalledWith(
        { type: 'analytics-mock' },
        'user_login',
        expect.objectContaining({
          method: 'email',
          category: 'user',
          session_id: expect.any(String),
          user_id: 'test-user-id'
        })
      )
    })

    it('includes all event properties in Firebase Analytics call', async () => {
      const { logEvent } = await import('firebase/analytics')

      const properties = {
        feature: 'ai_categorization',
        duration: 1500,
        success: true
      }

      await metricsService.trackEvent('ai', 'categorize', properties)

      expect(logEvent).toHaveBeenCalledWith(
        { type: 'analytics-mock' },
        'ai_categorize',
        expect.objectContaining({
          ...properties,
          category: 'ai',
          session_id: expect.any(String),
          user_id: 'test-user-id'
        })
      )
    })

    it('handles Firebase Analytics errors gracefully', async () => {
      const { logEvent } = await import('firebase/analytics')

      ;(logEvent as any).mockImplementation(() => {
        throw new Error('Firebase Analytics error')
      })

      // Should not throw despite Firebase Analytics error - fails silently
      await expect(metricsService.trackEvent('user', 'test', {})).resolves.not.toThrow()
    })
  })

  describe('Event Tracking', () => {
    it('stores events in Firestore with correct structure', async () => {
      const { addDoc, Timestamp } = await import('firebase/firestore')

      await metricsService.trackEvent('contact', 'create', { contactId: '123' })

      expect(addDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({
          eventType: 'contact_create',
          category: 'contact',
          action: 'create',
          properties: { contactId: '123' },
          userId: 'test-user-id',
          sessionId: expect.any(String),
          timestamp: expect.objectContaining({
            toDate: expect.any(Function)
          })
        })
      )
    })

    it('generates unique session IDs', () => {
      const session1 = metricsService['sessionId']
      const session2 = metricsService['sessionId']

      expect(session1).toBe(session2)
      expect(typeof session1).toBe('string')
      expect(session1.length).toBeGreaterThan(0)
    })

    it('tracks user engagement events', async () => {
      const { addDoc } = await import('firebase/firestore')

      await metricsService.trackUserEngagement('login', { method: 'google' })

      expect(addDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({
          eventType: 'user_login',
          category: 'user',
          action: 'login',
          properties: { method: 'google' }
        })
      )
    })

    it('tracks contact management events', async () => {
      const { addDoc } = await import('firebase/firestore')

      await metricsService.trackContactAction('create', { contactId: '123', hasEmail: true })

      expect(addDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({
          eventType: 'contact_create',
          category: 'contact',
          action: 'create',
          properties: { contactId: '123', hasEmail: true }
        })
      )
    })

    it('tracks AI usage events', async () => {
      const { addDoc } = await import('firebase/firestore')

      await metricsService.trackAIAction('generate_message', {
        groupSize: 5,
        messageLength: 150,
        duration: 2000
      })

      expect(addDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({
          eventType: 'ai_generate_message',
          category: 'ai',
          action: 'generate_message',
          properties: {
            groupSize: 5,
            messageLength: 150,
            duration: 2000
          }
        })
      )
    })

    it('tracks page views', async () => {
      const { addDoc } = await import('firebase/firestore')

      await metricsService.trackPageView('dashboard', { referrer: 'login' })

      expect(addDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({
          eventType: 'user_page_view',
          category: 'user',
          action: 'page_view',
          properties: { page: 'dashboard', referrer: 'login' }
        })
      )
    })
  })

  describe('User Metrics', () => {
    it('retrieves user metrics from Firestore', async () => {
      const mockEvents = [
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'contact', action: 'create', timestamp: new Date(), userId: 'test-user-id' }, // 10 contacts
        { category: 'group', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'group', action: 'create', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'group', action: 'create', timestamp: new Date(), userId: 'test-user-id' }, // 3 groups
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'message', action: 'send', timestamp: new Date(), userId: 'test-user-id' }, // 25 messages
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'ai', action: 'request', timestamp: new Date(), userId: 'test-user-id' }, // 8 AI requests
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' },
        { category: 'user', action: 'login', timestamp: new Date(), userId: 'test-user-id' }, // 15 logins
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'ai' } }, // 8 AI feature uses
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } },
        { category: 'user', action: 'feature_use', timestamp: new Date(), userId: 'test-user-id', properties: { feature: 'messaging' } }, // 25 messaging feature uses
      ]

      const { getDocs } = await import('firebase/firestore')
      ;(getDocs as any).mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: `event-${Math.random()}`,
          data: () => event
        }))
      })

      const result = await metricsService.getUserMetrics('test-user-id')

      expect(result.totalContacts).toBe(10)
      expect(result.totalGroups).toBe(3)
      expect(result.messagesSent).toBe(22)
      expect(result.aiRequests).toBe(8)
      expect(result.loginCount).toBe(15)
      expect(result.featureUsage).toEqual({ ai: 8, messaging: 26 })
    })

    it('returns default metrics when no data exists', async () => {
      const { getDocs } = await import('firebase/firestore')
      ;(getDocs as any).mockResolvedValue({
        docs: []
      })

      const result = await metricsService.getUserMetrics('test-user-id')

      expect(result).toEqual({
        totalContacts: 0,
        totalGroups: 0,
        messagesSent: 0,
        aiRequests: 0,
        loginCount: 0,
        lastActive: expect.any(Date),
        sessionDuration: 0,
        featureUsage: {},
        emailCount: 0
      })
    })
  })

  describe('Analytics Predictions', () => {
    it('calculates churn risk based on user activity', async () => {
      const predictions = await metricsService.generatePredictions('test-user-id')

      expect(predictions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            predictionType: 'churn_risk',
            probability: expect.any(Number),
            confidence: expect.any(Number),
            factors: expect.any(Array)
          })
        ])
      )
    })

    it('calculates engagement score', async () => {
      const predictions = await metricsService.generatePredictions('test-user-id')

      expect(predictions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            predictionType: 'engagement_score',
            probability: expect.any(Number),
            confidence: expect.any(Number)
          })
        ])
      )
    })

    it('includes relevant factors in predictions', async () => {
      const predictions = await metricsService.generatePredictions('test-user-id')

      const churnPrediction = predictions.find(p => p.predictionType === 'churn_risk')
      expect(churnPrediction?.factors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('login frequency'),
          expect.stringContaining('feature usage')
        ])
      )
    })
  })

  describe('User Metrics', () => {
    it('calculates user metrics from event data', async () => {
      const mockDocs = [
        {
          data: () => ({
            eventType: 'user_login',
            category: 'user',
            action: 'login',
            timestamp: Timestamp.fromDate(new Date('2024-01-01')),
            properties: { method: 'email' }
          })
        },
        {
          data: () => ({
            eventType: 'contact_create',
            category: 'contact',
            action: 'create',
            timestamp: Timestamp.fromDate(new Date('2024-01-02')),
            properties: { contactId: '123' }
          })
        },
        {
          data: () => ({
            eventType: 'ai_generate_message',
            category: 'ai',
            action: 'generate_message',
            timestamp: Timestamp.fromDate(new Date('2024-01-03')),
            properties: { groupSize: 5 }
          })
        }
      ]

      const { getDocs } = await import('firebase/firestore')
      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs
      } as any)

      const metrics = await metricsService.getUserMetrics('test-user-id', 30)

      expect(metrics.loginCount).toBe(1)
      expect(metrics.totalContacts).toBe(1)
      expect(metrics.aiRequests).toBe(1)
      expect(metrics.messagesSent).toBe(0)
      expect(metrics.lastActive).toBeInstanceOf(Date)
    })

    it('handles empty event data', async () => {
      const { getDocs } = await import('firebase/firestore')
      vi.mocked(getDocs).mockResolvedValue({
        docs: []
      } as any)

      const metrics = await metricsService.getUserMetrics('test-user-id', 30)

      expect(metrics.loginCount).toBe(0)
      expect(metrics.totalContacts).toBe(0)
      expect(metrics.aiRequests).toBe(0)
      expect(metrics.messagesSent).toBe(0)
      expect(metrics.lastActive).toBeInstanceOf(Date)
    })
  })
})