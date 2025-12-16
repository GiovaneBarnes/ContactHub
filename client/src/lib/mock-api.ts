import { Contact, Group, MessageLog, User } from "./types";

// Initial Mock Data
let MOCK_USERS: User[] = [
  { id: '1', email: 'user@example.com', name: 'Demo User' }
];

let MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Alice Johnson', phone: '+15550101', email: 'alice@example.com', notes: 'Colleague from Marketing' },
  { id: '2', name: 'Bob Smith', phone: '+15550102', email: 'bob@example.com', notes: 'Gym buddy' },
  { id: '3', name: 'Charlie Brown', phone: '+15550103', email: 'charlie@example.com', notes: 'Contractor' },
];

let MOCK_GROUPS: Group[] = [
  { 
    id: '1', 
    name: 'Marketing Team', 
    description: 'Weekly updates for the marketing department', 
    contactIds: ['1'],
    schedules: [
      {
        id: '1',
        type: 'recurring',
        startDate: new Date().toISOString(),
        startTime: '09:00',
        frequency: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1] // Monday
        },
        enabled: true
      }
    ],
    backgroundInfo: 'Focus on upcoming campaign launches and social media metrics.'
  },
  { 
    id: '2', 
    name: 'Gym Friends', 
    description: 'Weekend workout coordination', 
    contactIds: ['2'],
    schedules: [
      {
        id: '2',
        type: 'recurring',
        startDate: new Date().toISOString(),
        startTime: '08:00',
        frequency: {
          type: 'weekly',
          interval: 2,
          daysOfWeek: [6] // Saturday
        },
        enabled: true
      }
    ],
    backgroundInfo: 'Casual tone, coordinate times for Saturday morning session.'
  },
  {
    id: '3',
    name: 'Family',
    description: 'Important family updates and celebrations',
    contactIds: [],
    schedules: [
      {
        id: '3',
        type: 'one-time',
        name: 'Christmas',
        startDate: '2024-12-25T00:00:00.000Z',
        enabled: true
      },
      {
        id: '4',
        type: 'recurring',
        startDate: new Date().toISOString(),
        frequency: {
          type: 'monthly',
          interval: 1,
          daysOfMonth: [1] // First of every month
        },
        enabled: true
      }
    ],
    backgroundInfo: 'Warm and personal communication for family matters.'
  }
];

let MOCK_LOGS: MessageLog[] = [
  {
    id: '1',
    groupId: '1',
    groupName: 'Marketing Team',
    messageContent: 'Hey team, just a reminder to update your metrics for the week.',
    recipients: 1,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'sent'
  }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      await delay(500);
      if (email === 'user@example.com' && password === 'password') {
        return MOCK_USERS[0];
      }
      throw new Error('Invalid credentials');
    },
    signup: async (email: string, password: string, name: string): Promise<User> => {
      await delay(500);
      const newUser = { id: Math.random().toString(), email, name };
      MOCK_USERS.push(newUser);
      return newUser;
    },
    getCurrentUser: async (): Promise<User | null> => {
       // Simulate session
       return MOCK_USERS[0]; 
    }
  },
  contacts: {
    list: async (): Promise<Contact[]> => {
      await delay(300);
      return [...MOCK_CONTACTS];
    },
    create: async (data: Omit<Contact, 'id'>): Promise<Contact> => {
      await delay(300);
      const newContact = { ...data, id: Math.random().toString(36).substr(2, 9) };
      MOCK_CONTACTS.push(newContact);
      return newContact;
    },
    update: async (id: string, data: Partial<Contact>): Promise<Contact> => {
      await delay(300);
      MOCK_CONTACTS = MOCK_CONTACTS.map(c => c.id === id ? { ...c, ...data } : c);
      return MOCK_CONTACTS.find(c => c.id === id)!;
    },
    delete: async (id: string): Promise<void> => {
      await delay(300);
      MOCK_CONTACTS = MOCK_CONTACTS.filter(c => c.id !== id);
    }
  },
  groups: {
    list: async (): Promise<Group[]> => {
      await delay(300);
      return [...MOCK_GROUPS];
    },
    get: async (id: string): Promise<Group | undefined> => {
      await delay(200);
      return MOCK_GROUPS.find(g => g.id === id);
    },
    create: async (data: Omit<Group, 'id'>): Promise<Group> => {
      await delay(300);
      const newGroup = { ...data, id: Math.random().toString(36).substr(2, 9) };
      MOCK_GROUPS.push(newGroup);
      return newGroup;
    },
    update: async (id: string, data: Partial<Group>): Promise<Group> => {
      await delay(300);
      MOCK_GROUPS = MOCK_GROUPS.map(g => g.id === id ? { ...g, ...data } : g);
      return MOCK_GROUPS.find(g => g.id === id)!;
    },
    delete: async (id: string): Promise<void> => {
      await delay(300);
      MOCK_GROUPS = MOCK_GROUPS.filter(g => g.id !== id);
    },
    updateSchedule: async (groupId: string, scheduleId: string, updates: Partial<import('./types').Schedule>): Promise<Group> => {
      await delay(300);
      MOCK_GROUPS = MOCK_GROUPS.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            schedules: g.schedules.map(s => s.id === scheduleId ? { ...s, ...updates } : s)
          };
        }
        return g;
      });
      return MOCK_GROUPS.find(g => g.id === groupId)!;
    },
    deleteSchedule: async (groupId: string, scheduleId: string): Promise<Group> => {
      await delay(300);
      MOCK_GROUPS = MOCK_GROUPS.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            schedules: g.schedules.filter(s => s.id !== scheduleId)
          };
        }
        return g;
      });
      return MOCK_GROUPS.find(g => g.id === groupId)!;
    },
    createSchedule: async (groupId: string, schedule: Omit<import('./types').Schedule, 'id'>): Promise<Group> => {
      await delay(300);
      MOCK_GROUPS = MOCK_GROUPS.map(g => {
        if (g.id === groupId) {
          const newSchedule = { ...schedule, id: Math.random().toString(36).substr(2, 9) };
          return {
            ...g,
            schedules: [...g.schedules, newSchedule]
          };
        }
        return g;
      });
      return MOCK_GROUPS.find(g => g.id === groupId)!;
    }
  },
  logs: {
    list: async (): Promise<MessageLog[]> => {
      await delay(300);
      return [...MOCK_LOGS].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  },
  ai: {
    generateMessage: async (groupId: string): Promise<string> => {
      await delay(1500); // Simulate AI processing
      const group = MOCK_GROUPS.find(g => g.id === groupId);
      if (!group) throw new Error('Group not found');
      
      const prompts = [
        `Hey everyone in ${group.name}, just checking in! ${group.backgroundInfo}`,
        `Update for ${group.name}: ${group.backgroundInfo}. Let me know if you have questions.`,
        `Greetings ${group.name} members! meaningful update based on: ${group.backgroundInfo}`,
      ];
      return prompts[Math.floor(Math.random() * prompts.length)];
    }
  },
  messaging: {
    send: async (groupId: string, content: string, channels: ('sms' | 'email')[]): Promise<void> => {
      await delay(1000); // Simulate sending
      const group = MOCK_GROUPS.find(g => g.id === groupId);
      if (group) {
        MOCK_LOGS.unshift({
          id: Math.random().toString(36).substr(2, 9),
          groupId: group.id,
          groupName: group.name,
          messageContent: content,
          recipients: group.contactIds.length,
          timestamp: new Date().toISOString(),
          status: 'sent'
        });
      }
    }
  }
};
