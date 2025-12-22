/**
 * Notification System Types
 * 
 * A sophisticated, user-friendly notification system that:
 * - Provides granular control without overwhelming users
 * - Uses smart defaults based on behavioral psychology
 * - Groups settings logically by context
 * - Enables both engagement and peace of mind
 */

export type NotificationChannel = 'email' | 'push' | 'inApp' | 'sms';
export type NotificationFrequency = 'instant' | 'digest-daily' | 'digest-weekly' | 'off';
export type DigestTime = '08:00' | '12:00' | '17:00' | '20:00'; // Morning, Noon, Evening, Night
export type QuietHoursPreset = 'work' | 'sleep' | 'custom' | 'off';

/**
 * Core notification preferences structure
 */
export interface NotificationPreferences {
  // Meta settings
  enabled: boolean; // Master switch
  lastUpdated: string;
  
  // Email is the only channel we need
  emailEnabled: boolean;
  
  // Digest preferences (batch notifications to reduce email clutter)
  digest: {
    enabled: boolean;
    time: DigestTime;
    daysOfWeek: number[]; // 0-6, Sunday=0
    includeTypes: NotificationType[];
  };
  
  // Category-specific preferences
  categories: {
    // AI Insights - The "wow" factor
    aiInsights: NotificationCategorySettings & {
      insightTypes: {
        relationshipHealth: boolean; // "You haven't talked to Sarah in 3 months"
        smartSuggestions: boolean; // "Perfect time to reach out to John"
        contactPatterns: boolean; // "You contact friends less on Mondays"
        celebrations: boolean; // "5 birthdays this week!"
      };
    };
    
    // Scheduled Messages - Core functionality
    scheduledMessages: NotificationCategorySettings & {
      reminders: {
        oneDayBefore: boolean;
        oneHourBefore: boolean;
        onSend: boolean;
      };
    };
    
    // Contact Activity - Engagement driver
    contactActivity: NotificationCategorySettings & {
      newContacts: boolean;
      importComplete: boolean;
      bulkActions: boolean;
    };
    
    // System & Account - Trust & transparency
    system: NotificationCategorySettings & {
      security: boolean; // Always important
      billing: boolean; // Payment-related
      updates: boolean; // New features
      tips: boolean; // Helpful onboarding tips
    };
    
    // Social & Engagement - Growth mechanics
    social: NotificationCategorySettings & {
      achievements: boolean; // "You've stayed in touch with 50 people!"
      milestones: boolean; // "100 contacts organized!"
      referrals: boolean; // "Your friend joined!"
    };
  };
}

/**
 * Settings for each notification category
 */
export interface NotificationCategorySettings {
  enabled: boolean;
  frequency: NotificationFrequency;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Notification types for routing and display
 */
export type NotificationType =
  // AI Insights
  | 'ai-relationship-health'
  | 'ai-smart-suggestion'
  | 'ai-contact-pattern'
  | 'ai-celebration'
  
  // Scheduled Messages
  | 'schedule-reminder-day'
  | 'schedule-reminder-hour'
  | 'schedule-sent'
  | 'schedule-failed'
  
  // Contact Activity
  | 'contact-new'
  | 'contact-import-complete'
  | 'contact-bulk-action'
  
  // System
  | 'system-security'
  | 'system-billing'
  | 'system-update'
  | 'system-tip'
  
  // Social
  | 'social-achievement'
  | 'social-milestone'
  | 'social-referral';

/**
 * Individual notification structure
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  
  // Content
  title: string;
  message: string;
  icon?: string;
  image?: string;
  
  // Metadata
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: keyof NotificationPreferences['categories'];
  createdAt: string;
  readAt?: string;
  
  // Actions
  actionUrl?: string;
  actionLabel?: string;
  dismissible: boolean;
  
  // Delivery tracking
  channels: {
    email?: { sent: boolean; sentAt?: string; opened?: boolean };
    push?: { sent: boolean; sentAt?: string; clicked?: boolean };
    inApp?: { shown: boolean; shownAt?: string };
    sms?: { sent: boolean; sentAt?: string };
  };
  
  // Context data (for rendering)
  data?: Record<string, any>;
}

/**
/**
 * Smart default preferences - based on user psychology and best practices
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  lastUpdated: new Date().toISOString(),
  
  emailEnabled: true, // Email is our primary notification channel
  
  digest: {
    enabled: false, // Start with instant, let users discover digest
    time: '08:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
    includeTypes: [
      'ai-contact-pattern',
      'contact-bulk-action',
      'system-tip',
    ],
  },
  
  categories: {
    // AI Insights - High engagement, medium frequency
    aiInsights: {
      enabled: true,
      frequency: 'instant',
      priority: 'medium',
      insightTypes: {
        relationshipHealth: true, // High value
        smartSuggestions: true, // High value
        contactPatterns: false, // Lower priority
        celebrations: true, // Delightful
      },
    },
    
    // Scheduled Messages - Critical functionality
    scheduledMessages: {
      enabled: true,
      frequency: 'instant',
      priority: 'high',
      reminders: {
        oneDayBefore: true,
        oneHourBefore: true,
        onSend: true,
      },
    },
    
    // Contact Activity - Moderate engagement
    contactActivity: {
      enabled: true,
      frequency: 'instant',
      priority: 'low',
      newContacts: false, // Can be noisy
      importComplete: true, // Important milestone
      bulkActions: true, // Confirmation
    },
    
    // System - Trust and transparency
    system: {
      enabled: true,
      frequency: 'instant',
      priority: 'high',
      security: true, // Critical
      billing: true, // Critical
      updates: true, // Excitement
      tips: true, // Education
    },
    
    // Social - Gamification and delight
    social: {
      enabled: true,
      frequency: 'instant',
      priority: 'low',
      achievements: true, // Dopamine hit
      milestones: true, // Celebration
      referrals: false, // Opt-in to avoid annoyance
    },
  },
};
/**
 * Quiet hours presets
 */
export const QUIET_HOURS_PRESETS: Record<Exclude<QuietHoursPreset, 'custom' | 'off'>, { start: string; end: string; label: string }> = {
  work: {
    start: '09:00',
    end: '17:00',
    label: 'Work Hours (9 AM - 5 PM)',
  },
  sleep: {
    start: '22:00',
    end: '08:00',
    label: 'Sleep Time (10 PM - 8 AM)',
  },
};

/**
 * Digest time options with user-friendly labels
 */
export const DIGEST_TIME_OPTIONS: Array<{ value: DigestTime; label: string; description: string }> = [
  { value: '08:00', label: 'Morning', description: 'Start your day informed (8 AM)' },
  { value: '12:00', label: 'Midday', description: 'Lunch break update (12 PM)' },
  { value: '17:00', label: 'Evening', description: 'End of workday summary (5 PM)' },
  { value: '20:00', label: 'Night', description: 'Wind down with insights (8 PM)' },
];