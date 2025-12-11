export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface Schedule {
  date: string; // ISO date string
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
}

export interface Group {
  id: string;
  name: string;
  description: string;
  contactIds: string[];
  schedule: Schedule[];
  backgroundInfo: string;
}

export interface MessageLog {
  id: string;
  groupId: string;
  groupName: string;
  messageContent: string;
  recipients: number; // count of recipients
  timestamp: string;
  status: 'sent' | 'failed';
}
