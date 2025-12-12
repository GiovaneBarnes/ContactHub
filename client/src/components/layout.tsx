import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  History, 
  LogOut, 
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contacts", label: "Contacts", icon: Users },
    { href: "/groups", label: "Groups", icon: Layers },
    { href: "/logs", label: "Message Logs", icon: History },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full glass border-r border-border/50">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-xl font-bold font-display tracking-tight text-gradient">
          Contact<span className="text-primary">Hub</span>
        </h1>
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
        <div className="flex items-center gap-3 px-3 py-2 mb-4 rounded-lg bg-muted/30 border border-border/30">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-sm">
            {user?.name?.[0] || "U"}
          </div>
          <div className="text-sm flex-1 min-w-0">
            <p className="truncate font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-3 h-10 hover-glow"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 shrink-0">
        <NavContent />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 glass border-b border-border/50 z-50 flex items-center px-4 justify-between backdrop-blur-xl">
        <h1 className="text-lg font-bold font-display text-gradient">
          ContactHub
        </h1>
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:h-screen pt-16 md:pt-0 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20 -z-10" />
        <div className="container mx-auto max-w-6xl p-6 md:p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
