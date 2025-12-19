import { describe, it, expect, vi, beforeEach } from 'vitest'
import ContactHubAI from '../contact-hub-ai'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Mock fetch
global.fetch = vi.fn()

// Mock Firebase modules
vi.mock('../firebase', () => ({
  default: { type: 'firebase-app-mock' }
}))

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn(() => Promise.resolve('mock-token'))
    }
  }))
}))

vi.mock('../metrics', () => ({
  metricsService: {
    trackAIAction: vi.fn()
  }
}))

describe('ContactHubAI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.mocked(getFunctions).mockReset()
    vi.mocked(httpsCallable).mockReset()
  })

  describe('generatePersonalizedMessage', () => {
    it('should generate message using Firebase Functions when available', async () => {
      vi.mocked(getFunctions).mockReturnValue('mock-functions')
      const mockCallable = vi.fn(() => Promise.resolve({
        data: {
          message: 'AI generated message',
          generatedAt: new Date()
        }
      }))
      vi.mocked(httpsCallable).mockReturnValue(mockCallable)

      const result = await ContactHubAI.generatePersonalizedMessage(
        'Test Group',
        'Background info',
        5,
        undefined,
        'test-group-id'
      )

      expect(result).toBe('AI generated message')
      expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'generateGroupMessage')
      expect(mockCallable).toHaveBeenCalledWith({ groupId: 'test-group-id' })
    })

    it('should fallback to template when Firebase Functions not available', async () => {
      vi.mocked(getFunctions).mockImplementation(() => {
        throw new Error('Functions not available')
      })

      const result = await ContactHubAI.generatePersonalizedMessage(
        'Test Group',
        'Background info',
        5
      )

      expect(result).toMatch(/Test Group/)
      expect(result).toMatch(/Background info/)
    })

    it('should fallback on Firebase Functions error', async () => {
      vi.mocked(getFunctions).mockReturnValue('mock-functions')
      const mockCallable = vi.fn(() => Promise.reject(new Error('AI service error')))
      vi.mocked(httpsCallable).mockReturnValue(mockCallable)

      const result = await ContactHubAI.generatePersonalizedMessage(
        'Test Group',
        'Background info',
        5
      )

      expect(result).toMatch(/Test Group/)
      expect(result).toMatch(/Background info/)
    })

    it('should handle empty background info', async () => {
      vi.mocked(getFunctions).mockImplementation(() => {
        throw new Error('Functions not available')
      })

      const result = await ContactHubAI.generatePersonalizedMessage(
        'Test Group',
        '',
        5
      )

      expect(result).toMatch(/Test Group/)
    })

    it('should handle empty group name', async () => {
      vi.mocked(getFunctions).mockImplementation(() => {
        throw new Error('Functions not available')
      })

      const result = await ContactHubAI.generatePersonalizedMessage(
        '',
        'Background info',
        5
      )

      expect(result).toMatch(/Background info/)
    })
  })

  describe('categorizeContact', () => {
    it('should categorize contact using Firebase Functions when available', async () => {
      vi.mocked(getFunctions).mockReturnValue('mock-functions')

      // Mock fetch for the categorizeContactV2 call
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn(() => Promise.resolve(JSON.stringify({
          categories: ['Business', 'VIP'],
          tags: ['client', 'important'],
          reasoning: 'AI categorization'
        }))),
        headers: new Map()
      }
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

      const result = await ContactHubAI.categorizeContact(
        'John Doe',
        'john@example.com',
        '+1234567890',
        'Important client',
        undefined,
        'test-contact-id'
      )

      expect(result.categories).toEqual(['Business', 'VIP'])
      expect(result.tags).toEqual(['client', 'important'])
      expect(result.reasoning).toBe('AI categorization')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://us-central1-contacthub-29950.cloudfunctions.net/categorizeContactV2',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          }),
          body: JSON.stringify({ contactId: 'test-contact-id' })
        })
      )
    })

    it('should fallback to default categorization when Firebase Functions not available', async () => {
      vi.mocked(getFunctions).mockImplementation(() => {
        throw new Error('Functions not available')
      })

      const result = await ContactHubAI.categorizeContact(
        'John Doe',
        'john@example.com',
        '+1234567890',
        'Important client'
      )

      expect(result.categories).toEqual(['General'])
      expect(result.tags).toEqual(['contact'])
      expect(result.reasoning).toBe('AI service temporarily unavailable - using fallback categorization')
    })

    it('should fallback on Firebase Functions error', async () => {
      vi.mocked(getFunctions).mockReturnValue('mock-functions')
      const mockCallable = vi.fn(() => Promise.reject(new Error('AI service error')))
      vi.mocked(httpsCallable).mockReturnValue(mockCallable)

      const result = await ContactHubAI.categorizeContact(
        'John Doe'
      )

      expect(result.categories).toEqual(['General'])
      expect(result.tags).toEqual(['contact'])
      expect(result.reasoning).toBe('AI service temporarily unavailable - using fallback categorization')
    })

    it('should handle contact with minimal information', async () => {
      vi.mocked(getFunctions).mockImplementation(() => {
        throw new Error('Functions not available')
      })

      const result = await ContactHubAI.categorizeContact('Jane')

      expect(result.categories).toEqual(['General'])
      expect(result.tags).toEqual(['contact'])
    })

    it('should handle contact with existing tags', async () => {
      vi.mocked(getFunctions).mockImplementation(() => {
        throw new Error('Functions not available')
      })

      const result = await ContactHubAI.categorizeContact(
        'John Doe',
        undefined,
        undefined,
        undefined,
        ['existing-tag']
      )

      expect(result.categories).toEqual(['General'])
      expect(result.tags).toEqual(['contact'])
    })
  })

  describe('analyzeCommunicationPatterns', () => {
    it('should return fallback analysis', async () => {
      const result = await ContactHubAI.analyzeCommunicationPatterns(
        'test-contact-id',
        'John Doe',
        [],
        '2024-01-01',
        'professional'
      )

      expect(result).toEqual({
        frequency: 'Regular',
        preferredMethod: 'Email',
        nextContactSuggestion: 'Within 2 weeks',
        insights: ['AI analysis temporarily unavailable']
      })
    })

    it('should handle empty message logs', async () => {
      const result = await ContactHubAI.analyzeCommunicationPatterns(
        'test-contact-id',
        'John Doe',
        [],
        '2024-01-01'
      )

      expect(result.frequency).toBe('Regular')
      expect(result.preferredMethod).toBe('Email')
    })

    it('should handle different relationship types', async () => {
      const result = await ContactHubAI.analyzeCommunicationPatterns(
        'test-contact-id',
        'John Doe',
        [],
        '2024-01-01',
        'personal'
      )

      expect(result.frequency).toBe('Regular')
    })
  })

  describe('suggestContactTime', () => {
    it('should return fallback scheduling suggestion', async () => {
      const result = await ContactHubAI.suggestContactTime(
        'test-contact-id',
        'John Doe',
        'UTC',
        ['9:00 AM'],
        'professional'
      )

      expect(result).toEqual({
        recommendedTime: 'Next business day, 9 AM',
        reasoning: 'AI scheduling temporarily unavailable',
        alternatives: ['Tomorrow 2 PM', 'Friday 10 AM']
      })
    })

    it('should handle minimal parameters', async () => {
      const result = await ContactHubAI.suggestContactTime('test-contact-id', 'John Doe')

      expect(result.recommendedTime).toBe('Next business day, 9 AM')
      expect(result.alternatives).toHaveLength(2)
    })

    it('should handle different timezones', async () => {
      const result = await ContactHubAI.suggestContactTime(
        'test-contact-id',
        'John Doe',
        'America/New_York'
      )

      expect(result.recommendedTime).toBe('Next business day, 9 AM')
    })
  })

  describe('generateContactSummary', () => {
    it('should return basic summary', async () => {
      const contact = { name: 'John Doe', email: 'john@example.com' }
      const interactions = []

      const result = await ContactHubAI.generateContactSummary(contact, interactions)

      expect(result).toBe('John Doe - Contact details available.')
    })

    it('should handle contact without name', async () => {
      const contact = { email: 'john@example.com' }
      const interactions = []

      const result = await ContactHubAI.generateContactSummary(contact, interactions)

      expect(result).toBe('undefined - Contact details available.')
    })

    it('should handle empty contact object', async () => {
      const result = await ContactHubAI.generateContactSummary({}, [])

      expect(result).toBe('undefined - Contact details available.')
    })
  })
})