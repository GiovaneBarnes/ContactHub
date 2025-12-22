import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firebaseApi } from '@/lib/firebase-api';
import { formatScheduleTime, parseToUserTimezone, createTimezoneAwareISO, getDateTimeInputBounds, getUserTimezone } from '@/lib/timezone-utils';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Edit, Trash2, MessageSquare } from 'lucide-react';
import { getNextOccurrences } from '@/lib/schedule-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Schedule } from '@/lib/types';

export function UpcomingSchedules() {
  const { user } = useAuth();
  const [selectedOccurrence, setSelectedOccurrence] = useState<{
    occurrence: any;
    schedule: Schedule & { groupId?: string };
    groupName: string;
  } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedTime, setEditedTime] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: firebaseApi.groups.list
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ groupId, scheduleId, updates }: { groupId: string; scheduleId: string; updates: Partial<Schedule> }) => {
      return firebaseApi.groups.updateSchedule(groupId, scheduleId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({ title: "Schedule updated successfully" });
      setIsEditModalOpen(false);
      setSelectedOccurrence(null);
    },
    onError: () => {
      toast({ title: "Failed to update schedule", variant: "destructive" });
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: ({ groupId, scheduleId }: { groupId: string; scheduleId: string }) => {
      return firebaseApi.groups.deleteSchedule(groupId, scheduleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({ title: "Schedule deleted successfully" });
      setIsEditModalOpen(false);
      setSelectedOccurrence(null);
    },
    onError: () => {
      toast({ title: "Failed to delete schedule", variant: "destructive" });
    }
  });

  const handleCardClick = (occurrence: any, schedule: Schedule, groupName: string) => {
    // Only allow editing if the occurrence is in the future
    if (occurrence.date > new Date()) {
      // Find the group that contains this schedule
      const group = groups?.find(g => g.schedules.some(s => s.id === schedule.id));
      if (group) {
        const parsed = parseToUserTimezone(occurrence.date.toISOString(), user?.timezone);
        setSelectedOccurrence({ occurrence, schedule: { ...schedule, groupId: group.id }, groupName });
        setEditedMessage(schedule.message || ''); // Initialize with existing message content
        setEditedDate(parsed.dateString);
        setEditedTime(parsed.timeString);
        setIsEditModalOpen(true);
      }
    }
  };

  const handleSaveChanges = () => {
    if (!selectedOccurrence) return;

    const updates: Partial<Schedule> = {};
    const parsed = parseToUserTimezone(selectedOccurrence.occurrence.date.toISOString(), user?.timezone);

    // If date or time changed, update the schedule with timezone-aware ISO
    if (editedDate !== parsed.dateString || editedTime !== parsed.timeString) {
      const userTimezone = user?.timezone || selectedOccurrence.schedule.timezone || getUserTimezone();
      updates.startDate = createTimezoneAwareISO(editedDate, editedTime, userTimezone);
      updates.startTime = editedTime;
      updates.timezone = userTimezone;
    }

    // If message changed, update the schedule
    if (editedMessage !== (selectedOccurrence.schedule.message || '')) {
      updates.message = editedMessage;
    }

    if (Object.keys(updates).length > 0) {
      updateScheduleMutation.mutate({
        groupId: selectedOccurrence.schedule.groupId || '',
        scheduleId: selectedOccurrence.schedule.id,
        updates
      });
    } else {
      setIsEditModalOpen(false);
      setSelectedOccurrence(null);
    }
  };

  const handleDeleteSchedule = () => {
    if (!selectedOccurrence) return;

    deleteScheduleMutation.mutate({
      groupId: selectedOccurrence.schedule.groupId || '',
      scheduleId: selectedOccurrence.schedule.id
    });
  };

  // Collect all schedules from all groups
  const allSchedules = groups?.flatMap(group =>
    group.schedules?.map(schedule => ({
      ...schedule,
      groupId: group.id,
      groupName: group.name
    })) || []
  ) || [];

  // Get next occurrences across all schedules
  const upcomingOccurrences = getNextOccurrences(
    allSchedules.filter(s => s.enabled),
    new Date(),
    5
  );

  return (
    <Card className="glass hover-lift animate-slide-up" style={{ animationDelay: '400ms' }}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Upcoming Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingOccurrences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No upcoming scheduled messages</p>
              <p className="text-xs mt-1">Configure schedules in your groups</p>
            </div>
          ) : (
            upcomingOccurrences.map((occurrence, index) => {
              // Find the group this schedule belongs to
              const schedule = allSchedules.find(s => s.id === occurrence.scheduleId);
              const groupName = schedule?.groupName || 'Unknown Group';

              return (
                <div
                  key={`${occurrence.scheduleId}-${index}`}
                  className={`flex items-start justify-between gap-3 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80 interactive-card animate-fade-in ${occurrence.date > new Date() ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-60'}`}
                  style={{ animationDelay: `${500 + index * 100}ms` }}
                  onClick={() => schedule && handleCardClick(occurrence, schedule, groupName)}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5 mb-2 overflow-hidden">
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/10 transition-colors max-w-[120px] truncate">
                        {groupName}
                      </Badge>
                      {occurrence.scheduleName && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors max-w-[140px] truncate">
                          {occurrence.scheduleName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">
                      {occurrence.date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {occurrence.date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 min-w-[80px]">
                    <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap">
                      {getDaysUntil(occurrence.date)}
                    </div>
                    {occurrence.date > new Date() && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end whitespace-nowrap">
                        <Edit className="h-3 w-3" />
                        Click to edit
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Upcoming Message
            </DialogTitle>
            <DialogDescription>
              Modify the details of this scheduled message.
            </DialogDescription>
          </DialogHeader>

          {selectedOccurrence && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm font-medium">{selectedOccurrence.groupName}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedOccurrence.schedule.name || 'Scheduled Message'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Original: {selectedOccurrence.occurrence.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message Content</Label>
                <Textarea
                  id="message"
                  placeholder="Enter the message that will be sent..."
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be sent to all contacts in the group
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Scheduled Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Scheduled Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={editedTime}
                  onChange={(e) => setEditedTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Choose when the message should be sent (12-hour format with AM/PM)
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteSchedule}
              disabled={deleteScheduleMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Schedule
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={updateScheduleMutation.isPending}
            >
              {updateScheduleMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function getDaysUntil(date: Date): string {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;

  const months = Math.ceil(diffDays / 30);
  return `In ${months} month${months > 1 ? 's' : ''}`;
}