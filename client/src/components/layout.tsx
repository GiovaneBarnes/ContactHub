import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  History, 
  LogOut, 
  LogIn,
  Menu,
  BarChart3,
  Sparkles,
  HelpCircle,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import { useState, lazy, Suspense } from "react";

// Lazy load heavy AI components to avoid initialization issues
const AIFeaturesBanner = lazy(() => import("@/components/ai-feature-tour").then(m => ({ default: m.AIFeaturesBanner })));
const AIFeatureTour = lazy(() => import("@/components/ai-feature-tour").then(m => ({ default: m.AIFeatureTour })));

// Create a simple hook wrapper that doesn't trigger component loading
function useAIFeatureTour() {
  const [isOpen, setIsOpen] = useState(false);
  const startTour = () => setIsOpen(true);
  const TourComponent = isOpen ? (
    <Suspense fallback={null}>
      <AIFeatureTour forceOpen={isOpen} onComplete={() => setIsOpen(false)} />
    </Suspense>
  ) : null;
  return { startTour, TourComponent };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { startTour, TourComponent } = useAIFeatureTour();

  // Admin access control
  const adminEmails = import.meta.env.VITE_ADMIN_EMAILS?.split(',').map((email: string) => email.trim()) || [];
  const isAdmin = user?.email && adminEmails.includes(user.email);

  const baseNavItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contacts", label: "Contacts", icon: Users },
    { href: "/groups", label: "Groups", icon: Layers },
    { href: "/logs", label: "Message Logs", icon: History },
    { href: "/insights", label: "My Insights", icon: Sparkles },
  ];

  const adminNavItems = [
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems;

  const NavContent = () => (
    <div className="flex flex-col h-full glass border-r border-border/50">
      <div className="p-6 border-b border-border/50">
        <Link href="/">
          <h1 className="text-xl font-bold font-display tracking-tight text-gradient hover:text-primary/80 transition-colors cursor-pointer">
            Contact<span className="text-primary">Hub</span>
          </h1>
        </Link>
        <div className="mt-2 text-xs text-muted-foreground">
          Contact Management Made Simple
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 h-12 transition-all duration-300 focus-ring ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50 interactive-button"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2 mb-4 rounded-lg bg-muted/30 border border-border/30">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-sm">
                {user.name?.[0] || "U"}
              </div>
              <div className="text-sm flex-1 min-w-0">
                <p className="truncate font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="space-y-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-10"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Help & AI Tour
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={startTour} className="gap-3">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <div>
                      <div className="font-medium">AI Features Tour</div>
                      <div className="text-xs text-muted-foreground">Learn about AI capabilities</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/settings">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-10"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-10 hover-glow"
                  onClick={logout}
                >
                  <LogIn className="h-4 w-4 rotate-180" />
                  Logout
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <ThemeToggle />
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-10 hover-glow"
              onClick={() => setLocation('/auth?mode=login')}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* AI Features Banner - shown only for logged-in users */}
      {user && (
        <Suspense fallback={null}>
          <AIFeaturesBanner />
        </Suspense>
      )}
      
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 shrink-0">
          <NavContent />
        </div>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 glass border-b border-border/50 z-50 flex items-center px-4 justify-between backdrop-blur-xl">
          <Link href="/">
            <h1 className="text-lg font-bold font-display tracking-tight text-gradient hover:text-primary/80 transition-colors cursor-pointer">
              Contact<span className="text-primary">Hub</span>
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            {user && <NotificationBell />}
            <ThemeToggle />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="hover-glow">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 glass">
                <NavContent />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto md:h-screen pt-16 md:pt-0 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20 -z-10" />
          {/* Desktop Header with Notification Bell */}
          {user && (
            <div className="hidden md:flex items-center justify-end gap-2 px-8 pt-6 pb-2">
              <NotificationBell />
            </div>
          )}
          <div className="container mx-auto max-w-6xl p-6 md:p-8 relative">
            {children}
          </div>
        </main>
      </div>
      
      {/* Tour Component */}
      {TourComponent}
    </div>
  );
}
