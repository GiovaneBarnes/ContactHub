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
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold font-display tracking-tight text-sidebar-foreground">
          Contact<span className="text-primary">App</span>
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 ${
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            {user?.name?.[0] || "U"}
          </div>
          <div className="text-sm font-medium">
            <p className="truncate max-w-[120px]">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-3" onClick={logout}>
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
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background z-50 flex items-center px-4 justify-between">
        <h1 className="text-lg font-bold font-display">ContactApp</h1>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:h-screen pt-16 md:pt-0">
        <div className="container mx-auto max-w-5xl p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
