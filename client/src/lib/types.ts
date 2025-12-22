import { NotificationPreferences } from './notification-types';

export interface User {
  id: string;
  email: string;
  name: string;
  timezone?: string; // User's primary timezone
  preferences?: {
    hasCompletedOnboarding?: boolean;
    onboardingCompletedAt?: string;
    notifications?: NotificationPreferences;
  };
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  // AI-enhanced fields
  timezone?: string;
  preferredContactTimes?: string[];
  communicationStyle?: 'professional' | 'casual' | 'formal';
  relationship?: string;
  lastContact?: string;
  tags?: string[];
  // AI-generated categorization
  aiCategories?: string[];
  aiTags?: string[];
  aiCategorizedAt?: string;
}

export interface Schedule {
  id: string;
  type: 'one-time' | 'recurring';
  name?: string; // For holidays/special days
  message?: string; // Message content to send
  startDate: string; // ISO date string
  startTime?: string; // HH:MM format (24-hour)
  endDate?: string; // For recurring schedules with end date
  frequency?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // every N days/weeks/months/years
    daysOfWeek?: number[]; // 0-6, Sunday=0 for weekly
    daysOfMonth?: number[]; // 1-31 for monthly
    monthsOfYear?: number[]; // 0-11, January=0 for yearly
  };
  exceptions?: string[]; // ISO date strings to skip
  enabled: boolean;
  timezone?: string; // User's timezone when schedule was created (IANA format)
}

export interface Group {
  id: string;
  name: string;
  description: string;
  contactIds: string[];
  schedules: Schedule[];
  backgroundInfo: string;
  enabled: boolean;
  isSystem?: boolean; // System groups like "All Contacts" cannot be deleted
}

export interface MessageLog {
  id: string;
  groupId: string;
  groupName: string;
  messageContent: string;
  recipients: number; // count of recipients
  timestamp: string;
  status: 'sent' | 'failed';
  deliveryMethod: 'sms' | 'email' | 'both';
  recipientDetails: MessageRecipient[];
  groupDeleted?: boolean; // Track if the associated group was deleted
}

export interface MessageRecipient {
  contactId: string;
  name: string;
  email: string;
  phone: string;
  smsStatus: 'sent' | 'failed' | 'not_sent';
  emailStatus: 'sent' | 'failed' | 'not_sent';
  errorMessage?: string;
}

// AI-powered features types
export interface ContactCategorization {
  categories: string[];
  tags: string[];
  reasoning: string;
}

export interface CommunicationAnalysis {
  frequency: string;
  preferredMethod: string;
  nextContactSuggestion: string;
  insights: string[];
}

export interface ContactTimeSuggestion {
  recommendedTime: string;
  reasoning: string;
  alternatives: string[];
}
