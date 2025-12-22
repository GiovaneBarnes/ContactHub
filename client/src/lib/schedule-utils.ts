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
    occurrences.push(...nextDates
      .filter(date => date && !isNaN(date.getTime())) // Filter out invalid dates
      .map(date => ({
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
      const oneTimeDate = combineDateAndTime(schedule.startDate, schedule.startTime);
      if (oneTimeDate >= fromDate && !isNaN(oneTimeDate.getTime())) {
        occurrences.push(oneTimeDate);
      }
      break;

    case 'recurring':
      occurrences.push(...getRecurringOccurrences(schedule, fromDate, count));
      break;
  }

  // Filter out exceptions and invalid dates
  return occurrences.filter(date =>
    !isNaN(date.getTime()) &&
    !schedule.exceptions?.some(exc => {
      const excDate = new Date(exc);
      return !isNaN(excDate.getTime()) && excDate.toDateString() === date.toDateString();
    })
  );
}

/**
 * Get recurring occurrences based on frequency
 */
function getRecurringOccurrences(schedule: Schedule, fromDate: Date, count: number): Date[] {
  const occurrences: Date[] = [];
  const { frequency } = schedule;

  if (!frequency) return occurrences;

  let currentDate = combineDateAndTime(schedule.startDate, schedule.startTime);

  // If start date is in the past, find the next valid occurrence
  if (currentDate < fromDate) {
    currentDate = getNextValidDate(currentDate, frequency, fromDate);
  }

  while (occurrences.length < count && (!schedule.endDate || currentDate <= new Date(schedule.endDate))) {
    // Only add valid dates
    if (!isNaN(currentDate.getTime())) {
      occurrences.push(new Date(currentDate));
    }

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
 * Get annual occurrences for holidays/special days
 */
function getAnnualOccurrences(schedule: Schedule, fromDate: Date, count: number): Date[] {
  const occurrences: Date[] = [];
  const startDate = combineDateAndTime(schedule.startDate, schedule.startTime);
  const currentYear = fromDate.getFullYear();

  for (let i = 0; i < count; i++) {
    const occurrenceDate = new Date(currentYear + i, startDate.getMonth(), startDate.getDate());
    if (schedule.startTime) {
      occurrenceDate.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
    }

    if (occurrenceDate >= fromDate && !isNaN(occurrenceDate.getTime())) {
      occurrences.push(occurrenceDate);
    }
  }

  return occurrences;
}

/**
 * Combine date string and time string into a Date object
 */
function combineDateAndTime(dateStr: string, timeStr?: string): Date {
  // Validate date string
  if (!dateStr || dateStr.trim() === '') {
    console.warn('combineDateAndTime: Invalid date string provided:', dateStr);
    return new Date(); // Return current date as fallback
  }

  const date = new Date(dateStr);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.warn('combineDateAndTime: Invalid date created from string:', dateStr);
    return new Date(); // Return current date as fallback
  }

  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
  } else {
    // Default to 9 AM if no time specified
    date.setHours(9, 0, 0, 0);
  }

  return date;
}

/**
 * Format a schedule for display
 */
export function formatSchedule(schedule: Schedule): string {
  const timeStr = schedule.startTime ? ` at ${new Date(`2000-01-01T${schedule.startTime}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}` : '';

  switch (schedule.type) {
    case 'one-time':
      try {
        const dateStr = new Date(schedule.startDate).toLocaleDateString();
        return schedule.name ? `${schedule.name} (${dateStr}${timeStr})` : `Once on ${dateStr}${timeStr}`;
      } catch (error) {
        console.warn('formatSchedule: Invalid startDate for one-time schedule:', schedule.startDate);
        return schedule.name ? `${schedule.name} (Invalid date${timeStr})` : `Once on invalid date${timeStr}`;
      }

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

      return description + timeStr;

    default:
      return 'Unknown schedule type';
  }
}