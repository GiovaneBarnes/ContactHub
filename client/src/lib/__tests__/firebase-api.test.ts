import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { firebaseApi } from '../firebase-api'

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection'),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(() => 'mock-where'),
  orderBy: vi.fn(() => 'mock-order'),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  Timestamp: class MockTimestamp {
    constructor(seconds: number, nanoseconds: number) {}
    toDate() {
      return new Date('2024-01-01T00:00:00Z');
    }
    static fromDate(date: Date) {
      return new MockTimestamp(0, 0);
    }
    static now() {
      return new MockTimestamp(0, 0);
    }
  }
}))

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => 'mock-functions'),
  httpsCallable: vi.fn(() => vi.fn(() => Promise.reject(new Error('SMS failed'))))
}))

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { 
      uid: 'test-user-id', 
      email: 'test@example.com', 
      displayName: 'Test User',
      getIdToken: vi.fn(() => Promise.resolve('mock-id-token'))
    },
    onAuthStateChanged: vi.fn((callback) => {
      callback({ 
        uid: 'test-user-id', 
        email: 'test@example.com', 
        displayName: 'Test User',
        getIdToken: vi.fn(() => Promise.resolve('mock-id-token'))
      })
      return vi.fn()
    })
  }))
}))

vi.mock('../firebase', () => ({
  db: { type: 'firestore-mock' },
  auth: { type: 'auth-mock' },
  functions: { type: 'functions-mock' },
  firebaseApp: { type: 'firebase-app-mock' },
  analytics: { 
    type: 'analytics-mock',
    options: { projectId: 'test-project' },
    app: { options: { projectId: 'test-project' } }
  }
}))

// Mock fetch for SMS sending
global.fetch = vi.fn()

// Mock ContactHubAI
vi.mock('../contact-hub-ai', () => ({
  default: {
    categorizeContact: vi.fn(() => Promise.resolve({
      categories: ['Business'],
      tags: ['client'],
      reasoning: 'AI categorization'
    })),
    generatePersonalizedMessage: vi.fn((groupName) => Promise.resolve(`AI generated message for ${groupName}`)),
    analyzeCommunicationPatterns: vi.fn(() => Promise.resolve({
      frequency: 'Regular',
      preferredMethod: 'Email',
      nextContactSuggestion: 'Within 2 weeks',
      insights: ['AI analysis']
    })),
    suggestContactTime: vi.fn(() => Promise.resolve({
      recommendedTime: 'Next business day, 9 AM',
      reasoning: 'AI scheduling',
      alternatives: ['Tomorrow 2 PM', 'Friday 10 AM']
    })),
    generateContactSummary: vi.fn(() => Promise.resolve('AI generated summary'))
  }
}))

// Mock data
const mockContact = {
  id: 'doc-1',
  name: 'John Doe',
  phone: '+1234567890',
  email: 'john@example.com',
  notes: 'Test contact'
}

const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  description: 'A test group',
  contactIds: ['contact-1'],
  schedules: [],
  backgroundInfo: 'Test background',
  enabled: true
}

const mockDoc = {
  id: 'doc-1',
  data: () => mockContact
}

