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
import { generateId } from '@/lib/utils';

// Holiday date calculation functions
function getThanksgivingDate(year: number): string {
  // Thanksgiving is the 4th Thursday in November
  const november = new Date(year, 10, 1); // November 1st
  const firstThursday = 1 + ((11 - november.getDay()) % 7); // Find first Thursday
  return (22 + firstThursday).toString().padStart(2, '0'); // 4th Thursday
}

function getEasterDate(year: number): string {
  // Easter calculation using Meeus/Jones/Butcher algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function getMothersDayDate(year: number): string {
  // Mother's Day is the 2nd Sunday in May
  const may = new Date(year, 4, 1); // May 1st
  const firstSunday = 1 + ((7 - may.getDay()) % 7); // Find first Sunday
  const mothersDay = firstSunday + 7; // 2nd Sunday
  return mothersDay.toString().padStart(2, '0');
}

function getFathersDayDate(year: number): string {
  // Father's Day is the 3rd Sunday in June
  const june = new Date(year, 5, 1); // June 1st
  const firstSunday = 1 + ((7 - june.getDay()) % 7); // Find first Sunday
  const fathersDay = firstSunday + 14; // 3rd Sunday
  return fathersDay.toString().padStart(2, '0');
}

function getLaborDayDate(year: number): string {
  // Labor Day is the 1st Monday in September
  const september = new Date(year, 8, 1); // September 1st
  const firstMonday = 1 + ((8 - september.getDay()) % 7); // Find first Monday
  return firstMonday.toString().padStart(2, '0');
}

function getHolidayNameForDate(dateString: string): string | null {
  const year = new Date(dateString).getFullYear();
  const holidayDates: Record<string, { date: string; name: string }> = {
    'christmas': { date: getHolidayDateForYear('christmas', year), name: 'Christmas' },
    'thanksgiving': { date: getHolidayDateForYear('thanksgiving', year), name: 'Thanksgiving' },
    'new-year': { date: getHolidayDateForYear('new-year', year), name: 'New Year' },
    'valentines': { date: getHolidayDateForYear('valentines', year), name: 'Valentine\'s Day' },
    'easter': { date: getHolidayDateForYear('easter', year), name: 'Easter' },
    'mothers-day': { date: getHolidayDateForYear('mothers-day', year), name: 'Mother\'s Day' },
    'fathers-day': { date: getHolidayDateForYear('fathers-day', year), name: 'Father\'s Day' },
    'labor-day': { date: getHolidayDateForYear('labor-day', year), name: 'Labor Day' },
    'halloween': { date: getHolidayDateForYear('halloween', year), name: 'Halloween' },
    'independence-day': { date: getHolidayDateForYear('independence-day', year), name: 'Independence Day' },
  };

  for (const holiday of Object.values(holidayDates)) {
    if (holiday.date === dateString) {
      return holiday.name;
    }
  }
  return null;
}

function getHolidayDateForYear(holiday: string, year: number): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  let date: string;
  
  switch (holiday) {
    case 'christmas':
      date = `${year}-12-25`;
      break;
    case 'thanksgiving':
      date = `${year}-11-${getThanksgivingDate(year)}`;
      break;
    case 'new-year':
      date = `${year}-01-01`;
      break;
    case 'valentines':
      date = `${year}-02-14`;
      break;
    case 'easter':
      date = getEasterDate(year);
      break;
    case 'mothers-day':
      date = `${year}-05-${getMothersDayDate(year)}`;
      break;
    case 'fathers-day':
      date = `${year}-06-${getFathersDayDate(year)}`;
      break;
    case 'labor-day':
      date = `${year}-09-${getLaborDayDate(year)}`;
      break;
    case 'halloween':
      date = `${year}-10-31`;
      break;
    case 'independence-day':
      date = `${year}-07-04`;
      break;
    default:
      return `${year}-01-01`;
  }
  
  // If the holiday date has already passed this year, use next year
  const holidayDate = new Date(date);
  if (year === currentYear && holidayDate < today) {
    return getHolidayDateForYear(holiday, year + 1);
  }
  
  return date;
}

