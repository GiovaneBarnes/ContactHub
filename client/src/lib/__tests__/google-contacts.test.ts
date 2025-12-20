import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GoogleContactsIntegration, formatContactCount, isGoogleAuthAvailable } from '@/lib/google-contacts'

// Mock fetch globally
const fetchMock = vi.fn()
global.fetch = fetchMock

// Mock window.google
let capturedCallback: any = null
const mockGoogle = {
  accounts: {
    oauth2: {
      initTokenClient: vi.fn((config) => {
        capturedCallback = config.callback
        return {
          requestAccessToken: vi.fn()
        }
      })
    }
  }
}

describe('GoogleContactsIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id')
    capturedCallback = null // Reset captured callback

    // Reset window.google for each test
    delete (window as any).google
    Object.defineProperty(window, 'google', {
      value: { ...mockGoogle },
      writable: true,
      configurable: true
    })

    // Mock document methods
    vi.spyOn(document, 'createElement').mockReturnValue({
      src: '',
      async: false,
      defer: false,
      onload: null,
      onerror: null
    } as any)
    vi.spyOn(document.head, 'appendChild').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('loadGISLibrary', () => {
    it('should resolve immediately if GIS is already loaded', async () => {
      // GIS already loaded
      expect(window.google?.accounts?.oauth2).toBeDefined()

      await expect(GoogleContactsIntegration['loadGISLibrary']()).resolves.toBeUndefined()
    })

    it('should load GIS library when not available', async () => {
      // Remove google from window
      delete (window as any).google

      const mockScript = {
        src: '',
        async: true,
        defer: true,
        onload: null,
        onerror: null
      }

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockScript as any)
      const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {})

      const loadPromise = GoogleContactsIntegration['loadGISLibrary']()

      // Simulate script load
      mockScript.onload?.()

      await expect(loadPromise).resolves.toBeUndefined()

      expect(createElementSpy).toHaveBeenCalledWith('script')
      expect(mockScript.src).toBe('https://accounts.google.com/gsi/client')
      expect(mockScript.async).toBe(true)
      expect(mockScript.defer).toBe(true)
      expect(appendChildSpy).toHaveBeenCalledWith(mockScript)
    })

    it('should reject on script load error', async () => {
      delete (window as any).google

      const mockScript = {
        src: '',
        async: true,
        defer: true,
        onload: null,
        onerror: null
      }

      vi.spyOn(document, 'createElement').mockReturnValue(mockScript as any)
      vi.spyOn(document.head, 'appendChild').mockImplementation(() => {})

      const loadPromise = GoogleContactsIntegration['loadGISLibrary']()

      // Simulate script error
      mockScript.onerror?.()

      await expect(loadPromise).rejects.toThrow('Failed to load Google Identity Services')
    })
  })

  describe('authenticate', () => {
    it('should throw error if client ID is not configured', async () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')

      await expect(GoogleContactsIntegration.authenticate()).rejects.toThrow('Google Client ID is not configured')
    })

    it('should successfully authenticate and return access token', async () => {
      const authPromise = GoogleContactsIntegration.authenticate()

      // Wait a tick to ensure callback is captured
      await new Promise(resolve => setTimeout(resolve, 0))

      // Simulate successful callback
      capturedCallback({ access_token: 'test-token' })

      await expect(authPromise).resolves.toBe('test-token')

      expect(window.google!.accounts.oauth2.initTokenClient).toHaveBeenCalledWith({
        client_id: 'test-client-id',
        scope: 'https://www.googleapis.com/auth/contacts.readonly',
        callback: expect.any(Function)
      })

      expect(window.google!.accounts.oauth2.initTokenClient.mock.results[0].value.requestAccessToken).toHaveBeenCalled()
    })

    it('should reject on authentication error', async () => {
      const authPromise = GoogleContactsIntegration.authenticate()

      // Wait a tick to ensure callback is captured
      await new Promise(resolve => setTimeout(resolve, 0))

      // Simulate error callback
      capturedCallback({ error: 'access_denied' })

      await expect(authPromise).rejects.toThrow('access_denied')
    })

    it('should reject on token client error', async () => {
      // Temporarily replace the initTokenClient to throw an error
      const originalInitTokenClient = mockGoogle.accounts.oauth2.initTokenClient
      mockGoogle.accounts.oauth2.initTokenClient = () => {
        throw new Error('Token client error')
      }

      // Update window.google with the modified mock
      Object.defineProperty(window, 'google', {
        value: { ...mockGoogle },
        writable: true,
        configurable: true
      })

      await expect(GoogleContactsIntegration.authenticate()).rejects.toThrow('Token client error')

      // Restore the original initTokenClient
      mockGoogle.accounts.oauth2.initTokenClient = originalInitTokenClient
      Object.defineProperty(window, 'google', {
        value: { ...mockGoogle },
        writable: true,
        configurable: true
      })
    })
  })

  describe('fetchContacts', () => {
    const mockAccessToken = 'test-access-token'

    it('should fetch contacts successfully', async () => {
      const mockResponse = {
        connections: [
          {
            resourceName: 'people/123',
            names: [{ displayName: 'John Doe' }],
            emailAddresses: [{ value: 'john@example.com' }],
            phoneNumbers: [{ value: '+1234567890' }]
          }
        ],
        totalItems: 1
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await GoogleContactsIntegration.fetchContacts(mockAccessToken)

      expect(result).toEqual(mockResponse.connections)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://people.googleapis.com/v1/people/me/connections'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('should handle pagination', async () => {
      const mockResponse1 = {
        connections: [{ resourceName: 'people/1', names: [{ displayName: 'John' }] }],
        nextPageToken: 'token123',
        totalItems: 2
      }

      const mockResponse2 = {
        connections: [{ resourceName: 'people/2', names: [{ displayName: 'Jane' }] }],
        totalItems: 2
      }

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse1)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse2)
        })

      const result = await GoogleContactsIntegration.fetchContacts(mockAccessToken)

      expect(result).toHaveLength(2)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('pageToken=token123'),
        expect.any(Object)
      )
    })

    it('should handle 401 unauthorized error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Token expired')
      })

      await expect(GoogleContactsIntegration.fetchContacts(mockAccessToken))
        .rejects.toThrow('Access token expired. Please sign in again.')
    })

    it('should handle 403 forbidden error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied')
      })

      await expect(GoogleContactsIntegration.fetchContacts(mockAccessToken))
        .rejects.toThrow('Access denied. Please grant permission to read contacts.')
    })

    it('should handle generic HTTP errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      })

      await expect(GoogleContactsIntegration.fetchContacts(mockAccessToken))
        .rejects.toThrow('Failed to fetch contacts: Internal Server Error')
    })
  })

  describe('transformContacts', () => {
    it('should transform valid Google contacts', () => {
      const googleContacts = [
        {
          resourceName: 'people/123',
          names: [{ displayName: 'John Doe' }],
          emailAddresses: [{ value: 'john@example.com' }],
          phoneNumbers: [{ value: '+1234567890' }],
          organizations: [{ name: 'Acme Corp', title: 'Developer' }],
          biographies: [{ value: 'Software engineer' }]
        }
      ]

      const result = GoogleContactsIntegration.transformContacts(googleContacts)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        notes: '[Google Contacts] Developer at Acme Corp • Software engineer',
        relationship: 'Professional',
        tags: ['Google', 'Work']
      })
    })

    it('should skip contacts without name', () => {
      const googleContacts = [
        {
          resourceName: 'people/123',
          emailAddresses: [{ value: 'john@example.com' }],
          phoneNumbers: [{ value: '+1234567890' }]
        }
      ]

      const result = GoogleContactsIntegration.transformContacts(googleContacts)

      expect(result).toHaveLength(0)
    })

    it('should skip contacts without email or phone', () => {
      const googleContacts = [
        {
          resourceName: 'people/123',
          names: [{ displayName: 'John Doe' }]
        }
      ]

      const result = GoogleContactsIntegration.transformContacts(googleContacts)

      expect(result).toHaveLength(0)
    })

    it('should handle contacts with multiple emails and phones', () => {
      const googleContacts = [
        {
          resourceName: 'people/123',
          names: [{ displayName: 'John Doe' }],
          emailAddresses: [
            { value: 'john@example.com', type: 'work' },
            { value: 'john@gmail.com', type: 'personal' }
          ],
          phoneNumbers: [
            { value: '+1234567890', type: 'work' },
            { value: '+0987654321', type: 'mobile' }
          ]
        }
      ]

      const result = GoogleContactsIntegration.transformContacts(googleContacts)

      expect(result[0].notes).toContain('personal: john@gmail.com')
      expect(result[0].notes).toContain('mobile: +0987654321')
    })

    it('should handle contacts with minimal organization data', () => {
      const googleContacts = [
        {
          resourceName: 'people/123',
          names: [{ displayName: 'John Doe' }],
          emailAddresses: [{ value: 'john@example.com' }],
          organizations: [{ name: 'Acme Corp' }]
        }
      ]

      const result = GoogleContactsIntegration.transformContacts(googleContacts)

      expect(result[0].notes).toContain('Works at Acme Corp')
    })

    it('should handle contacts with only title', () => {
      const googleContacts = [
        {
          resourceName: 'people/123',
          names: [{ displayName: 'John Doe' }],
          emailAddresses: [{ value: 'john@example.com' }],
          organizations: [{ title: 'Developer' }]
        }
      ]

      const result = GoogleContactsIntegration.transformContacts(googleContacts)

      expect(result[0].notes).toContain('Developer')
    })
  })

  describe('importContacts', () => {
    it('should complete full import flow', async () => {
      // Mock fetch
      const mockContacts = [{
        resourceName: 'people/123',
        names: [{ displayName: 'John Doe' }],
        emailAddresses: [{ value: 'john@example.com' }]
      }]

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockContacts, totalItems: 1 })
      })

      const authPromise = GoogleContactsIntegration.importContacts()

      // Wait a tick to ensure callback is captured
      await new Promise(resolve => setTimeout(resolve, 0))

      // Complete authentication
      capturedCallback({ access_token: 'test-token' })

      const result = await authPromise

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John Doe')
    })
  })

  describe('previewContacts', () => {
    it('should return preview and total count', async () => {
      // Mock fetch with 15 contacts
      const mockContacts = Array.from({ length: 15 }, (_, i) => ({
        resourceName: `people/${i}`,
        names: [{ displayName: `Contact ${i}` }],
        emailAddresses: [{ value: `contact${i}@example.com` }]
      }))

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockContacts, totalItems: 15 })
      })

      const authPromise = GoogleContactsIntegration.previewContacts()

      // Wait a tick to ensure callback is captured
      await new Promise(resolve => setTimeout(resolve, 0))

      // Complete authentication
      capturedCallback({ access_token: 'test-token' })

      const result = await authPromise

      expect(result.preview).toHaveLength(10)
      expect(result.totalCount).toBe(15)
    })
  })