describe('Firebase API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Contacts API', () => {
    it('should list contacts', async () => {
      const mockSnapshot = {
        docs: [mockDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)
      vi.mocked(query).mockReturnValue('mock-query' as any)
      vi.mocked(orderBy).mockReturnValue('mock-order' as any)

      const result = await firebaseApi.contacts.list()

      expect(collection).toHaveBeenCalledWith({ type: 'firestore-mock' }, 'contacts')
      expect(query).toHaveBeenCalled()
      expect(orderBy).toHaveBeenCalledWith('name')
      expect(result).toEqual([mockContact])
    })

    it('should create contact', async () => {
      const newContact = {
        name: 'Jane Doe',
        phone: '+0987654321',
        email: 'jane@example.com',
        notes: 'New contact'
      }

      const mockDocRef = { id: 'new-contact-id' }
      vi.mocked(addDoc).mockResolvedValue(mockDocRef as any)

      const result = await firebaseApi.contacts.create(newContact)

      expect(collection).toHaveBeenCalledWith({ type: 'firestore-mock' }, 'contacts')
      expect(addDoc).toHaveBeenCalledWith('mock-collection', {
        ...newContact,
        userId: 'test-user-id',
        createdAt: 'server-timestamp'
      })
      expect(result).toEqual({
        id: 'new-contact-id',
        ...newContact
      })
    })

    it('should update contact', async () => {
      const updates = { name: 'Updated Name' }
      vi.mocked(doc).mockReturnValue('mock-doc-ref' as any)

      const result = await firebaseApi.contacts.update('contact-1', updates)

      expect(doc).toHaveBeenCalledWith({ type: 'firestore-mock' }, 'contacts', 'contact-1')
      expect(updateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...updates,
        updatedAt: 'server-timestamp'
      })
      expect(result).toEqual({
        id: 'contact-1',
        ...updates
      })
    })

    it('should throw error when creating contact without authentication', async () => {
      // Mock getAuth to return null currentUser
      const { getAuth } = await import('firebase/auth')
      const mockGetAuth = vi.mocked(getAuth)
      mockGetAuth.mockReturnValueOnce({
        currentUser: null
      } as any)

      const newContact = {
        name: 'Jane Doe',
        phone: '+0987654321',
        email: 'jane@example.com',
        notes: 'New contact'
      }

      await expect(firebaseApi.contacts.create(newContact)).rejects.toThrow('User not authenticated')
    })
  })

  describe('Groups API', () => {
    it('should list groups', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => mockGroup
      }

      const mockSnapshot = {
        docs: [mockGroupDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const result = await firebaseApi.groups.list()

      expect(result).toEqual([mockGroup])
    })

    it('should get specific group', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => mockGroup
      }

      const mockSnapshot = {
        docs: [mockGroupDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const result = await firebaseApi.groups.get('group-1')

      expect(result).toEqual(mockGroup)
    })

    it('should return undefined for non-existent group', async () => {
      const mockSnapshot = {
        docs: []
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const result = await firebaseApi.groups.get('non-existent')

      expect(result).toBeUndefined()
    })

    it('should create group', async () => {
      const newGroup = {
        name: 'New Group',
        description: 'A new test group',
        contactIds: [],
        schedules: [],
        backgroundInfo: 'New background',
        enabled: true
      }

      const mockDocRef = { id: 'new-group-id' }
      vi.mocked(addDoc).mockResolvedValue(mockDocRef as any)

      const result = await firebaseApi.groups.create(newGroup)

      expect(result).toEqual({
        id: 'new-group-id',
        ...newGroup
      })
    })

    it('should create schedule for group', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => mockGroup
      }

      const mockSnapshot = {
        docs: [mockGroupDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const newSchedule = {
        type: 'one-time' as const,
        startDate: '2025-12-25',
        message: 'Merry Christmas!',
        enabled: true
      }

      const result = await firebaseApi.groups.createSchedule('group-1', newSchedule)

      expect(result.schedules).toHaveLength(1)
      expect(result.schedules[0]).toMatchObject(newSchedule)
      expect(result.schedules[0].id).toBeDefined()
    })

    it('should update schedule', async () => {
      const groupWithSchedule = {
        ...mockGroup,
        schedules: [{ id: 'schedule-1', type: 'one-time' as const, startDate: '2025-12-25', message: 'Test', enabled: true }]
      }

      const mockGroupDoc = {
        id: 'group-1',
        data: () => groupWithSchedule
      }

      const mockSnapshot = {
        docs: [mockGroupDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const updates = { message: 'Updated message' }
      const result = await firebaseApi.groups.updateSchedule('group-1', 'schedule-1', updates)

      expect(result.schedules[0].message).toBe('Updated message')
    })

    it('should throw error when updating schedule for non-existent group', async () => {
      const mockSnapshot = {
        docs: []
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const updates = { message: 'Updated message' }
      await expect(firebaseApi.groups.updateSchedule('non-existent', 'schedule-1', updates)).rejects.toThrow('Group not found')
    })

    it('should delete schedule', async () => {
      const groupWithSchedule = {
        ...mockGroup,
        schedules: [{ id: 'schedule-1', type: 'one-time' as const, startDate: '2025-12-25', message: 'Test', enabled: true }]
      }

      const mockGroupDoc = {
        id: 'group-1',
        data: () => groupWithSchedule
      }

      const mockSnapshot = {
        docs: [mockGroupDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const result = await firebaseApi.groups.deleteSchedule('group-1', 'schedule-1')

      expect(result.schedules).toHaveLength(0)
    })
  })

  describe('Logs API', () => {
    it('should list message logs', async () => {
      const mockLogDoc = {
        id: 'log-1',
        data: () => ({
          groupId: 'group-1',
          groupName: 'Test Group',
          messageContent: 'Test message',
          recipients: 5,
          timestamp: Timestamp.now(),
          status: 'sent'
        })
      }

      const mockSnapshot = {
        docs: [mockLogDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      const result = await firebaseApi.logs.list()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'log-1',
        groupId: 'group-1',
        groupName: 'Test Group',
        messageContent: 'Test message',
        recipients: 5,
        status: 'sent'
      })
    })
  })

  describe('AI API', () => {
    it('should generate message for group', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => mockGroup
      }

      const mockLogsSnapshot = {
        docs: [
          {
            data: () => ({
              timestamp: {
                toDate: () => new Date('2024-01-01T10:00:00Z')
              }
            })
          }
        ]
      }

      const mockSnapshot = {
        docs: [mockGroupDoc]
      }

      vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot as any)
      vi.mocked(getDocs).mockResolvedValueOnce(mockLogsSnapshot as any)

      const result = await firebaseApi.ai.generateMessage('group-1')

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('Test Group')
    })

    it('should throw error for non-existent group', async () => {
      const mockSnapshot = {
        docs: []
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      await expect(firebaseApi.ai.generateMessage('non-existent')).rejects.toThrow('Group not found')
    })

    it('should categorize contact', async () => {
      const mockContactDoc = {
        id: 'contact-1',
        data: () => mockContact
      }

      const mockSnapshot = {
        docs: [mockContactDoc]
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      // Mock fetch for categorizeContact
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn(() => Promise.resolve(JSON.stringify({
          categories: ['Business'],
          tags: ['client'],
          reasoning: 'AI categorization'
        }))),
        headers: new Map()
      }
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

      const result = await firebaseApi.contacts.categorizeContact('contact-1')

      expect(result).toHaveProperty('categories')
      expect(result).toHaveProperty('tags')
      expect(result).toHaveProperty('reasoning')
      expect(Array.isArray(result.categories)).toBe(true)
      expect(Array.isArray(result.tags)).toBe(true)
    })

    it('should analyze communication patterns', async () => {
      const mockContactDoc = {
        id: 'contact-1',
        data: () => mockContact
      }

      const mockLogsSnapshot = {
        docs: [
          {
            data: () => ({
              timestamp: {
                toDate: () => new Date('2024-01-01T10:00:00Z')
              },
              type: 'email',
              content: 'Test message'
            })
          }
        ]
      }

      const mockSnapshot = {
        docs: [mockContactDoc]
      }

      vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot as any)
      vi.mocked(getDocs).mockResolvedValueOnce(mockLogsSnapshot as any)

      const result = await firebaseApi.ai.analyzeCommunicationPatterns('contact-1')

      expect(result).toHaveProperty('frequency')
      expect(result).toHaveProperty('preferredMethod')
      expect(result).toHaveProperty('nextContactSuggestion')
      expect(result).toHaveProperty('insights')
      expect(Array.isArray(result.insights)).toBe(true)
    })

    it('should suggest contact time', async () => {
      const mockContactDoc = {
        id: 'contact-1',
        data: () => mockContact
      }

      const mockLogsSnapshot = {
        docs: [
          {
            data: () => ({
              timestamp: {
                toDate: () => new Date('2024-01-01T10:00:00Z')
              }
            })
          }
        ]
      }

      const mockSnapshot = {
        docs: [mockContactDoc]
      }

      vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot as any)
      vi.mocked(getDocs).mockResolvedValueOnce(mockLogsSnapshot as any)

      const result = await firebaseApi.ai.suggestContactTime('contact-1')

      expect(result).toHaveProperty('recommendedTime')
      expect(result).toHaveProperty('reasoning')
      expect(result).toHaveProperty('alternatives')
      expect(Array.isArray(result.alternatives)).toBe(true)
    })

    it('should generate contact summary', async () => {
      const mockContactDoc = {
        id: 'contact-1',
        data: () => mockContact
      }

      const mockLogsSnapshot = {
        docs: [
          {
            data: () => ({
              timestamp: {
                toDate: () => new Date('2024-01-01T10:00:00Z')
              },
              type: 'email',
              content: 'Test interaction'
            })
          }
        ]
      }

      const mockSnapshot = {
        docs: [mockContactDoc]
      }

      vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot as any)
      vi.mocked(getDocs).mockResolvedValueOnce(mockLogsSnapshot as any)

      const result = await firebaseApi.ai.generateContactSummary('contact-1')

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Messaging API', () => {
    it('should send message to group', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => mockGroup
      }

      const mockContactDoc = {
        id: 'contact-1',
        data: () => ({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          userId: 'test-user-id'
        })
      }

      const mockGroupSnapshot = {
        docs: [mockGroupDoc]
      }

      const mockContactsSnapshot = {
        docs: [mockContactDoc]
      }

      // Mock the first call (groups query) and second call (contacts query)
      vi.mocked(getDocs).mockResolvedValueOnce(mockGroupSnapshot as any)
        .mockResolvedValueOnce(mockContactsSnapshot as any)

      await firebaseApi.messaging.send('group-1', 'Test message', ['sms'])

      expect(addDoc).toHaveBeenCalledWith('mock-collection', {
        groupId: 'group-1',
        groupName: 'Test Group',
        messageContent: 'Test message',
        recipients: 1,
        deliveryMethod: 'sms',
        recipientDetails: expect.arrayContaining([
          expect.objectContaining({
            contactId: 'contact-1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            smsStatus: 'failed',
            emailStatus: 'not_sent',
            errorMessage: expect.stringContaining('SMS failed')
          })
        ]),
        userId: 'test-user-id',
        timestamp: 'server-timestamp',
        status: 'failed'
      })
    })

    it('should send message to group with successful SMS delivery', async () => {
      // Mock fetch to return successful SMS response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, messageId: 'sms-123' })
      } as any)

      const mockGroupDoc = {
        id: 'group-1',
        data: () => ({
          name: 'Test Group',
          contactIds: ['contact-1'],
          userId: 'test-user-id'
        })
      }

      const mockContactDoc = {
        id: 'contact-1',
        data: () => ({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          userId: 'test-user-id'
        })
      }

      const mockGroupSnapshot = {
        docs: [mockGroupDoc]
      }

      const mockContactsSnapshot = {
        docs: [mockContactDoc]
      }

      // Mock the first call (groups query) and second call (contacts query)
      vi.mocked(getDocs).mockResolvedValueOnce(mockGroupSnapshot as any)
        .mockResolvedValueOnce(mockContactsSnapshot as any)

      await firebaseApi.messaging.send('group-1', 'Test message', ['sms'])

      expect(addDoc).toHaveBeenNthCalledWith(1, 'mock-collection', {
        groupId: 'group-1',
        groupName: 'Test Group',
        messageContent: 'Test message',
        recipients: 1,
        deliveryMethod: 'sms',
        recipientDetails: expect.arrayContaining([
          expect.objectContaining({
            contactId: 'contact-1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            smsStatus: 'sent',
            emailStatus: 'not_sent'
          })
        ]),
        userId: 'test-user-id',
        timestamp: 'server-timestamp',
        status: 'sent'
      })
    })

    it('should throw error when sending to non-existent group', async () => {
      const mockSnapshot = {
        docs: []
      }

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any)

      await expect(firebaseApi.messaging.send('non-existent', 'Test', ['sms'])).rejects.toThrow('Group not found')
    })

    it('should throw error when message content is empty', async () => {
      await expect(firebaseApi.messaging.send('group-1', '', ['sms'])).rejects.toThrow('Message content cannot be empty')
    })

    it('should throw error when no channels specified', async () => {
      await expect(firebaseApi.messaging.send('group-1', 'Test message', [])).rejects.toThrow('At least one delivery channel must be selected')
    })

    it('should throw error when group has no members', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => ({
          name: 'Test Group',
          contactIds: [],
          schedules: [],
          backgroundInfo: 'Test background',
          enabled: true
        })
      }

      const mockGroupSnapshot = {
        docs: [mockGroupDoc]
      }

      vi.mocked(getDocs).mockResolvedValueOnce(mockGroupSnapshot as any)

      await expect(firebaseApi.messaging.send('group-1', 'Test message', ['sms'])).rejects.toThrow('Cannot send message: group has no members')
    })

    it('should throw error when group has no valid SMS contacts', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => ({
          name: 'Test Group',
          contactIds: ['contact-1'],
          schedules: [],
          backgroundInfo: 'Test background',
          enabled: true
        })
      }

      const mockContactDoc = {
        id: 'contact-1',
        data: () => ({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '', // No phone
          userId: 'test-user-id'
        })
      }

      const mockGroupSnapshot = {
        docs: [mockGroupDoc]
      }

      const mockContactsSnapshot = {
        docs: [mockContactDoc]
      }

      vi.mocked(getDocs).mockResolvedValueOnce(mockGroupSnapshot as any)
        .mockResolvedValueOnce(mockContactsSnapshot as any)

      await expect(firebaseApi.messaging.send('group-1', 'Test message', ['sms'])).rejects.toThrow('Cannot send SMS: no group members have valid phone numbers')
    })

    it('should throw error when group has no valid email contacts', async () => {
      const mockGroupDoc = {
        id: 'group-1',
        data: () => ({
          name: 'Test Group',
          contactIds: ['contact-1'],
          schedules: [],
          backgroundInfo: 'Test background',
          enabled: true
        })
      }

      const mockContactDoc = {
        id: 'contact-1',
        data: () => ({
          name: 'John Doe',
          email: '', // No email
          phone: '+1234567890',
          userId: 'test-user-id'
        })
      }

      const mockGroupSnapshot = {
        docs: [mockGroupDoc]
      }

      const mockContactsSnapshot = {
        docs: [mockContactDoc]
      }

      vi.mocked(getDocs).mockResolvedValueOnce(mockGroupSnapshot as any)
        .mockResolvedValueOnce(mockContactsSnapshot as any)

      await expect(firebaseApi.messaging.send('group-1', 'Test message', ['email'])).rejects.toThrow('Cannot send email: no group members have valid email addresses')
    })
  })
})