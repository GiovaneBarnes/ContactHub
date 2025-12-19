import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../auth-context'

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    onAuthStateChanged: vi.fn((callback) => {
      callback(null)
      return vi.fn()
    })
  })),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('../firebase', () => ({
  auth: {},
  analytics: { 
    type: 'analytics-mock',
    options: { projectId: 'test-project' },
    app: { options: { projectId: 'test-project' } }
  },
  db: { type: 'firestore-mock' }
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

  const handleLogin = async () => {
    try {
      await login('test@example.com', 'password')
    } catch (e) {
      // Error is handled by the auth context
    }
  }

  const handleSignup = async () => {
    try {
      await signup('test@example.com', 'password', 'Test User')
    } catch (e) {
      // Error is handled by the auth context
    }
  }

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="user">{user ? user.name : 'no-user'}</div>
      <button onClick={handleLogin}>Login</button>
      <button onClick={handleSignup}>Signup</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading initially', async () => {
    const { onAuthStateChanged } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      // Don't call callback to keep loading state
      return vi.fn()
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
  })

  it('should load user on mount if authenticated', async () => {
    const { onAuthStateChanged } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockFirebaseUser = {
      uid: '1',
      email: 'test@example.com',
      displayName: 'Test User'
    }

    // Mock onAuthStateChanged to call the callback with user
    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(mockFirebaseUser)
      return vi.fn()
    })

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
    const { onAuthStateChanged, signInWithEmailAndPassword } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockSignInWithEmailAndPassword = vi.mocked(signInWithEmailAndPassword)

    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(null) // Initially no user
      return vi.fn()
    })

    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: '1', email: 'test@example.com', displayName: 'Test User' }
    } as any)

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
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@example.com', 'password')
    })
  })

  it('should validate auth context initialization', async () => {
    const { onAuthStateChanged } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockFirebaseUser = {
      uid: '1',
      email: 'test@example.com',
      displayName: 'Test User'
    }

    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(mockFirebaseUser)
      return vi.fn()
    })

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
    const { onAuthStateChanged, createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockCreateUserWithEmailAndPassword = vi.mocked(createUserWithEmailAndPassword)
    const mockUpdateProfile = vi.mocked(updateProfile)

    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(null) // Initially no user
      return vi.fn()
    })

    const mockFirebaseUser = { uid: '1', email: 'test@example.com', displayName: null }
    mockCreateUserWithEmailAndPassword.mockResolvedValue({
      user: mockFirebaseUser
    } as any)

    mockUpdateProfile.mockResolvedValue()

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
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@example.com', 'password')
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockFirebaseUser, { displayName: 'Test User' })
    })
  })

  it('should handle login failure', async () => {
    const { onAuthStateChanged, signInWithEmailAndPassword } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockSignInWithEmailAndPassword = vi.mocked(signInWithEmailAndPassword)

    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(null)
      return vi.fn()
    })

    const error = new Error('Invalid credentials')
    mockSignInWithEmailAndPassword.mockRejectedValue(error)

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

    // Error should be caught and handled by the auth context
    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@example.com', 'password')
    })
    // The error is caught internally, so we don't expect it to be re-thrown
  })

  it('should handle signup failure', async () => {
    const { onAuthStateChanged, createUserWithEmailAndPassword } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockCreateUserWithEmailAndPassword = vi.mocked(createUserWithEmailAndPassword)

    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(null)
      return vi.fn()
    })

    const error = new Error('Email already in use')
    mockCreateUserWithEmailAndPassword.mockRejectedValue(error)

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

    // Error should be caught and handled by the auth context
    await waitFor(() => {
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@example.com', 'password')
    })
    // The error is caught internally, so we don't expect it to be re-thrown
  })

  it('should handle logout failure', async () => {
    const { onAuthStateChanged, signOut } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockSignOut = vi.mocked(signOut)
    const mockFirebaseUser = {
      uid: '1',
      email: 'test@example.com',
      displayName: 'Test User'
    }

    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(mockFirebaseUser)
      return vi.fn()
    })

    const error = new Error('Network error')
    mockSignOut.mockRejectedValue(error)

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await user.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  it('should handle logout success', async () => {
    const { onAuthStateChanged, signOut } = await import('firebase/auth')
    const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
    const mockSignOut = vi.mocked(signOut)
    const mockFirebaseUser = {
      uid: '1',
      email: 'test@example.com',
      displayName: 'Test User'
    }

    mockOnAuthStateChanged.mockImplementation((auth: any, callback: any) => {
      callback(mockFirebaseUser)
      return vi.fn()
    })

    mockSignOut.mockResolvedValue()

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('Test User')

    await user.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  it('should provide default context when used outside provider', () => {
    // This test verifies the error handling in useAuth
    const BadComponent = () => {
      const auth = useAuth()
      return <div>{auth.isLoading ? 'loading' : 'loaded'}</div>
    }

    // Should not throw when used outside provider
    expect(() => render(<BadComponent />)).not.toThrow()
    
    // Should render loading state from default context
    expect(screen.getByText('loading')).toBeInTheDocument()
  })
})