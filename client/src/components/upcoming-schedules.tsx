import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/mock-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { getNextOccurrences } from '@/lib/schedule-utils';

export function UpcomingSchedules() {
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: api.groups.list
  });

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
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-500" />
          Upcoming Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingOccurrences.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming scheduled messages</p>
            </div>
          ) : (
            upcomingOccurrences.map((occurrence, index) => {
              // Find the group this schedule belongs to
              const schedule = allSchedules.find(s => s.id === occurrence.scheduleId);
              const groupName = schedule?.groupName || 'Unknown Group';

              return (
                <div key={`${occurrence.scheduleId}-${index}`} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {groupName}
                      </Badge>
                      {occurrence.scheduleName && (
                        <Badge variant="secondary" className="text-xs">
                          {occurrence.scheduleName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">
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
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {getDaysUntil(occurrence.date)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
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