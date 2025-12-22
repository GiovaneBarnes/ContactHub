/**
 * Notification Settings Component
 * 
 * A beautiful, intuitive interface for managing notification preferences
 * Built with psychological principles:
 * - Progressive disclosure (show simple first, advanced on demand)
 * - Visual hierarchy (most important settings prominent)
 * - Immediate feedback (changes reflect instantly)
 * - Smart defaults (works great out of the box)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  BellOff, 
  Mail, 
  Clock,
  Sparkles,
  Calendar,
  Users,
  Shield,
  Trophy,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { notificationService } from "@/lib/notification-service";
import { 
  NotificationPreferences, 
  DIGEST_TIME_OPTIONS,
  DigestTime,
} from "@/lib/notification-types";
import { useAuth } from "@/lib/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['aiInsights']));

  // Load preferences
  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const prefs = await notificationService.getPreferences(user.id);
      setPreferences(prefs);
    } catch (error) {
      toast({
        title: "Failed to load preferences",
        description: "Using default settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user || !preferences) return;

    const newPrefs = { ...preferences, ...updates };
    
    setSaving(true);
    try {
      await notificationService.updatePreferences(user.id, updates);
      setPreferences(newPrefs); // Only update on success
      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated",
      });
    } catch (error) {
      console.error('[NotificationSettings] Save error:', error);
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (loading || !preferences) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-48 bg-muted rounded-lg" />
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'aiInsights': return <Sparkles className="h-5 w-5 text-purple-500" />;
      case 'scheduledMessages': return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'contactActivity': return <Users className="h-5 w-5 text-green-500" />;
      case 'system': return <Shield className="h-5 w-5 text-orange-500" />;
      case 'social': return <Trophy className="h-5 w-5 text-pink-500" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'aiInsights': return 'AI Insights';
      case 'scheduledMessages': return 'Scheduled Messages';
      case 'contactActivity': return 'Contact Activity';
      case 'system': return 'System & Account';
      case 'social': return 'Social & Achievements';
      default: return category;
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'aiInsights': return 'Smart suggestions and relationship insights';
      case 'scheduledMessages': return 'Reminders and message delivery updates';
      case 'contactActivity': return 'Contact imports and bulk actions';
      case 'system': return 'Security, billing, and important updates';
      case 'social': return 'Milestones, achievements, and celebrations';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Master Control */}
      <Card className="glass hover-lift border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {preferences.enabled ? (
                <Bell className="h-6 w-6 text-primary" />
              ) : (
                <BellOff className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  {preferences.enabled 
                    ? 'Stay informed about what matters to you'
                    : 'All notifications are currently disabled'
                  }
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={preferences.enabled}
              onCheckedChange={(enabled) => updatePreferences({ enabled })}
              disabled={saving}
            />
          </div>
        </CardHeader>
      </Card>

      {preferences.enabled && (
        <>
          {/* Quick Settings */}
          <Card className="glass hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Get notified via email about important updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-primary bg-primary/5">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive updates in your inbox</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.emailEnabled}
                  onCheckedChange={(checked) =>
                    updatePreferences({ emailEnabled: checked })
                  }
                  disabled={saving}
                />
              </div>

              <Separator />

              {/* Digest Mode */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Daily Digest</Label>
                    <Badge variant="secondary" className="text-xs">
                      Batch emails to reduce clutter
                    </Badge>
                  </div>
                  <Switch
                    checked={preferences.digest.enabled}
                    onCheckedChange={(enabled) =>
                      updatePreferences({
                        digest: { ...preferences.digest, enabled },
                      })
                    }
                    disabled={saving}
                  />
                </div>

                {preferences.digest.enabled && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery Time</Label>
                      <Select
                        value={preferences.digest.time}
                        onValueChange={(value: DigestTime) =>
                          updatePreferences({
                            digest: { ...preferences.digest, time: value },
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIGEST_TIME_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex flex-col items-start">
                                <span>{option.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {option.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Batch less urgent notifications into a single daily summary
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Settings */}
          <Card className="glass hover-lift">
            <CardHeader>
              <CardTitle>Notification Categories</CardTitle>
              <CardDescription>
                Fine-tune what you want to be notified about
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {preferences.categories && Object.entries(preferences.categories).map(([category, settings]) => {
                const isExpanded = expandedSections.has(category);
                
                return (
                  <div key={category} className="border rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleSection(category)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(category)}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getCategoryTitle(category)}</span>
                            {!settings.enabled && (
                              <Badge variant="secondary" className="text-xs">
                                Off
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {getCategoryDescription(category)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={settings.enabled}
                          onCheckedChange={(enabled) =>
                            updatePreferences({
                              categories: {
                                ...preferences.categories,
                                [category]: { ...settings, enabled },
                              },
                            })
                          }
                          disabled={saving}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Settings */}
                    {isExpanded && settings.enabled && (
                      <div className="p-4 pt-0 space-y-4 bg-muted/20">
                        {/* Frequency */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Frequency</Label>
                          <Select
                            value={settings.frequency}
                            onValueChange={(frequency: any) =>
                              updatePreferences({
                                categories: {
                                  ...preferences.categories,
                                  [category]: { ...settings, frequency },
                                },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="instant">Instant</SelectItem>
                              <SelectItem value="digest-daily">Daily Digest</SelectItem>
                              <SelectItem value="digest-weekly">Weekly Digest</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Category-specific settings */}
                        {category === 'aiInsights' && 'insightTypes' in settings && settings.insightTypes && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Insight Types</Label>
                            <div className="space-y-2">
                              {Object.entries(settings.insightTypes).map(([type, enabled]) => (
                                <div key={type} className="flex items-center justify-between">
                                  <Label className="text-sm font-normal capitalize cursor-pointer">
                                    {type.replace(/([A-Z])/g, ' $1').trim()}
                                  </Label>
                                  <Switch
                                    checked={enabled}
                                    onCheckedChange={(checked) =>
                                      updatePreferences({
                                        categories: {
                                          ...preferences.categories,
                                          aiInsights: {
                                            ...settings,
                                            insightTypes: {
                                              ...settings.insightTypes,
                                              [type]: checked,
                                            },
                                          },
                                        },
                                      })
                                    }
                                    disabled={saving}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {category === 'scheduledMessages' && 'reminders' in settings && settings.reminders && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Reminders</Label>
                            <div className="space-y-2">
                              {Object.entries(settings.reminders).map(([type, enabled]) => (
                                <div key={type} className="flex items-center justify-between">
                                  <Label className="text-sm font-normal cursor-pointer">
                                    {type === 'oneDayBefore' && 'One day before'}
                                    {type === 'oneHourBefore' && 'One hour before'}
                                    {type === 'onSend' && 'When sent'}
                                  </Label>
                                  <Switch
                                    checked={enabled}
                                    onCheckedChange={(checked) =>
                                      updatePreferences({
                                        categories: {
                                          ...preferences.categories,
                                          scheduledMessages: {
                                            ...settings,
                                            reminders: {
                                              ...settings.reminders,
                                              [type]: checked,
                                            },
                                          },
                                        },
                                      })
                                    }
                                    disabled={saving}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="glass border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Smart Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    We use behavioral psychology to deliver notifications at the right time, in the right way. 
                    Your preferences help us serve you better while respecting your attention and time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
