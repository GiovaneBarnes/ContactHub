import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUserTimezone,
  getTimezoneAbbreviation,
  formatInUserTimezone,
  formatWithTimezone,
  convertTimezone,
  createTimezoneAwareISO,
  parseToUserTimezone,
  getNowInUserTimezone,
  formatScheduleTime,
  hasScheduleTimePassed,
  getDateTimeInputBounds,
  formatRelativeTime,
  isValidTimezone,
  getCommonTimezones,
} from '../timezone-utils';

// Mock date-fns-tz
vi.mock('date-fns-tz', () => ({
  formatInTimeZone: vi.fn(),
  toZonedTime: vi.fn(),
  fromZonedTime: vi.fn(),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(),
  parseISO: vi.fn(),
}));

// Import the mocked functions
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

// Mock Intl.DateTimeFormat
const mockDateTimeFormat = vi.fn();
const mockResolvedOptions = vi.fn();

// Mock Date.prototype.toLocaleString
const mockToLocaleString = vi.fn();

beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Mock Intl.DateTimeFormat
  global.Intl.DateTimeFormat = mockDateTimeFormat;
  mockDateTimeFormat.prototype.resolvedOptions = mockResolvedOptions;

  // Mock Date.prototype.toLocaleString
  Date.prototype.toLocaleString = mockToLocaleString;

  // Default mock implementations
  mockResolvedOptions.mockReturnValue({ timeZone: 'America/New_York' });
  mockDateTimeFormat.mockImplementation(() => ({
    resolvedOptions: mockResolvedOptions,
    format: vi.fn().mockReturnValue('12/21/2025, 2:30 PM EST'),
  }));

  mockToLocaleString.mockImplementation((locale, options) => {
    if (options?.timeZone === 'UTC') {
      return '12/21/2025, 2:30:00 PM UTC';
    }
    return '12/21/2025, 2:30:00 PM EST';
  });

  // Mock date-fns-tz functions
  vi.mocked(formatInTimeZone).mockReturnValue('Dec 21, 2025, 2:30 PM');
  vi.mocked(toZonedTime).mockReturnValue(new Date('2025-12-21T14:30:00Z'));
  vi.mocked(fromZonedTime).mockReturnValue(new Date('2025-12-21T19:30:00Z'));

  // Mock date-fns functions
  vi.mocked(format).mockReturnValue('Dec 21, 2025');
  vi.mocked(parseISO).mockReturnValue(new Date('2025-12-21T14:30:00Z'));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('Timezone Utils', () => {
  describe('getUserTimezone', () => {
    it('should return the user timezone from Intl API', () => {
      mockResolvedOptions.mockReturnValue({ timeZone: 'Europe/London' });

      const result = getUserTimezone();

      expect(result).toBe('Europe/London');
      expect(mockResolvedOptions).toHaveBeenCalled();
    });

    it('should fallback to UTC on error', () => {
      mockResolvedOptions.mockImplementation(() => {
        throw new Error('Intl not available');
      });

      const result = getUserTimezone();

      expect(result).toBe('UTC');
    });
  });

  describe('getTimezoneAbbreviation', () => {
    it('should return timezone abbreviation', () => {
      const result = getTimezoneAbbreviation('America/New_York');

      expect(result).toBe('EST');
      expect(mockToLocaleString).toHaveBeenCalledWith('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      });
    });

    it('should return the timezone name if no abbreviation found', () => {
      mockToLocaleString.mockImplementation(() => {
        throw new Error('Invalid timezone');
      });

      const result = getTimezoneAbbreviation('Invalid/Timezone');

      expect(result).toBe('Invalid/Timezone');
    });

    it('should use user timezone when none provided', () => {
      const result = getTimezoneAbbreviation();

      expect(mockResolvedOptions).toHaveBeenCalled();
    });
  });

  describe('formatInUserTimezone', () => {
    it('should format date in user timezone', () => {
      const date = new Date('2025-12-21T14:30:00Z');

      const result = formatInUserTimezone(date, 'PPp');

      expect(result).toBe('Dec 21, 2025, 2:30 PM');
      expect(vi.mocked(formatInTimeZone)).toHaveBeenCalledWith(date, 'America/New_York', 'PPp');
    });

    it('should handle string dates', () => {
      const result = formatInUserTimezone('2025-12-21T14:30:00Z', 'PPp');

      expect(result).toBe('Dec 21, 2025, 2:30 PM');
      expect(vi.mocked(parseISO)).toHaveBeenCalledWith('2025-12-21T14:30:00Z');
    });

    it('should handle timestamp numbers', () => {
      const timestamp = Date.now();

      const result = formatInUserTimezone(timestamp, 'PPp');

      expect(result).toBe('Dec 21, 2025, 2:30 PM');
    });

    it('should fallback to format on error', () => {
      vi.mocked(formatInTimeZone).mockImplementation(() => {
        throw new Error('Timezone error');
      });

      const date = new Date();

      const result = formatInUserTimezone(date, 'PPp');

      expect(vi.mocked(format)).toHaveBeenCalledWith(date, 'PPp');
    });
  });

  describe('formatWithTimezone', () => {
    it('should format date with timezone indicator', () => {
      const date = new Date('2025-12-21T14:30:00Z');

      const result = formatWithTimezone(date);

      expect(result).toContain('EST'); // Should include timezone abbreviation
      expect(result).toBeDefined();
    });
  });

  describe('convertTimezone', () => {
    it('should convert date between timezones', () => {
      const date = new Date('2025-12-21T14:30:00Z');

      const result = convertTimezone(date, 'UTC', 'America/New_York');

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).not.toBe(date.getTime()); // Should be different due to timezone conversion
    });

    it('should handle string dates', () => {
      const result = convertTimezone('2025-12-21T14:30:00Z', 'UTC', 'America/New_York');

      expect(result).toBeInstanceOf(Date);
    });

    it('should return original date on error', () => {
      vi.mocked(toZonedTime).mockImplementation(() => {
        throw new Error('Timezone error');
      });

      const date = new Date('2025-12-21T14:30:00Z');

      const result = convertTimezone(date, 'UTC', 'America/New_York');

      expect(result).toBe(date);
    });
  });

  describe('createTimezoneAwareISO', () => {
    it('should create timezone-aware ISO string', () => {
      const result = createTimezoneAwareISO('2025-12-21', '14:30', 'America/New_York');

      expect(result).toBe('2025-12-21T19:30:00.000Z');
      expect(vi.mocked(fromZonedTime)).toHaveBeenCalledWith(new Date('2025-12-21T14:30:00'), 'America/New_York');
    });
  });

  describe('parseToUserTimezone', () => {
    it('should parse ISO string to user timezone components', () => {
      const isoString = '2025-12-21T14:30:00Z';

      const result = parseToUserTimezone(isoString);

      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('dateString');
      expect(result).toHaveProperty('timeString');
      expect(result).toHaveProperty('formatted');
      expect(result).toHaveProperty('tzAbbr');

      expect(result.date).toBeInstanceOf(Date);
      expect(typeof result.dateString).toBe('string');
      expect(typeof result.timeString).toBe('string');
      expect(typeof result.formatted).toBe('string');
      expect(typeof result.tzAbbr).toBe('string');
    });

    it('should use provided timezone', () => {
      const result = parseToUserTimezone('2025-12-21T14:30:00Z', 'UTC');

      expect(result.tzAbbr).toBe('UTC');
    });
  });

  describe('getNowInUserTimezone', () => {
    it('should return current date/time in user timezone', () => {
      const result = getNowInUserTimezone();

      expect(result).toBeInstanceOf(Date);
    });

    it('should use provided timezone', () => {
      const result = getNowInUserTimezone('UTC');

      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('formatScheduleTime', () => {
    it('should format schedule time with date and time', () => {
      const result = formatScheduleTime('2025-12-21', '14:30');

      expect(typeof result).toBe('string');
      expect(result).toContain('Dec 21');
      expect(result).toContain('EST');
    });

    it('should format schedule time with just date object', () => {
      const date = new Date('2025-12-21T14:30:00Z');

      const result = formatScheduleTime(date);

      expect(typeof result).toBe('string');
    });

    it('should handle invalid dates', () => {
      const result = formatScheduleTime('invalid-date', 'invalid-time');

      expect(result).toBe('Invalid date');
    });
  });

  describe('hasScheduleTimePassed', () => {
    it('should return true for past dates', () => {
      const pastDate = '2020-01-01';
      const pastTime = '12:00';

      const result = hasScheduleTimePassed(pastDate, pastTime);

      expect(result).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = '2030-01-01';
      const futureTime = '12:00';

      const result = hasScheduleTimePassed(futureDate, futureTime);

      expect(result).toBe(false);
    });
  });

  describe('getDateTimeInputBounds', () => {
    it('should return input bounds for current timezone', () => {
      const result = getDateTimeInputBounds();

      expect(result).toHaveProperty('minDate');
      expect(result).toHaveProperty('minTime');
      expect(result).toHaveProperty('maxDate');

      expect(typeof result.minDate).toBe('string');
      expect(typeof result.minTime).toBe('string');
      expect(typeof result.maxDate).toBe('string');
    });

    it('should use provided timezone', () => {
      const result = getDateTimeInputBounds('UTC');

      expect(result).toBeDefined();
    });
  });

  describe('formatRelativeTime', () => {
    it('should format just now', () => {
      const now = new Date();

      const result = formatRelativeTime(now);

      expect(typeof result).toBe('string');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const result = formatRelativeTime(fiveMinutesAgo);

      expect(typeof result).toBe('string');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const result = formatRelativeTime(twoHoursAgo);

      expect(typeof result).toBe('string');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const result = formatRelativeTime(threeDaysAgo);

      expect(typeof result).toBe('string');
    });

    it('should format as date for older dates', () => {
      const oldDate = new Date('2020-01-01');

      const result = formatRelativeTime(oldDate);

      expect(typeof result).toBe('string');
    });
  });

  describe('isValidTimezone', () => {
    it('should return true for valid timezones', () => {
      const result = isValidTimezone('America/New_York');

      expect(result).toBe(true);
    });

    it('should return false for invalid timezones', () => {
      mockDateTimeFormat.mockImplementation(() => {
        throw new Error('Invalid timezone');
      });

      const result = isValidTimezone('Invalid/Timezone');

      expect(result).toBe(false);
    });
  });

  describe('getCommonTimezones', () => {
    it('should return array of common timezones', () => {
      const result = getCommonTimezones();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      result.forEach(tz => {
        expect(tz).toHaveProperty('label');
        expect(tz).toHaveProperty('value');
        expect(typeof tz.label).toBe('string');
        expect(typeof tz.value).toBe('string');
      });
    });

    it('should include major timezones', () => {
      const result = getCommonTimezones();

      const labels = result.map(tz => tz.label);
      expect(labels).toContain('Pacific Time (PT)');
      expect(labels).toContain('Eastern Time (ET)');
      expect(labels).toContain('London (GMT/BST)');
      expect(labels).toContain('Tokyo (JST)');
      expect(labels).toContain('UTC');
    });
  });
});