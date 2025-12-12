import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mock-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Send, Users, Settings } from "lucide-react";
import { ScheduleManager } from "@/components/schedule-manager";
import { Schedule } from "@/lib/types";

export default function GroupDetailPage() {
  const [, params] = useRoute("/groups/:id");
  const id = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatedMessage, setGeneratedMessage] = useState("");

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api.groups.get(id!),
    enabled: !!id
  });

  const { data: allContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.contacts.list
  });

  const updateGroupMutation = useMutation({
    mutationFn: (data: any) => api.groups.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight">{group.name}</h2>
        <p className="text-muted-foreground">{group.description}</p>
      </div>

      <Tabs defaultValue="message" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md mb-8">
          <TabsTrigger value="message">Message</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="message" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Message Generator
              </CardTitle>
              <CardDescription>
                Use AI to generate a personalized message based on the group's background info.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-md text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Current Context:</span> {group.backgroundInfo}
              </div>
              
              <Button 
                onClick={() => generateAiMutation.mutate()} 
                disabled={generateAiMutation.isPending}
                className="w-full sm:w-auto"
              >
                {generateAiMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sparkles className="mr-2 h-4 w-4" /> Generate Message
              </Button>

              {generatedMessage && (
                <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2">
                  <Label>Message Preview (Editable)</Label>
                  <Textarea 
                    value={generatedMessage} 
                    onChange={(e) => setGeneratedMessage(e.target.value)} 
                    className="min-h-[120px]"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => sendMutation.mutate()}
                      disabled={sendMutation.isPending}
                    >
                      {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send to {group.contactIds.length} Members
                    </Button>
                  </div>
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
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allContacts?.map(contact => (
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
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Group Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Background Information</Label>
                <Textarea 
                  defaultValue={group.backgroundInfo}
                  onChange={(e) => updateGroupMutation.mutate({ backgroundInfo: e.target.value })}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Update the context used by the AI to generate messages.
                </p>
              </div>
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
