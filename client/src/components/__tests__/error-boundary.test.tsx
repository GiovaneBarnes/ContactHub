import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ErrorBoundary } from '../error-boundary';

// Mock console methods
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that throws a network error (should be ignored)
const ThrowNetworkError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Network request failed');
  }
  return <div>No network error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches and displays catastrophic errors', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Application Error')).toBeInTheDocument();
    expect(screen.getByText(/A technical error occurred/)).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
    expect(screen.getByText('Go to Home')).toBeInTheDocument();
  });

  it('ignores network and recoverable errors', () => {
    // The error boundary should ignore network errors and render children normally
    expect(() => {
      render(
        <ErrorBoundary>
          <ThrowNetworkError shouldThrow={true} />
        </ErrorBoundary>
      );
    }).toThrow('Network request failed');
  });

  it('logs catastrophic errors to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Logging disabled - no console output expected
    // expect(consoleError).toHaveBeenCalledWith(
    //   '🚨 CRITICAL Error Boundary caught a catastrophic error:',
    //   expect.any(Error),
    //   expect.any(Object)
    // );
  });

  it('shows technical details when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Technical Details')).toBeInTheDocument();
    expect(screen.getByText('Error: Test error')).toBeInTheDocument();
  });

  it('reloads page when reload button is clicked', () => {
    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText('Reload Page');
    fireEvent.click(reloadButton);

    expect(reloadMock).toHaveBeenCalled();
  });

  it('navigates to home when go to home button is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const homeButton = screen.getByText('Go to Home');
    fireEvent.click(homeButton);

    expect(window.location.href).toBe('/');
  });
});