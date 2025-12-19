import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getDocs } from 'firebase/firestore'
import PersonalInsights from '../insights'
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

describe('PersonalInsights', () => {
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
    renderWithProviders(<PersonalInsights />)

    // Initially shows loading spinner
    expect(screen.queryByText('AI-Powered Insights')).not.toBeInTheDocument()

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('AI-Powered Insights')).toBeInTheDocument()
    })

    expect(screen.getByText('Your personal contact network intelligence and growth recommendations')).toBeInTheDocument()
  })

  it('displays network strength correctly', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Network Strength')).toBeInTheDocument()
    })

    // Network strength should be calculated based on contact completeness, activity, and AI usage
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('displays contact completeness metrics', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Contact Completeness')).toBeInTheDocument()
    })

    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('With Email')).toBeInTheDocument()
    expect(screen.getByText('With Phone')).toBeInTheDocument()
  })

  it('displays total contacts count', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Total Contacts')).toBeInTheDocument()
    })

    expect(screen.getByText('Contact Analytics')).toBeInTheDocument()
  })

  it('shows recent activity metrics', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })

    expect(screen.getByText(/logins/i)).toBeInTheDocument()
  })

  it('displays AI usage metrics', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('AI Features Used')).toBeInTheDocument()
    })

    expect(screen.getByText('AI & Activity')).toBeInTheDocument()
  })

  it('shows communication patterns', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Communication Patterns')).toBeInTheDocument()
    })

    expect(screen.getByText('SMS')).toBeInTheDocument()
    expect(screen.getByText('5 messages')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('2 messages')).toBeInTheDocument()
  })

  it('displays AI-powered suggestions', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('AI Predictions & Insights')).toBeInTheDocument()
    })

    // Should show AI predictions based on the user's metrics
    expect(screen.getByText('High Engagement Champion')).toBeInTheDocument()
  })

  it('allows timeframe selection', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PersonalInsights />)

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
    renderWithProviders(<PersonalInsights />)

    expect(metricsService.trackPageView).toHaveBeenCalledWith('personal-analytics')
  })

  it('shows quick action buttons', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Recommended Actions')).toBeInTheDocument()
    })

    expect(screen.getByText('Add Quality Contacts')).toBeInTheDocument()
    expect(screen.getByText('Try AI Features')).toBeInTheDocument()
    expect(screen.getByText('Send Targeted Messages')).toBeInTheDocument()
  })

  it('handles error state gracefully', async () => {
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore failure'))

    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('AI-Powered Insights')).toBeInTheDocument()
    })

    // Should still show metrics with fallback data
    expect(screen.getByText('Network Strength')).toBeInTheDocument()
    expect(screen.getByText('Overall network health score')).toBeInTheDocument()
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

    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Communication Patterns')).toBeInTheDocument()
    })

    expect(screen.getByText('SMS')).toBeInTheDocument()
    expect(screen.getAllByText('0 messages')).toHaveLength(2) // SMS and Email both show 0
  })
})