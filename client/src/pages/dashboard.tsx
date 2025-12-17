import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Layers, MessageSquare, History, Plus, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { UpcomingSchedules } from "@/components/upcoming-schedules";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [sendImmediately, setSendImmediately] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts } = useQuery({ queryKey: ['contacts'], queryFn: firebaseApi.contacts.list });
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: firebaseApi.groups.list });
  const { data: logs } = useQuery({ queryKey: ['logs'], queryFn: firebaseApi.logs.list });

  const sendMessageMutation = useMutation({
    mutationFn: ({ groupId, content }: { groupId: string; content: string }) => {
      return firebaseApi.messaging.send(groupId, content, ['sms', 'email']);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast({ title: "Message sent successfully" });
      handleCloseDraftModal();
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  });

  const scheduleMessageMutation = useMutation({
    mutationFn: ({ groupId, schedule }: { groupId: string; schedule: any }) => {
      return firebaseApi.groups.createSchedule(groupId, schedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({ title: "Message scheduled successfully" });
      handleCloseDraftModal();
    },
    onError: () => {
      toast({ title: "Failed to schedule message", variant: "destructive" });
    }
  });

  const handleOpenDraftModal = () => {
    setIsDraftModalOpen(true);
  };

  const handleCloseDraftModal = () => {
    setIsDraftModalOpen(false);
    setSelectedGroupId("");
    setMessageContent("");
    setScheduledDate("");
    setScheduledTime("");
    setSendImmediately(true);
  };

  const handleSendMessage = () => {
    if (!selectedGroupId || !messageContent.trim()) {
      toast({ title: "Please select a group and enter a message", variant: "destructive" });
      return;
    }

    if (sendImmediately) {
      sendMessageMutation.mutate({ groupId: selectedGroupId, content: messageContent });
    } else {
      if (!scheduledDate || !scheduledTime) {
        toast({ title: "Please select date and time for scheduling", variant: "destructive" });
        return;
      }

      const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const schedule = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'one-time' as const,
        name: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : ''),
        startDate: scheduleDateTime.toISOString().split('T')[0],
        startTime: scheduledTime,
        enabled: true
      };

      scheduleMessageMutation.mutate({ groupId: selectedGroupId, schedule });
    }
  };

  const stats = [
    {
      label: "Total Contacts",
      value: contacts?.length || 0,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
      border: "border-blue-500/30"
    },
    {
      label: "Enabled Groups",
      value: groups?.filter(group => group.enabled).length || 0,
      icon: Layers,
      color: "text-purple-400",
      bg: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
      border: "border-purple-500/30"
    },
    {
      label: "Messages Sent",
      value: logs?.length || 0,
      icon: MessageSquare,
      color: "text-emerald-400",
      bg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20",
      border: "border-emerald-500/30"
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-chart-2/10 rounded-2xl blur-3xl -z-10" />
        <div className="relative">
          <h2 className="text-4xl font-display font-bold tracking-tight text-gradient mb-2">
            Dashboard
          </h2>
          <p className="text-muted-foreground text-lg">
            Welcome back to your contact command center.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat, i) => (
          <Card key={i} className={`relative overflow-hidden border ${stat.border} interactive-card animate-slide-up glass`} style={{ animationDelay: `${i * 100}ms` }}>
            <div className={`absolute inset-0 ${stat.bg} opacity-50`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div className={`p-3 rounded-xl ${stat.bg} border border-border/50 backdrop-blur-sm hover-scale`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {stat.label.toLowerCase()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 glass hover-lift animate-slide-up" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs?.slice(0, 5).map((log, index) => (
                <div key={log.id} className="flex items-center interactive-card p-3 rounded-lg animate-fade-in" style={{ animationDelay: `${400 + index * 50}ms` }}>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center text-primary hover-scale">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="ml-4 space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none hover:text-primary transition-colors cursor-pointer">
                      Sent message to <span className="font-semibold text-primary">{log.groupName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full border border-border/30">
                    {log.recipients} recipients
                  </div>
                </div>
              ))}
              {!logs?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <UpcomingSchedules />

        <Card className="col-span-1 glass hover-lift animate-slide-up" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Link href="/contacts?create=true" className="group">
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover-lift hover-glow transition-all duration-300 cursor-pointer">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-blue-400 transition-colors">Add New Contact</h3>
                    <p className="text-sm text-muted-foreground">Create and manage contact entries</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Plus className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
              </Link>

              <Link href="/groups?create=true" className="group">
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover-lift hover-glow transition-all duration-300 cursor-pointer">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Layers className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-purple-400 transition-colors">Create New Group</h3>
                    <p className="text-sm text-muted-foreground">Organize contacts into groups</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Plus className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
              </Link>

              <button onClick={handleOpenDraftModal} className="group w-full text-left">
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover-lift hover-glow transition-all duration-300 cursor-pointer">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                    <MessageSquare className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-emerald-400 transition-colors">Draft Message</h3>
                    <p className="text-sm text-muted-foreground">Compose and send group messages</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Send className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Draft Message Modal */}
      <Dialog open={isDraftModalOpen} onOpenChange={setIsDraftModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Draft Message
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group">Select Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a group to message" />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.contactIds.length} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message Content</Label>
              <Textarea
                id="message"
                placeholder="Enter your message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This message will be sent to all contacts in the selected group
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="send-now"
                  name="send-option"
                  checked={sendImmediately}
                  onChange={() => setSendImmediately(true)}
                  className="text-primary"
                />
                <Label htmlFor="send-now" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4" />
                  Send immediately
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="schedule"
                  name="send-option"
                  checked={!sendImmediately}
                  onChange={() => setSendImmediately(false)}
                  className="text-primary"
                />
                <Label htmlFor="schedule" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4" />
                  Schedule for later
                </Label>
              </div>

              {!sendImmediately && (
                <div className="ml-6 space-y-2 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Scheduled Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Scheduled Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose when the message should be sent
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCloseDraftModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending || scheduleMessageMutation.isPending}
              className="flex items-center gap-2"
            >
              {sendMessageMutation.isPending || scheduleMessageMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {sendImmediately ? 'Sending...' : 'Scheduling...'}
                </>
              ) : (
                <>
                  {sendImmediately ? <Send className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  {sendImmediately ? 'Send Now' : 'Schedule Message'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
