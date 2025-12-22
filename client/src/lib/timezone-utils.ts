/**
 * Timezone Utilities
 * 
 * Centralized timezone handling for the entire application.
 * Every date/time operation should flow through these utilities to ensure
 * consistent timezone awareness across scheduling, notifications, and AI features.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

/**
 * Get the user's current timezone
 * Uses Intl API for accurate browser-based detection
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Failed to detect timezone:', error);
    return 'UTC'; // Fallback to UTC
  }
};

/**
 * Get timezone abbreviation (e.g., "PST", "EST")
 */
export const getTimezoneAbbreviation = (timezone?: string): string => {
  const tz = timezone || getUserTimezone();
  const date = new Date();
  
  try {
    const formatted = date.toLocaleString('en-US', { 
      timeZone: tz, 
      timeZoneName: 'short' 
    });
    
    const match = formatted.match(/\b[A-Z]{2,4}\b$/);
    return match ? match[0] : tz;
  } catch (error) {
    return tz;
  }
};

/**
 * Format a date in the user's timezone with custom format
 * @param date - Date to format (string, Date, or timestamp)
 * @param formatString - date-fns format string
 * @param timezone - Optional timezone (defaults to user's timezone)
 */
export const formatInUserTimezone = (
  date: Date | string | number,
  formatString: string = 'PPp', // e.g., "Apr 29, 2023, 9:30 AM"
  timezone?: string
): string => {
  const tz = timezone || getUserTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  
  try {
    return formatInTimeZone(dateObj, tz, formatString);
  } catch (error) {
    console.error('Failed to format date in timezone:', error);
    return format(dateObj, formatString);
  }
};

/**
 * Format a date/time with timezone indicator
 * Shows both the time and the timezone abbreviation
 */
export const formatWithTimezone = (
  date: Date | string | number,
  timezone?: string
): string => {
  const tz = timezone || getUserTimezone();
  const tzAbbr = getTimezoneAbbreviation(tz);
  const formatted = formatInUserTimezone(date, 'PPp', tz);
  
  return `${formatted} ${tzAbbr}`;
};

/**
 * Convert a date/time from one timezone to another
 * Useful for scheduling across timezones
 */
export const convertTimezone = (
  date: Date | string,
  fromTimezone: string,
  toTimezone: string
): Date => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  try {
    // Convert to the source timezone
    const zonedDate = toZonedTime(dateObj, fromTimezone);
    // Then convert to the target timezone
    return fromZonedTime(zonedDate, toTimezone);
  } catch (error) {
    console.error('Failed to convert timezone:', error);
    return dateObj;
  }
};

/**
 * Create an ISO string that represents a specific time in a specific timezone
 * This is crucial for scheduling - we want "2PM in PST" to be stored correctly
 */
export const createTimezoneAwareISO = (
  date: string, // YYYY-MM-DD
  time: string, // HH:mm
  timezone: string
): string => {
  try {
    // Parse the date and time in the specified timezone
    const dateTimeString = `${date}T${time}:00`;
    const zonedDate = fromZonedTime(new Date(dateTimeString), timezone);
    return zonedDate.toISOString();
  } catch (error) {
    console.error('Failed to create timezone-aware ISO:', error);
    return new Date(`${date}T${time}:00`).toISOString();
  }
};

/**
 * Parse an ISO string and convert it to user's local timezone
 * Returns both the Date object and formatted strings
 */
export const parseToUserTimezone = (
  isoString: string,
  timezone?: string
): {
  date: Date;
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:mm
  formatted: string; // Full formatted string
  tzAbbr: string;
} => {
  const tz = timezone || getUserTimezone();
  const date = parseISO(isoString);
  
  return {
    date,
    dateString: formatInTimeZone(date, tz, 'yyyy-MM-dd'),
    timeString: formatInTimeZone(date, tz, 'HH:mm'),
    formatted: formatInTimeZone(date, tz, 'PPp'),
    tzAbbr: getTimezoneAbbreviation(tz),
  };
};

/**
 * Get current date/time in user's timezone
 */
export const getNowInUserTimezone = (timezone?: string) => {
  const tz = timezone || getUserTimezone();
  return toZonedTime(new Date(), tz);
};

/**
 * Format a schedule time display with timezone context
 * Example: "Tomorrow at 2:00 PM PST" or "Dec 25 at 9:00 AM EST"
 */
export const formatScheduleTime = (
  date: string | Date,
  time?: string,
  timezone?: string
): string => {
  const tz = timezone || getUserTimezone();
  const tzAbbr = getTimezoneAbbreviation(tz);
  
  try {
    if (time && time.trim()) {
      // If we have separate date and time, combine them
      const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
      const fullDate = new Date(`${dateStr}T${time}`);
      
      // Validate the date is valid
      if (isNaN(fullDate.getTime())) {
        throw new Error('Invalid date/time combination');
      }
      
      return `${formatInTimeZone(fullDate, tz, 'MMM d')} at ${formatInTimeZone(fullDate, tz, 'h:mm a')} ${tzAbbr}`;
    }
    
    // If just a date object, format it
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Validate the date is valid
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date');
    }
    
    return formatWithTimezone(dateObj, tz);
  } catch (error) {
    console.error('Error formatting schedule time:', error, { date, time, timezone });
    return 'Invalid date';
  }
};

/**
 * Check if a scheduled time has passed in the user's timezone
 */
export const hasScheduleTimePassed = (
  date: string,
  time: string,
  timezone?: string
): boolean => {
  const tz = timezone || getUserTimezone();
  const scheduleDate = new Date(`${date}T${time}`);
  const now = getNowInUserTimezone(tz);
  
  return scheduleDate < now;
};

/**
 * Get appropriate datetime input min/max values in user's timezone
 */
export const getDateTimeInputBounds = (timezone?: string) => {
  const tz = timezone || getUserTimezone();
  const now = getNowInUserTimezone(tz);
  
  return {
    minDate: formatInTimeZone(now, tz, 'yyyy-MM-dd'),
    minTime: formatInTimeZone(now, tz, 'HH:mm'),
    maxDate: formatInTimeZone(
      new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
      tz,
      'yyyy-MM-dd'
    ),
  };
};

/**
 * Format relative time (e.g., "2 hours ago") with timezone awareness
 */
export const formatRelativeTime = (
  date: Date | string,
  timezone?: string
): string => {
  const tz = timezone || getUserTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const now = getNowInUserTimezone(tz);
  
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return formatInUserTimezone(dateObj, 'PP', tz); // Fall back to date
};

/**
 * Validate timezone string
 */
export const isValidTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get a list of common timezones for user selection
 */
export const getCommonTimezones = (): Array<{ label: string; value: string }> => {
  return [
    { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
    { label: 'Mountain Time (MT)', value: 'America/Denver' },
    { label: 'Central Time (CT)', value: 'America/Chicago' },
    { label: 'Eastern Time (ET)', value: 'America/New_York' },
    { label: 'Alaska Time (AKT)', value: 'America/Anchorage' },
    { label: 'Hawaii Time (HT)', value: 'Pacific/Honolulu' },
    { label: 'London (GMT/BST)', value: 'Europe/London' },
    { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Berlin (CET/CEST)', value: 'Europe/Berlin' },
    { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
    { label: 'Sydney (AEDT/AEST)', value: 'Australia/Sydney' },
    { label: 'Auckland (NZDT/NZST)', value: 'Pacific/Auckland' },
    { label: 'Dubai (GST)', value: 'Asia/Dubai' },
    { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
    { label: 'Hong Kong (HKT)', value: 'Asia/Hong_Kong' },
    { label: 'UTC', value: 'UTC' },
  ];
};
