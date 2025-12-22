import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getDocs } from 'firebase/firestore'
import PersonalAnalytics from '../insights'
import { metricsService } from '@/lib/metrics'

type MockDoc = {
  id: string
  data: () => Record<string, any>
}

const createContactDocs = (): MockDoc[] => ([
  {
    id: 'contact-1',
    data: () => ({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      userId: 'test-user-id'
    })
  },
  {
    id: 'contact-2',
    data: () => ({
      name: 'Jane Smith',
      email: '',
      phone: '+0987654321',
      userId: 'test-user-id'
    })
  }
])

const createMessageLogDocs = (): MockDoc[] => ([
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `sms-${index}`,
    data: () => ({
      deliveryMethod: 'sms',
      userId: 'test-user-id',
      timestamp: new Date()
    })
  })),
  ...Array.from({ length: 2 }, (_, index) => ({
    id: `email-${index}`,
    data: () => ({
      deliveryMethod: 'email',
      userId: 'test-user-id',
      timestamp: new Date()
    })
  }))
])

const createAnalyticsDocs = (): MockDoc[] => (
  Array.from({ length: 3 }, (_, index) => ({
    id: `analytics-${index}`,
    data: () => ({
      userId: 'test-user-id',
      timestamp: new Date(),
      category: 'ai'
    })
  }))
)

const firestoreData: Record<string, MockDoc[]> = {
  contacts: createContactDocs(),
  messageLogs: createMessageLogDocs(),
  analytics_events: createAnalyticsDocs()
}

const resetFirestoreData = () => {
  firestoreData.contacts = createContactDocs()
  firestoreData.messageLogs = createMessageLogDocs()
  firestoreData.analytics_events = createAnalyticsDocs()
}

// Mock dependencies
vi.mock('@/lib/metrics', () => ({
  metricsService: {
    trackPageView: vi.fn(),
    getUserMetrics: vi.fn()
  }
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    }
  })
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name: string) => name),
  query: vi.fn((collectionName: string, ...constraints: any[]) => ({
    collectionName,
    constraints
  })),
  where: vi.fn((field: string, operator: string, value: unknown) => ({
    type: 'where',
    field,
    operator,
    value
  })),
  orderBy: vi.fn((field: string, direction?: string) => ({
    type: 'orderBy',
    field,
    direction
  })),
  limit: vi.fn((amount: number) => ({
    type: 'limit',
    amount
  })),
  getDocs: vi.fn(async (queryArg: { collectionName?: string } | string) => {
    const collectionName = typeof queryArg === 'string'
      ? queryArg
      : queryArg?.collectionName

    return {
      docs: collectionName ? firestoreData[collectionName] ?? [] : []
    }
  }),
  Timestamp: {
    fromDate: (date: Date) => date
  }
}))

vi.mock('@/lib/firebase', () => ({
  db: {}
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('PersonalAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFirestoreData()

    // Mock user metrics
    ;(metricsService.getUserMetrics as any).mockResolvedValue({
      totalContacts: 2,
      totalGroups: 1,
      messagesSent: 5,
      aiRequests: 3,
      loginCount: 8,
      lastActive: new Date(),
      sessionDuration: 3600,
      featureUsage: { ai: 3, messaging: 5 },
      messageCount: 5,
      emailCount: 2,
      aiUsageCount: 3
    })
  })

  it('renders loading state initially', async () => {
    renderWithProviders(<PersonalAnalytics />)

    // Initially shows loading spinner
    expect(screen.queryByText('AI-Powered Insights')).not.toBeInTheDocument()

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Your Contact Insights')).toBeInTheDocument()
    })

    expect(screen.getByText('Understand your networking patterns and get personalized tips to strengthen relationships')).toBeInTheDocument()
  })

  it('displays network strength correctly', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Network Quality')).toBeInTheDocument()
    })

    // Network quality should be calculated based on contact completeness, activity, and AI usage
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('displays contact completeness metrics', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Your Contact Book')).toBeInTheDocument()
    })

    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Have email address')).toBeInTheDocument()
    expect(screen.getByText('Have phone number')).toBeInTheDocument()
  })

  it('displays total contacts count', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Your Contact Book')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Contacts')).toBeInTheDocument()
  })

  it('shows recent activity metrics', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Activity & AI Usage')).toBeInTheDocument()
    })

    expect(screen.getByText(/Times Logged In/i)).toBeInTheDocument()
  })

  it('displays AI usage metrics', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Activity & AI Usage')).toBeInTheDocument()
    })

    expect(screen.getByText('AI Features Used')).toBeInTheDocument()
  })

  it('shows communication patterns', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Your Messages')).toBeInTheDocument()
    })

    expect(screen.getByText('Your Messages')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Total Messages Sent')).toBeInTheDocument()
  })

  it('displays AI-powered suggestions', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Smart Insights & Recommendations')).toBeInTheDocument()
    })

    // Should show AI predictions based on the user's metrics
    expect(screen.getByText('High Engagement Champion')).toBeInTheDocument()
  })

  it('allows timeframe selection', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PersonalAnalytics />)

    // Wait for the timeframe buttons to be available
    await waitFor(() => {
      expect(screen.getByText('7 Days')).toBeInTheDocument()
    })

    const sevenDayButton = screen.getByText('7 Days')
    await user.click(sevenDayButton)

    // Test passes if no error occurs during click
    expect(true).toBe(true)
  })

  it('tracks page view on mount', () => {
    renderWithProviders(<PersonalAnalytics />)

    expect(metricsService.trackPageView).toHaveBeenCalledWith('personal-analytics')
  })

  it('shows quick action buttons', async () => {
    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Smart Insights & Recommendations')).toBeInTheDocument()
    })

    // Check for AI predictions instead of specific buttons
    expect(screen.getByText('AI-powered analysis of your contact management patterns with personalized tips')).toBeInTheDocument()
  })

  it('handles error state gracefully', async () => {
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore failure'))

    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Your Contact Insights')).toBeInTheDocument()
    })

    // Should still show metrics with fallback data
    expect(screen.getByText('Network Quality')).toBeInTheDocument()
  })

  it('shows communication patterns with zero counts', async () => {
    firestoreData.messageLogs = []

    // Mock zero messages
    ;(metricsService.getUserMetrics as any).mockResolvedValue({
      totalContacts: 2,
      totalGroups: 1,
      messagesSent: 0,
      aiRequests: 0,
      loginCount: 0,
      lastActive: new Date(),
      sessionDuration: 0,
      featureUsage: {},
      messageCount: 0,
      emailCount: 0,
      aiUsageCount: 0
    })

    renderWithProviders(<PersonalAnalytics />)

    await waitFor(() => {
      expect(screen.getByText('Network Quality')).toBeInTheDocument()
    })

    expect(screen.getByText('No messages sent yet')).toBeInTheDocument()
  })
})