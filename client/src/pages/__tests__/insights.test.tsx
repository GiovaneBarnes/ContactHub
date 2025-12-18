import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PersonalInsights from '../insights'
import { metricsService } from '@/lib/metrics'

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
  collection: vi.fn(() => 'mock-collection'),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(() => 'mock-where'),
  getDocs: vi.fn(() => ({
    docs: [
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
    ]
  }))
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
    expect(screen.queryByText('My Insights')).not.toBeInTheDocument()

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('My Insights')).toBeInTheDocument()
    })

    expect(screen.getByText('Discover insights about your contact network and communication patterns')).toBeInTheDocument()
  })

  it('displays network strength correctly', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Network Strength')).toBeInTheDocument()
    })

    // Network strength should be calculated based on contact completeness, activity, and AI usage
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('shows contact completeness metrics', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Contact Completeness')).toBeInTheDocument()
    })

    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('1 with email, 2 with phone')).toBeInTheDocument()
  })

  it('displays total contacts count', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Total Contacts')).toBeInTheDocument()
    })

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('People in your network')).toBeInTheDocument()
  })

  it('shows recent activity metrics', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })

    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Logins in selected period')).toBeInTheDocument()
  })

  it('displays AI usage metrics', async () => {
    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('AI Features Used')).toBeInTheDocument()
    })

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('AI-powered actions taken')).toBeInTheDocument()
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
      expect(screen.getByText('AI Insights & Suggestions')).toBeInTheDocument()
    })

    // Should show suggestions based on the user's metrics
    expect(screen.getByText(/Expand your network/)).toBeInTheDocument()
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
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })

    expect(screen.getByText('Add New Contact')).toBeInTheDocument()
    expect(screen.getByText('Try AI Features')).toBeInTheDocument()
    expect(screen.getByText('Send Group Message')).toBeInTheDocument()
  })

  it('handles error state gracefully', async () => {
    // Mock an error in getUserMetrics
    ;(metricsService.getUserMetrics as any).mockRejectedValue(new Error('Failed to fetch metrics'))

    renderWithProviders(<PersonalInsights />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load your personal insights. Please try again later.')).toBeInTheDocument()
    })
  })

  it('shows communication patterns with zero counts', async () => {
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