import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/error-boundary";

// Retry wrapper for lazy imports - handles chunk loading failures
const lazyRetry = (componentImport: () => Promise<any>) => {
  return lazy(() => 
    componentImport().catch((error) => {
      // Check if it's a chunk loading error
      const isChunkError = error?.message?.includes('Failed to fetch') || 
                          error?.message?.includes('MIME type') ||
                          error?.message?.includes('Loading chunk');
      
      if (isChunkError) {
        // Force reload to get fresh chunks after deployment
        window.location.reload();
      }
      throw error;
    })
  );
};

// Lazy load Layout too to prevent any circular dependencies
const Layout = lazyRetry(() => import("@/components/layout").then(m => ({ default: m.Layout })));

// Lazy load pages with retry logic
const NotFound = lazyRetry(() => import("@/pages/not-found"));
const AuthPage = lazyRetry(() => import("@/pages/auth"));
const Dashboard = lazyRetry(() => import("@/pages/dashboard"));
const ContactsPage = lazyRetry(() => import("@/pages/contacts"));
const GroupsPage = lazyRetry(() => import("@/pages/groups"));
const GroupDetailPage = lazyRetry(() => import("@/pages/group-detail"));
const LogsPage = lazyRetry(() => import("@/pages/logs"));
const AnalyticsDashboard = lazyRetry(() => import("@/pages/analytics"));
const PersonalInsights = lazyRetry(() => import("@/pages/insights"));
const SettingsPage = lazyRetry(() => import("@/pages/settings"));
const TermsPage = lazyRetry(() => import("@/pages/terms"));
const PrivacyPage = lazyRetry(() => import("@/pages/privacy"));

// Preload critical components after initial render
if (typeof window !== 'undefined') {
  // Preload Dashboard and Contacts (most used) after 2 seconds
  setTimeout(() => {
    import("@/pages/dashboard");
    import("@/pages/contacts");
  }, 2000);
}

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/privacy" component={PrivacyPage} />
      
      {/* Dashboard is now public for development */}
      <Route path="/">
        <Layout>
          <Dashboard />
        </Layout>
      </Route>
      
      {/* Other routes still protected */}
      <Route path="/contacts">
        <ProtectedRoute component={ContactsPage} />
      </Route>
      <Route path="/groups">
        <ProtectedRoute component={GroupsPage} />
      </Route>
      <Route path="/groups/:id">
        <ProtectedRoute component={GroupDetailPage} />
      </Route>
      <Route path="/logs">
        <ProtectedRoute component={LogsPage} />
      </Route>
      <Route path="/insights">
        <ProtectedRoute component={PersonalInsights} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={AnalyticsDashboard} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
