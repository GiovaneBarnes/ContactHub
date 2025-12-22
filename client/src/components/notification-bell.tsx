/**
 * Notification Bell Component
 * 
 * A beautiful notification bell with unread badge
 * Shows in the app header for quick access to notifications
 */

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { notificationService } from "@/lib/notification-service";
import { Notification } from "@/lib/notification-types";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Calendar,
  Users,
  Shield,
  Trophy,
} from "lucide-react";

export default function NotificationBell() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const count = await notificationService.getUnreadCount(user.id);
      setUnreadCount(count);

      // Get recent 5 notifications for preview
      const recent = await notificationService.list(user.id, {
        limit: 5,
        unreadOnly: false,
      });
      setRecentNotifications(recent);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await notificationService.markAsRead(notification.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    setOpen(false);

    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'aiInsights': return <Sparkles className="h-3 w-3 text-purple-500" />;
      case 'scheduledMessages': return <Calendar className="h-3 w-3 text-blue-500" />;
      case 'contactActivity': return <Users className="h-3 w-3 text-green-500" />;
      case 'system': return <Shield className="h-3 w-3 text-orange-500" />;
      case 'social': return <Trophy className="h-3 w-3 text-pink-500" />;
      default: return <Bell className="h-3 w-3" />;
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {recentNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full p-3 text-left transition-colors hover:bg-muted/50",
                    !notification.readAt && "bg-primary/5"
                  )}
                >
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 mt-1">
                      {getCategoryIcon(notification.category)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-1">
                          {notification.title}
                        </p>
                        {!notification.readAt && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              setLocation('/notifications');
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