describe('formatContactCount', () => {
  it('should format zero contacts', () => {
    expect(formatContactCount(0)).toBe('No contacts')
  })

  it('should format single contact', () => {
    expect(formatContactCount(1)).toBe('1 contact')
  })

  it('should format small numbers', () => {
    expect(formatContactCount(5)).toBe('5 contacts')
    expect(formatContactCount(42)).toBe('42 contacts')
  })

  it('should format medium numbers', () => {
    expect(formatContactCount(150)).toBe('150+ contacts')
    expect(formatContactCount(567)).toBe('560+ contacts')
  })

  it('should format large numbers', () => {
    expect(formatContactCount(1200)).toBe('1200+ contacts')
    expect(formatContactCount(2500)).toBe('2500+ contacts')
  })
})

describe('isGoogleAuthAvailable', () => {
  it('should return false in server environment', () => {
    // Mock server environment
    const originalWindow = global.window
    delete (global as any).window

    expect(isGoogleAuthAvailable()).toBe(false)

    // Restore window
    global.window = originalWindow
  })

  it('should return false when GoogleAuthProvider not available', () => {
    const originalGoogleAuthProvider = (window as any).GoogleAuthProvider
    delete (window as any).GoogleAuthProvider

    expect(isGoogleAuthAvailable()).toBe(false)

    // Restore
    ;(window as any).GoogleAuthProvider = originalGoogleAuthProvider
  })

  it('should return true when GoogleAuthProvider is available', () => {
    ;(window as any).GoogleAuthProvider = true
    expect(isGoogleAuthAvailable()).toBe(true)
  })
})
})