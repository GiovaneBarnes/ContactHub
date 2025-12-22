/**
 * Notification Center Component
 * 
 * In-app notification inbox that shows recent notifications
 * Features:
 * - Beautiful, organized display
 * - Filter by category
 * - Mark as read/unread
 * - Quick actions from notifications
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { notificationService } from "@/lib/notification-service";
import { Notification } from "@/lib/notification-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  MoreVertical,
  Sparkles,
  Calendar,
  Users,
  Shield,
  Trophy,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function NotificationCenter() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, filter, categoryFilter]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const options: any = {
        limit: 50,
        unreadOnly: filter === 'unread',
      };

      if (categoryFilter !== 'all') {
        options.category = categoryFilter;
      }

      const data = await notificationService.list(user.id, options);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.readAt) return;

    await notificationService.markAsRead(notification.id);
    setNotifications(notifications.map(n => 
      n.id === notification.id 
        ? { ...n, readAt: new Date().toISOString() }
        : n
    ));
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    await notificationService.markAllAsRead(user.id);
    setNotifications(notifications.map(n => ({
      ...n,
      readAt: n.readAt || new Date().toISOString()
    })));
  };

  const handleDelete = async (notificationId: string) => {
    await notificationService.delete(notificationId);
    setNotifications(notifications.filter(n => n.id !== notificationId));
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await handleMarkAsRead(notification);

    // Navigate if there's an action URL
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'aiInsights': return <Sparkles className="h-4 w-4 text-purple-500" />;
      case 'scheduledMessages': return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'contactActivity': return <Users className="h-4 w-4 text-green-500" />;
      case 'system': return <Shield className="h-4 w-4 text-orange-500" />;
      case 'social': return <Trophy className="h-4 w-4 text-pink-500" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'low': return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const unreadCount = notifications.filter(n => !n.readAt).length;

  if (!user) {
    return (
      <Card className="p-12 text-center">
        <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sign in to view notifications</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Notifications</h2>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread" className="flex items-center gap-2">
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Category: {categoryFilter === 'all' ? 'All' : categoryFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCategoryFilter('all')}>
                All Categories
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('aiInsights')}>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Insights
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('scheduledMessages')}>
                <Calendar className="h-4 w-4 mr-2" />
                Scheduled Messages
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('contactActivity')}>
                <Users className="h-4 w-4 mr-2" />
                Contact Activity
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('system')}>
                <Shield className="h-4 w-4 mr-2" />
                System & Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('social')}>
                <Trophy className="h-4 w-4 mr-2" />
                Social
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Tabs>

      {/* Notifications List */}
      <Card className="glass">
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 transition-all hover:bg-muted/50 cursor-pointer",
                    !notification.readAt && "bg-primary/5 border-l-4 border-l-primary"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getCategoryIcon(notification.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">
                              {notification.title}
                            </h4>
                            {!notification.readAt && (
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!notification.readAt && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification);
                                }}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Mark as read
                              </DropdownMenuItem>
                            )}
                            {notification.dismissible && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(notification.id);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={cn("capitalize", getPriorityColor(notification.priority))}
                        >
                          {notification.priority}
                        </Badge>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      {/* Action Button */}
                      {notification.actionUrl && notification.actionLabel && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotificationClick(notification);
                          }}
                        >
                          {notification.actionLabel}
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
