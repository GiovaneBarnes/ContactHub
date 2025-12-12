import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Plus, Trash2, Edit } from 'lucide-react';
import { Schedule } from '@/lib/types';
import { formatSchedule, getNextOccurrences } from '@/lib/schedule-utils';

interface ScheduleManagerProps {
  schedules: Schedule[];
  onSchedulesChange: (schedules: Schedule[]) => void;
}

export function ScheduleManager({ schedules, onSchedulesChange }: ScheduleManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const handleAddSchedule = () => {
    setEditingSchedule(null);
    setIsDialogOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setIsDialogOpen(true);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    onSchedulesChange(schedules.filter(s => s.id !== scheduleId));
  };

  const handleSaveSchedule = (schedule: Schedule) => {
    if (editingSchedule) {
      onSchedulesChange(schedules.map(s => s.id === schedule.id ? schedule : s));
    } else {
      onSchedulesChange([...schedules, schedule]);
    }
    setIsDialogOpen(false);
    setEditingSchedule(null);
  };

  const nextOccurrences = getNextOccurrences(schedules.filter(s => s.enabled), new Date(), 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Group Schedules</h3>
          <p className="text-sm text-muted-foreground">
            Configure when this group should be contacted
          </p>
        </div>
        <Button onClick={handleAddSchedule} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {/* Next occurrences preview */}
      {nextOccurrences.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Upcoming Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nextOccurrences.slice(0, 3).map((occurrence, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span>{occurrence.date.toLocaleDateString()}</span>
                  {occurrence.scheduleName && (
                    <Badge variant="secondary" className="text-xs">
                      {occurrence.scheduleName}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule list */}
      <div className="space-y-2">
        {schedules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No schedules configured</p>
              <p className="text-xs">Add a schedule to start contacting this group automatically</p>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                        {schedule.type}
                      </Badge>
                      {schedule.name && (
                        <span className="font-medium">{schedule.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatSchedule(schedule)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSchedule(schedule)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ScheduleDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        schedule={editingSchedule}
        onSave={handleSaveSchedule}
      />
    </div>
  );
}

interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  onSave: (schedule: Schedule) => void;
}

function ScheduleDialog({ isOpen, onClose, schedule, onSave }: ScheduleDialogProps) {
  const [formData, setFormData] = useState<Partial<Schedule>>(() => ({
    id: schedule?.id || crypto.randomUUID(),
    type: schedule?.type || 'recurring',
    name: schedule?.name || '',
    startDate: schedule?.startDate || new Date().toISOString().split('T')[0],
    endDate: schedule?.endDate || '',
    frequency: schedule?.frequency || {
      type: 'weekly',
      interval: 1,
      daysOfWeek: [],
      daysOfMonth: [],
      monthsOfYear: []
    },
    exceptions: schedule?.exceptions || [],
    enabled: schedule?.enabled ?? true
  }));

  const handleSave = () => {
    if (!formData.startDate) return;

    const newSchedule: Schedule = {
      id: formData.id!,
      type: formData.type as Schedule['type'],
      name: formData.name,
      startDate: formData.startDate,
      endDate: formData.endDate,
      frequency: formData.frequency,
      exceptions: formData.exceptions,
      enabled: formData.enabled!
    };

    onSave(newSchedule);
  };

  const updateFrequency = (updates: Partial<Schedule['frequency']>) => {
    setFormData(prev => ({
      ...prev,
      frequency: { ...prev.frequency!, ...updates }
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {schedule ? 'Edit Schedule' : 'Add Schedule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Schedule Type */}
          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: Schedule['type']) =>
                setFormData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">One-time</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="special-day">Special Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Name (for holidays/special days) */}
          {(formData.type === 'holiday' || formData.type === 'special-day') && (
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Christmas, Birthday"
              />
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          {/* End Date (for recurring) */}
          {formData.type === 'recurring' && (
            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          )}

          {/* Frequency Settings (for recurring) */}
          {formData.type === 'recurring' && formData.frequency && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.frequency?.type || 'weekly'}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly') =>
                      updateFrequency({ type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Every</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.frequency.interval}
                    onChange={(e) => updateFrequency({ interval: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              {/* Days of Week (for weekly) */}
              {formData.frequency.type === 'weekly' && (
                <div className="space-y-2">
                  <Label>Days of Week</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <label key={day} className="flex items-center space-x-1">
                        <Checkbox
                          checked={formData.frequency!.daysOfWeek?.includes(index) || false}
                          onCheckedChange={(checked) => {
                            const current = formData.frequency!.daysOfWeek || [];
                            const updated = checked
                              ? [...current, index]
                              : current.filter(d => d !== index);
                            updateFrequency({ daysOfWeek: updated });
                          }}
                        />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Days of Month (for monthly) */}
              {formData.frequency.type === 'monthly' && (
                <div className="space-y-2">
                  <Label>Days of Month</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <label key={day} className="flex items-center space-x-1 text-xs">
                        <Checkbox
                          checked={formData.frequency!.daysOfMonth?.includes(day) || false}
                          onCheckedChange={(checked) => {
                            const current = formData.frequency!.daysOfMonth || [];
                            const updated = checked
                              ? [...current, day]
                              : current.filter(d => d !== day);
                            updateFrequency({ daysOfMonth: updated });
                          }}
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, enabled: !!checked }))
              }
            />
            <Label htmlFor="enabled">Enabled</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}