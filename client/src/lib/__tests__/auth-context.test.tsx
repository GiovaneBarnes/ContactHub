import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../auth-context'
import { api } from '../mock-api'

// Mock the API
vi.mock('../mock-api', () => ({
  api: {
    auth: {
      getCurrentUser: vi.fn(),
      login: vi.fn(),
      signup: vi.fn()
    }
  }
}))

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: () => [vi.fn(), vi.fn()]
}))

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

const TestComponent = () => {
  const { user, login, signup, logout, isLoading } = useAuth()

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="user">{user ? user.name : 'no-user'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => signup('test@example.com', 'password', 'Test User')}>Signup</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading initially', () => {
    const mockApi = vi.mocked(api.auth)
    mockApi.getCurrentUser.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
  })

  it('should load user on mount if authenticated', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
    const mockApi = vi.mocked(api.auth)
    mockApi.getCurrentUser.mockResolvedValue(mockUser)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('Test User')
  })

  it('should handle login successfully', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
    const mockApi = vi.mocked(api.auth)
    mockApi.getCurrentUser.mockResolvedValue(null)
    mockApi.login.mockResolvedValue(mockUser)

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await user.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalledWith('test@example.com', 'password')
    })
  })

  it('should validate auth context initialization', async () => {
    const mockApi = vi.mocked(api.auth)
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
    mockApi.getCurrentUser.mockResolvedValue(mockUser)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    })
  })

  it('should handle signup successfully', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
    const mockApi = vi.mocked(api.auth)
    mockApi.getCurrentUser.mockResolvedValue(null)
    mockApi.signup.mockResolvedValue(mockUser)

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await user.click(screen.getByText('Signup'))

    await waitFor(() => {
      expect(mockApi.signup).toHaveBeenCalledWith('test@example.com', 'password', 'Test User')
    })
  })

  it('should handle logout', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
    const mockApi = vi.mocked(api.auth)
    mockApi.getCurrentUser.mockResolvedValue(mockUser)

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    })

    await user.click(screen.getByText('Logout'))

    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
  })

  it('should provide default context when used outside provider', () => {
    // This test verifies the error handling in useAuth
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const BadComponent = () => {
      const auth = useAuth()
      return <div>{auth.isLoading ? 'loading' : 'loaded'}</div>
    }

    expect(() => render(<BadComponent />)).not.toThrow()

    expect(consoleSpy).toHaveBeenCalledWith('useAuth must be used within AuthProvider - context is undefined')

    consoleSpy.mockRestore()
  })
})