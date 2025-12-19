import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Only catch truly catastrophic errors
    // Let React Query errors, API errors, and network errors be handled by components
    const errorMessage = error.message?.toLowerCase() || '';
    const errorString = error.toString().toLowerCase();
    
    // Ignore these - they should be handled by component error states or auto-retry
    const ignoredErrors = [
      'network',
      'fetch',
      'timeout',
      'loading chunk failed',
      'mime type',
      'failed to fetch dynamically imported module',
      'permission',
      'not found',
      'unauthorized',
      'authentication',
      'user not',
      'query',
      'request failed'
    ];
    
    const shouldIgnore = ignoredErrors.some(ignored => 
      errorMessage.includes(ignored) || errorString.includes(ignored)
    );
    
    if (shouldIgnore) {
      return { hasError: false, error: null, errorInfo: null };
    }
    
    // This is a real catastrophic error (syntax error, undefined component, etc.)
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Only log catastrophic errors
    if (this.state.hasError) {
      // console.error('🚨 CRITICAL Error Boundary caught a catastrophic error:', error, errorInfo);
      // console.error('Component Stack:', errorInfo.componentStack);
      this.setState({ error, errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <span className="text-2xl">🔧</span>
                Application Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A technical error occurred. Don't worry - your data is safe. Try reloading the page to continue.
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={() => window.location.reload()}
                  className="flex-1"
                >
                  Reload Page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="flex-1"
                >
                  Go to Home
                </Button>
              </div>
              
              {this.state.error && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="text-xs font-mono text-amber-700 break-all mb-2">
                      {this.state.error.toString()}
                    </p>
                  </div>
                  <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-h-32">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
