import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Layout } from '../layout'
// @ts-ignore
import { MemoryRouter } from 'wouter'

// Mock import.meta.env
// vi.mock('import.meta.env', () => ({
//   VITE_ADMIN_EMAILS: undefined
// }), { virtual: true })

// Mock wouter with proper context
vi.mock('wouter', () => {
  const React = require('react')
  const RouterContext = React.createContext()

  const useLocation = () => {
    const [location, setLocation] = React.useState('/')
    return [location, setLocation]
  }

  const Link = ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children)

  const MemoryRouter = ({ children }: any) => {
    return React.createElement('div', { 'data-testid': 'memory-router' }, children)
  }

  return {
    Link,
    useLocation,
    MemoryRouter,
    useRoute: () => [false, {}],
    useParams: () => ({}),
    Router: ({ children }: any) => children
  }
})

// Mock auth context
vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      email: 'ggiobar5@gmail.com',
      name: 'Test User'
    },
    logout: vi.fn()
  })
}))

// Mock theme toggle
vi.mock('../theme-toggle', () => ({
  ThemeToggle: () => <div>Theme Toggle</div>
}))

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Admin Configuration', () => {
    it('shows admin analytics link when user is admin', () => {
      // Mock environment variable by directly modifying import.meta.env
      const originalEnv = import.meta.env.VITE_ADMIN_EMAILS
      import.meta.env.VITE_ADMIN_EMAILS = 'ggiobar5@gmail.com,admin@example.com'

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('Analytics')).toBeInTheDocument()

      // Restore original env
      import.meta.env.VITE_ADMIN_EMAILS = originalEnv
    })

    it('hides admin analytics link when user is not admin', () => {
      // Mock environment variable by directly modifying import.meta.env
      const originalEnv = import.meta.env.VITE_ADMIN_EMAILS
      import.meta.env.VITE_ADMIN_EMAILS = 'admin@example.com,different-admin@example.com'

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.queryByText('Analytics')).not.toBeInTheDocument()

      // Restore original env
      import.meta.env.VITE_ADMIN_EMAILS = originalEnv
    })

    it('shows My Insights for all authenticated users', () => {
      vi.stubEnv('VITE_ADMIN_EMAILS', 'admin@example.com')

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('My Insights')).toBeInTheDocument()
    })

    it('handles multiple admin emails correctly', () => {
      // Mock environment variable by directly modifying import.meta.env
      const originalEnv = import.meta.env.VITE_ADMIN_EMAILS
      import.meta.env.VITE_ADMIN_EMAILS = 'admin1@example.com,ggiobar5@gmail.com,admin2@example.com'

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('Analytics')).toBeInTheDocument()

      // Restore original env
      import.meta.env.VITE_ADMIN_EMAILS = originalEnv
    })

    it('handles whitespace in admin emails', () => {
      // Mock environment variable by directly modifying import.meta.env
      const originalEnv = import.meta.env.VITE_ADMIN_EMAILS
      import.meta.env.VITE_ADMIN_EMAILS = '  ggiobar5@gmail.com  ,  admin@example.com  '

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('Analytics')).toBeInTheDocument()

      // Restore original env
      import.meta.env.VITE_ADMIN_EMAILS = originalEnv
    })

    it('renders settings link', () => {
      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('displays user avatar with initial', () => {
      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      // User name starts with 'T' (Test User)
      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it.skip('shows help menu dropdown', async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      const helpButton = screen.getByRole('button', { name: /help/i })
      await user.click(helpButton)

      await waitFor(() => {
        expect(screen.getByText('Quick Start Guide')).toBeInTheDocument()
      })
    })

    it('handles empty admin emails environment variable', () => {
      vi.stubEnv('VITE_ADMIN_EMAILS', '')

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
    })

    it('handles undefined admin emails environment variable', () => {
      delete (global as any).import

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('shows all base navigation items', () => {
      const originalEnv = import.meta.env.VITE_ADMIN_EMAILS
      import.meta.env.VITE_ADMIN_EMAILS = 'ggiobar5@gmail.com'

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Contacts')).toBeInTheDocument()
      expect(screen.getByText('Groups')).toBeInTheDocument()
      expect(screen.getByText('Message Logs')).toBeInTheDocument()
      expect(screen.getByText('My Insights')).toBeInTheDocument()
      expect(screen.getByText('Analytics')).toBeInTheDocument()

      // Restore original env
      import.meta.env.VITE_ADMIN_EMAILS = originalEnv
    })

    it('shows user information in sidebar', () => {
      const originalEnv = import.meta.env.VITE_ADMIN_EMAILS
      import.meta.env.VITE_ADMIN_EMAILS = 'ggiobar5@gmail.com'

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('ggiobar5@gmail.com')).toBeInTheDocument()

      // Restore original env
      import.meta.env.VITE_ADMIN_EMAILS = originalEnv
    })

    it('shows logout button', () => {
      const originalEnv = import.meta.env.VITE_ADMIN_EMAILS
      import.meta.env.VITE_ADMIN_EMAILS = 'ggiobar5@gmail.com'

      render(
        <MemoryRouter>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText('Logout')).toBeInTheDocument()

      // Restore original env
      import.meta.env.VITE_ADMIN_EMAILS = originalEnv
    })
  })
})