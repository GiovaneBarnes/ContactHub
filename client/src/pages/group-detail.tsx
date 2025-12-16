import React, { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mock-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Send, Users, Settings, Calendar, Clock, MessageSquare, BarChart3, Plus, Search } from "lucide-react";
import { ScheduleManager } from "@/components/schedule-manager";
import { Schedule, Group } from "@/lib/types";
import { format, isAfter, isBefore, addDays } from "date-fns";

export default function GroupDetailPage() {
  const [, params] = useRoute("/groups/:id");
  const id = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api.groups.get(id!),
    enabled: !!id
  });

  // Update local state when group data loads
  React.useEffect(() => {
    if (group) {
      setGroupName(group.name);
      setGroupDescription(group.description);
    }
  }, [group]);

  const { data: allContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.contacts.list
  });

  const filteredContacts = allContacts?.filter(c => 
    c.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
    c.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
    c.phone.toLowerCase().includes(memberSearch.toLowerCase()) ||
    c.notes.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const updateGroupMutation = useMutation({
    mutationFn: (data: any) => api.groups.update(id!, data),
    onSuccess: (updatedGroup) => {
      // Update the individual group cache
      queryClient.setQueryData(['group', id], updatedGroup);
      // Update the groups list cache
      queryClient.setQueryData(['groups'], (oldGroups: Group[] | undefined) => {
        if (!oldGroups) return oldGroups;
        return oldGroups.map(g => g.id === id ? updatedGroup : g);
      });
      toast({ title: "Group updated" });
    }
  });

  const generateAiMutation = useMutation({
    mutationFn: () => api.ai.generateMessage(id!),
    onSuccess: (message) => {
      setGeneratedMessage(message);
      toast({ title: "Message generated", description: "You can edit it before sending." });
    }
  });

  const sendMutation = useMutation({
    mutationFn: () => api.messaging.send(id!, generatedMessage, ['sms', 'email']),
    onSuccess: () => {
      setGeneratedMessage("");
      toast({ title: "Message sent!", description: "Check logs for delivery status." });
    }
  });

  if (isLoading || !group) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const toggleContact = (contactId: string) => {
    const newIds = group.contactIds.includes(contactId)
      ? group.contactIds.filter(id => id !== contactId)
      : [...group.contactIds, contactId];
    updateGroupMutation.mutate({ contactIds: newIds });
  };

  // Helper function to get all schedules (for display purposes)
  const getAllSchedulesForDisplay = () => {
    const now = new Date();
    const nextWeek = addDays(now, 7);

    return group.schedules
      .filter(schedule => {
        if (schedule.type === 'one-time') {
          const scheduleDate = new Date(schedule.startDate);
          return isAfter(scheduleDate, now) && isBefore(scheduleDate, nextWeek);
        }
        // For recurring schedules, show them regardless of timing for now
        return schedule.type === 'recurring';
      })
      .slice(0, 3); // Show next 3
  };

  // Helper function to get schedule status considering group state
  const getScheduleStatus = (schedule: Schedule) => {
    // If group is disabled, all schedules are inactive
    if (!group.enabled) return { active: false, label: 'Inactive' };
    // Otherwise, use the schedule's individual enabled state
    return {
      active: schedule.enabled,
      label: schedule.enabled ? 'Active' : 'Inactive'
    };
  };

  // Helper function to format schedule info
  const formatScheduleInfo = (schedule: Schedule) => {
    if (schedule.type === 'one-time') {
      return `${schedule.name || 'Event'} on ${format(new Date(schedule.startDate), 'MMM dd, yyyy')} at ${schedule.startTime || 'TBD'}`;
    }
    return `Recurring ${schedule.frequency?.type || 'schedule'}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight">{groupName || group?.name}</h2>
        <p className="text-muted-foreground">{groupDescription || group?.description}</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Group Stats Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="interactive-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{group.contactIds.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active contacts in this group
                </p>
              </CardContent>
            </Card>

            <Card className="interactive-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{group.enabled ? group.schedules.filter(s => s.enabled).length : 0}</div>
                <p className="text-xs text-muted-foreground">
                  Enabled automated schedules
                </p>
              </CardContent>
            </Card>

            <Card className="interactive-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col items-center space-y-2">
                  <div className={`text-sm px-3 py-1 rounded-full font-medium ${
                    group.enabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {group.enabled ? "Enabled" : "Disabled"}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Group messaging status
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Group Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Group Settings
              </CardTitle>
              <CardDescription>
                Configure basic group information and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Group Name</Label>
                  <Input
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      updateGroupMutation.mutate({ name: e.target.value });
                    }}
                    placeholder="Enter group name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Group Description</Label>
                  <Input
                    value={groupDescription}
                    onChange={(e) => {
                      setGroupDescription(e.target.value);
                      updateGroupMutation.mutate({ description: e.target.value });
                    }}
                    placeholder="Enter group description"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>AI Background Context</Label>
                <Textarea
                  defaultValue={group.backgroundInfo}
                  onChange={(e) => updateGroupMutation.mutate({ backgroundInfo: e.target.value })}
                  className="min-h-[100px]"
                  placeholder="Describe the group's purpose, tone, and context for AI message generation..."
                />
                <p className="text-xs text-muted-foreground">
                  This context helps the AI generate more personalized and relevant messages for your group.
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Group Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Control whether this group can receive messages
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-medium ${
                      group.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                    }`}>
                      {group.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                    <Button
                      variant={group.enabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateGroupMutation.mutate({ enabled: !group.enabled })}
                      className="min-w-[80px]"
                    >
                      {group.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      group.enabled ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <div className="text-sm">
                      <div className="font-medium mb-1">
                        {group.enabled ? 'Group messaging is active' : 'Group messaging is disabled'}
                      </div>
                      <div className="text-muted-foreground">
                        {group.enabled
                          ? 'This group can receive automated messages and manual sends.'
                          : 'This group will not receive any messages until enabled.'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Schedules
              </CardTitle>
              <CardDescription>
                Next automated messages and events for this group
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getAllSchedulesForDisplay().length > 0 ? (
                <div className="space-y-3">
                  {getAllSchedulesForDisplay().map((schedule, index) => (
                    <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          getScheduleStatus(schedule).active ? 'bg-primary' : 'bg-gray-400'
                        }`}></div>
                        <div>
                          <p className="font-medium text-sm">{formatScheduleInfo(schedule)}</p>
                          <p className="text-xs text-muted-foreground">
                            {schedule.type === 'recurring' ? 'Recurring schedule' : 'One-time event'}
                            {!group.enabled && ' • Group disabled'}
                          </p>
                        </div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        getScheduleStatus(schedule).active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {getScheduleStatus(schedule).label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : group.schedules.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No schedules in the next week</p>
                  <p className="text-xs">All schedules are outside the upcoming timeframe</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No upcoming schedules</p>
                  <p className="text-xs">Create schedules to automate your messaging</p>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Group Members</CardTitle>
              <CardDescription>Select contacts to include in this group.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 max-w-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    className="pl-9 bg-card"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts?.map(contact => (
                  <div key={contact.id} className="flex items-start space-x-3 p-3 border rounded-md interactive-card group">
                    <Checkbox 
                      id={`contact-${contact.id}`} 
                      checked={group.contactIds.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      className="hover-scale"
                    />
                    <div className="grid gap-1.5 leading-none flex-1">
                      <label
                        htmlFor={`contact-${contact.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer hover:text-primary transition-colors"
                      >
                        {contact.name}
                      </label>
                      <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{contact.email}</p>
                      <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{contact.phone}</p>
                      {contact.notes && (
                        <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">{contact.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                AI Message Generator
              </CardTitle>
              <CardDescription>
                Create personalized messages with AI assistance and send to your group members.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Context Display */}
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">AI Context</h4>
                    <p className="text-sm text-muted-foreground">{group.backgroundInfo}</p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{group.contactIds.length}</div>
                  <div className="text-xs text-muted-foreground">Recipients</div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{group.enabled ? group.schedules.filter(s => s.enabled).length : 0}</div>
                  <div className="text-xs text-muted-foreground">Active Schedules</div>
                </div>
              </div>

              {/* Generate Message */}
              <div className="space-y-4">
                <Button
                  onClick={() => generateAiMutation.mutate()}
                  disabled={generateAiMutation.isPending}
                  size="lg"
                  className="w-full"
                >
                  {generateAiMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate AI Message
                    </>
                  )}
                </Button>

                {generatedMessage && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label className="text-base font-medium">Message Preview</Label>
                      <Textarea
                        value={generatedMessage}
                        onChange={(e) => setGeneratedMessage(e.target.value)}
                        className="min-h-[150px] text-base leading-relaxed"
                        placeholder="Your AI-generated message will appear here..."
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Ready to send to {group.contactIds.length} member{group.contactIds.length !== 1 ? 's' : ''}
                      </div>
                      <Button
                        onClick={() => sendMutation.mutate()}
                        disabled={sendMutation.isPending || group.contactIds.length === 0}
                        size="lg"
                      >
                        {sendMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Schedule Management
              </CardTitle>
              <CardDescription>
                Set up automated messaging schedules for this group. Messages will be sent automatically based on your schedule settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleManager
                schedules={group.schedules || []}
                onSchedulesChange={(schedules: Schedule[]) => updateGroupMutation.mutate({ schedules })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