function getHolidayKeyFromName(name: string): string | null {
  const holidayMap: Record<string, string> = {
    'Christmas': 'christmas',
    'Thanksgiving': 'thanksgiving',
    'New Year': 'new-year',
    'Valentine\'s Day': 'valentines',
    'Easter': 'easter',
    'Mother\'s Day': 'mothers-day',
    'Father\'s Day': 'fathers-day',
    'Labor Day': 'labor-day',
    'Halloween': 'halloween',
    'Independence Day': 'independence-day',
  };

  return holidayMap[name] || null;
}

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
            <Card key={schedule.id} className="interactive-card">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={schedule.enabled ? 'default' : 'secondary'} className="hover-scale">
                        {schedule.type}
                      </Badge>
                      {schedule.name && (
                        <span className="font-medium hover:text-primary transition-colors cursor-pointer">{schedule.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {formatSchedule(schedule)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSchedule(schedule)}
                      className="interactive-button hover:text-primary"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="interactive-button hover:text-destructive"
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
  const [formData, setFormData] = useState<Partial<Schedule>>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      id: schedule?.id || generateId(),
      type: schedule?.type || 'recurring',
      name: schedule?.name || '',
      startDate: schedule?.startDate || tomorrow.toISOString().split('T')[0],
      startTime: schedule?.startTime || '09:00',
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
    };
  });

  // Update formData when schedule prop changes (for editing existing schedules)
  React.useEffect(() => {
    if (schedule) {
      setFormData({
        id: schedule.id,
        type: schedule.type,
        name: schedule.name || '',
        startDate: schedule.startDate,
        startTime: schedule.startTime || '09:00',
        endDate: schedule.endDate || '',
        frequency: schedule.frequency || {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [],
          daysOfMonth: [],
          monthsOfYear: []
        },
        exceptions: schedule.exceptions || [],
        enabled: schedule.enabled ?? true
      });
    } else {
      // Reset to defaults for new schedule
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      setFormData({
        id: generateId(),
        type: 'recurring',
        name: '',
        startDate: tomorrow.toISOString().split('T')[0],
        startTime: '09:00',
        endDate: '',
        frequency: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [],
          daysOfMonth: [],
          monthsOfYear: []
        },
        exceptions: [],
        enabled: true
      });
    }
  }, [schedule]);

  const [validationError, setValidationError] = useState<string>('');

  // Update form data when schedule prop changes (for editing)
  React.useEffect(() => {
    if (schedule) {
      setFormData({
        id: schedule.id,
        type: schedule.type,
        name: schedule.name,
        startDate: schedule.startDate,
        startTime: schedule.startTime,
        endDate: schedule.endDate,
        frequency: schedule.frequency,
        exceptions: schedule.exceptions,
        enabled: schedule.enabled
      });
    } else {
      // Reset to defaults for new schedule
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      setFormData({
        id: generateId(),
        type: 'recurring',
        name: '',
        startDate: tomorrow.toISOString().split('T')[0],
        startTime: '09:00',
        endDate: '',
        frequency: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [],
          daysOfMonth: [],
          monthsOfYear: []
        },
        exceptions: [],
        enabled: true
      });
    }
  }, [schedule]);

  // Clear validation error when relevant fields change
  React.useEffect(() => {
    if (validationError) {
      setValidationError('');
    }
  }, [formData.startDate, formData.endDate]);

  const handleSave = () => {
    setValidationError('');

    if (!formData.startDate) {
      setValidationError('Start date is required');
      return;
    }

    // Validate end date is not before start date
    if (formData.endDate && formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      setValidationError('End date cannot be before start date');
      return;
    }

    const newSchedule: Schedule = {
      id: formData.id!,
      type: formData.type as Schedule['type'],
      name: formData.name,
      startDate: formData.startDate,
      startTime: formData.startTime,
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
              </SelectContent>
            </Select>
          </div>

          {/* Quick Holiday Selection (for one-time) */}
          {formData.type === 'one-time' && (
            <div className="space-y-2">
              <Label>Quick Select Holiday (optional)</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.name ? getHolidayKeyFromName(formData.name) || "" : ""}
                  onValueChange={(value) => {
                    const currentYear = new Date().getFullYear();
                    const holidayDate = getHolidayDateForYear(value, currentYear);
                    
                    setFormData(prev => ({ 
                      ...prev, 
                      startDate: holidayDate,
                      name: value.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
                    }));
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose a holiday or select date manually" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="christmas">Christmas (Dec 25)</SelectItem>
                    <SelectItem value="thanksgiving">Thanksgiving (Nov)</SelectItem>
                    <SelectItem value="new-year">New Year's Day (Jan 1)</SelectItem>
                    <SelectItem value="valentines">Valentine's Day (Feb 14)</SelectItem>
                    <SelectItem value="easter">Easter</SelectItem>
                    <SelectItem value="mothers-day">Mother's Day</SelectItem>
                    <SelectItem value="fathers-day">Father's Day</SelectItem>
                    <SelectItem value="labor-day">Labor Day</SelectItem>
                    <SelectItem value="halloween">Halloween (Oct 31)</SelectItem>
                    <SelectItem value="independence-day">Independence Day (Jul 4)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.name && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, name: '', startDate: new Date().toISOString().split('T')[0] }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Select a holiday to auto-fill the date, or enter manually below</p>
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={formData.startDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const newDate = e.target.value;
                const holidayName = getHolidayNameForDate(newDate);
                setFormData(prev => ({ 
                  ...prev, 
                  startDate: newDate,
                  name: holidayName || (prev.name && !holidayName ? '' : prev.name) // Clear name if date doesn't match holiday
                }));
              }}
            />
            <p className="text-xs text-muted-foreground">Cannot select dates in the past</p>
          </div>

          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={formData.startTime || '09:00'}
              onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">When should the message be sent?</p>
          </div>

          {/* End Date (for recurring) */}
          {formData.type === 'recurring' && (
            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={formData.endDate || ''}
                min={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">When should the recurring schedule end? (optional)</p>
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

        {validationError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mt-4">
            {validationError}
          </div>
        )}

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