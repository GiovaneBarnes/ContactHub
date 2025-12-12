import { Schedule } from './types';

export interface NextOccurrence {
  date: Date;
  scheduleId: string;
  scheduleName?: string;
}

/**
 * Calculate the next occurrence dates for all schedules
 */
export function getNextOccurrences(schedules: Schedule[], fromDate: Date = new Date(), count: number = 5): NextOccurrence[] {
  const occurrences: NextOccurrence[] = [];

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;

    const nextDates = getNextScheduleOccurrences(schedule, fromDate, count);
    occurrences.push(...nextDates.map(date => ({
      date,
      scheduleId: schedule.id,
      scheduleName: schedule.name
    })));
  }

  // Sort by date and return the earliest ones
  return occurrences
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, count);
}

/**
 * Get next occurrence dates for a single schedule
 */
function getNextScheduleOccurrences(schedule: Schedule, fromDate: Date, count: number): Date[] {
  const occurrences: Date[] = [];

  switch (schedule.type) {
    case 'one-time':
      const oneTimeDate = new Date(schedule.startDate);
      if (oneTimeDate >= fromDate) {
        occurrences.push(oneTimeDate);
      }
      break;

    case 'recurring':
      occurrences.push(...getRecurringOccurrences(schedule, fromDate, count));
      break;

    case 'holiday':
    case 'special-day':
      // For holidays/special days, they occur annually on the same date
      occurrences.push(...getAnnualOccurrences(schedule, fromDate, count));
      break;
  }

  // Filter out exceptions
  return occurrences.filter(date =>
    !schedule.exceptions?.some(exc => new Date(exc).toDateString() === date.toDateString())
  );
}

/**
 * Get recurring occurrences based on frequency
 */
function getRecurringOccurrences(schedule: Schedule, fromDate: Date, count: number): Date[] {
  const occurrences: Date[] = [];
  const { frequency } = schedule;

  if (!frequency) return occurrences;

  let currentDate = new Date(schedule.startDate);

  // If start date is in the past, find the next valid occurrence
  if (currentDate < fromDate) {
    currentDate = getNextValidDate(currentDate, frequency, fromDate);
  }

  while (occurrences.length < count && (!schedule.endDate || currentDate <= new Date(schedule.endDate))) {
    occurrences.push(new Date(currentDate));

    // Calculate next occurrence
    switch (frequency.type) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + frequency.interval);
        break;
      case 'weekly':
        if (frequency.daysOfWeek && frequency.daysOfWeek.length > 0) {
          currentDate = getNextWeekday(currentDate, frequency.daysOfWeek, frequency.interval);
        } else {
          currentDate.setDate(currentDate.getDate() + (frequency.interval * 7));
        }
        break;
      case 'monthly':
        if (frequency.daysOfMonth && frequency.daysOfMonth.length > 0) {
          currentDate = getNextMonthDay(currentDate, frequency.daysOfMonth, frequency.interval);
        } else {
          currentDate.setMonth(currentDate.getMonth() + frequency.interval);
        }
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + frequency.interval);
        break;
    }
  }

  return occurrences;
}

/**
 * Get annual occurrences for holidays/special days
 */
function getAnnualOccurrences(schedule: Schedule, fromDate: Date, count: number): Date[] {
  const occurrences: Date[] = [];
  const startDate = new Date(schedule.startDate);

  let year = fromDate.getFullYear();
  if (startDate.getMonth() < fromDate.getMonth() ||
      (startDate.getMonth() === fromDate.getMonth() && startDate.getDate() < fromDate.getDate())) {
    year++;
  }

  for (let i = 0; i < count; i++) {
    const occurrence = new Date(year + i, startDate.getMonth(), startDate.getDate());
    occurrences.push(occurrence);
  }

  return occurrences;
}

/**
 * Find the next valid date after fromDate based on frequency
 */
function getNextValidDate(startDate: Date, frequency: Schedule['frequency'], fromDate: Date): Date {
  let current = new Date(startDate);

  while (current < fromDate) {
    switch (frequency?.type) {
      case 'daily':
        current.setDate(current.getDate() + frequency.interval);
        break;
      case 'weekly':
        current.setDate(current.getDate() + (frequency.interval * 7));
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + frequency.interval);
        break;
      case 'yearly':
        current.setFullYear(current.getFullYear() + frequency.interval);
        break;
    }
  }

  return current;
}

/**
 * Get the next occurrence on specified weekdays
 */
function getNextWeekday(current: Date, daysOfWeek: number[], weeksInterval: number): Date {
  const next = new Date(current);
  let daysToAdd = 0;
  let found = false;

  // Check up to 7 days ahead
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(next);
    checkDate.setDate(checkDate.getDate() + i);
    if (daysOfWeek.includes(checkDate.getDay())) {
      daysToAdd = i;
      found = true;
      break;
    }
  }

  if (!found) {
    // If no valid day this week, skip to next week interval
    daysToAdd = 7 * weeksInterval;
  }

  next.setDate(next.getDate() + daysToAdd);
  return next;
}

/**
 * Get the next occurrence on specified days of month
 */
function getNextMonthDay(current: Date, daysOfMonth: number[], monthsInterval: number): Date {
  const next = new Date(current);
  let found = false;

  // Try current month
  for (const day of daysOfMonth) {
    const testDate = new Date(next.getFullYear(), next.getMonth(), day);
    if (testDate > next) {
      next.setDate(day);
      found = true;
      break;
    }
  }

  if (!found) {
    // Move to next month interval and take the first valid day
    next.setMonth(next.getMonth() + monthsInterval);
    next.setDate(Math.min(...daysOfMonth));
  }

  return next;
}

/**
 * Format a schedule for display
 */
export function formatSchedule(schedule: Schedule): string {
  switch (schedule.type) {
    case 'one-time':
      return `Once on ${new Date(schedule.startDate).toLocaleDateString()}`;

    case 'recurring':
      if (!schedule.frequency) return 'Invalid recurring schedule';

      const interval = schedule.frequency.interval;
      const type = schedule.frequency.type;

      let description = `Every ${interval === 1 ? '' : interval + ' '}${type}`;
      if (interval > 1) {
        description = description.replace(/s$/, ''); // Remove trailing s for plural
        description += 's';
      }

      if (schedule.frequency.daysOfWeek && schedule.frequency.daysOfWeek.length > 0) {
        const days = schedule.frequency.daysOfWeek.map(d =>
          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
        ).join(', ');
        description += ` on ${days}`;
      }

      if (schedule.frequency.daysOfMonth && schedule.frequency.daysOfMonth.length > 0) {
        description += ` on day${schedule.frequency.daysOfMonth.length > 1 ? 's' : ''} ${schedule.frequency.daysOfMonth.join(', ')}`;
      }

      return description;

    case 'holiday':
    case 'special-day':
      return `${schedule.name || 'Special Day'} (${new Date(schedule.startDate).toLocaleDateString()})`;

    default:
      return 'Unknown schedule type';
  }
}