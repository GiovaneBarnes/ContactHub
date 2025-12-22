import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import firebaseApp from './firebase';
import { metricsService } from './metrics';

// Professional fallback implementations for when Firebase Functions are not available
const fallbackMessageGeneration = (groupName: string, backgroundInfo: string): string => {
  // Generate contextual, complete messages based on background info
  const hasSpecificContext = backgroundInfo && backgroundInfo.length > 20 && 
                             !backgroundInfo.toLowerCase().includes('long-time') &&
                             !backgroundInfo.toLowerCase().includes('staying connected');
  
  const templates = hasSpecificContext ? [
    // Context-aware templates when we have specific background info
    `Hey! Hope you've been doing well. I've been reflecting on ${backgroundInfo.toLowerCase()} and wanted to reach out. It's been too long since we properly caught up. What have you been working on lately? Would love to hear what's new with you. Let me know if you're free for a call or coffee in the next couple weeks!`,
    `Hi! It's been a while and I wanted to check in. ${backgroundInfo} has been on my mind recently, and I'd value hearing your perspective. How have things been going for you? Are you available for a quick catch-up sometime soon?`,
    `Hello! Hope this finds you well. I was thinking about ${backgroundInfo.toLowerCase()} and realized we haven't connected in too long. I'd love to hear what you've been up to and share some updates on my end as well. Free for a call or coffee in the next week or two?`
  ] : [
    // General templates when context is minimal
    `Hey! How have you been? I realized it's been way too long since we properly caught up. What have you been working on lately? I'd love to hear what's new in your world. Let me know if you're free for coffee or a quick call in the next couple weeks!`,
    `Hi! Hope you've been doing well. It feels like forever since we last talked, and I wanted to reach out to see how things are going. Would you be open to catching up over coffee or a call sometime soon? I'd really love to reconnect.`,
    `Hello! It's been too long since our last conversation. I've been meaning to reach out and see how you're doing. Life has been busy but I'd really like to catch up properly. Are you available for a coffee or quick call in the next week or two?`,
    `Hey! Hope everything is going great with you. I was just thinking it's been a while since we connected, and I wanted to check in. What's new in your world? Let me know if you have time for a catch-up session soon!`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
};

const fallbackCategorization = (name: string, email?: string, phone?: string, notes?: string) => {
  const categories: string[] = [];
  const tags: string[] = [];
  const signals: string[] = [];
  
  // Intelligent categorization based on available data
  const notesLower = (notes || '').toLowerCase();
  const emailDomain = email?.split('@')[1]?.toLowerCase();
  
  // Email domain analysis
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com'];
  if (emailDomain) {
    if (personalDomains.includes(emailDomain)) {
      categories.push('Personal');
      signals.push('personal email domain');
    } else {
      categories.push('Professional');
      signals.push('business email domain');
    }
  }
  
  // Notes analysis
  if (notesLower.includes('work') || notesLower.includes('colleague') || notesLower.includes('client')) {
    if (!categories.includes('Professional')) categories.push('Professional');
    signals.push('work-related notes');
  }
  if (notesLower.includes('friend') || notesLower.includes('buddy')) {
    categories.push('Friend');
    signals.push('friendship indicators');
  }
  if (notesLower.includes('family') || notesLower.includes('relative')) {
    categories.push('Family');
    signals.push('family relationship');
  }
  
  // Default category if none detected
  if (categories.length === 0) {
    categories.push('General');
    signals.push('no specific categorization signals');
  }
  
  // Smart tagging
  tags.push('contact');
  if (email && !phone) tags.push('email-first');
  if (phone && !email) tags.push('phone-first');
  if (notesLower.includes('follow up') || notesLower.includes('follow-up')) tags.push('follow-up');
  
  return {
    categories: categories.slice(0, 3),
    tags: tags.slice(0, 5),
    reasoning: `Heuristic categorization based on: ${signals.join(', ')}. AI service temporarily unavailable - using pattern matching.`
  };
};

const fallbackCommunicationAnalysis = (name: string, messageLogs?: any[], lastContact?: string) => {
  // Analyze message logs if available
  let frequency = 'Regular';
  let preferredMethod = 'Email';
  const insights: string[] = [];
  
  if (messageLogs && messageLogs.length > 0) {
    // Analyze frequency
    if (messageLogs.length >= 10) {
      frequency = 'Frequent (10+ interactions)';
      insights.push('Strong communication history indicates engaged relationship');
    } else if (messageLogs.length >= 5) {
      frequency = 'Moderate (5-10 interactions)';
      insights.push('Growing relationship with consistent interaction pattern');
    } else {
      frequency = 'Occasional (1-5 interactions)';
      insights.push('Early-stage relationship - consider more frequent check-ins');
    }
    
    // Determine preferred method
    const methods = messageLogs.map(log => log.method || log.type).filter(Boolean);
    const methodCounts: Record<string, number> = {};
    methods.forEach(m => methodCounts[m] = (methodCounts[m] || 0) + 1);
    preferredMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Email';
    insights.push(`Primary communication via ${preferredMethod} based on ${messageLogs.length} interaction${messageLogs.length === 1 ? '' : 's'}`);
  } else {
    insights.push('No communication history yet - establishing baseline recommended');
    insights.push('Consider initial outreach to understand preferred communication style');
  }
  
  // Last contact analysis
  if (lastContact && lastContact !== 'Unknown') {
    try {
      const lastDate = new Date(lastContact);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 90) {
        insights.push(`Over ${Math.floor(daysSince / 30)} months since last contact - overdue for check-in`);
      }
    } catch (e) {
      // Invalid date, ignore
    }
  }
  
  return {
    frequency,
    preferredMethod,
    nextContactSuggestion: messageLogs && messageLogs.length > 5 ? 'Within 2-3 weeks to maintain rhythm' : 'Within 1 week to establish connection',
    insights: insights.slice(0, 3)
  };
};

const fallbackSchedulingSuggestion = (name: string, timezone: string = 'America/New_York', communicationStyle: string = 'professional', userTimezone?: string) => {
  const now = new Date();
  const isProfessional = communicationStyle.toLowerCase().includes('professional') || 
                        communicationStyle.toLowerCase().includes('business');
  
  // Get timezone abbreviation helper
  const getTimezoneAbbr = (tz: string) => {
    try {
      const date = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short'
      }).formatToParts(date);
      return parts.find(p => p.type === 'timeZoneName')?.value || tz;
    } catch {
      return tz.split('/').pop() || tz;
    }
  };
  
  const tzAbbr = getTimezoneAbbr(timezone);
  
  // Generate smart, realistic alternatives
  const generateScheduleOption = (daysFromNow: number, hour: number): string => {
    const targetDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    
    // Skip weekends for professional contacts
    if (isProfessional) {
      while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }
    
    const dayName = targetDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    
    return `${dayName}, ${displayHour}:00 ${period} ${tzAbbr}`;
  };
  
  // Professional: Weekday business hours (9 AM - 5 PM)
  // Personal: Flexible including weekends (10 AM - 8 PM)
  const scheduleOptions = isProfessional ? [
    generateScheduleOption(1, 10),  // Next business day, 10 AM
    generateScheduleOption(2, 14),  // +2 business days, 2 PM
    generateScheduleOption(3, 11),  // +3 business days, 11 AM
    generateScheduleOption(4, 15),  // +4 business days, 3 PM
  ] : [
    generateScheduleOption(1, 10),  // Tomorrow, 10 AM
    generateScheduleOption(1, 18),  // Tomorrow, 6 PM
    generateScheduleOption(2, 11),  // +2 days, 11 AM
    generateScheduleOption(3, 19),  // +3 days, 7 PM
  ];
  
  // Remove duplicates and take 4 unique options
  const uniqueOptions = Array.from(new Set(scheduleOptions)).slice(0, 4);
  
  return {
    recommendedTime: uniqueOptions[0],
    reasoning: isProfessional 
      ? `Mid-morning on the next business day in ${tzAbbr} timezone provides optimal professional outreach timing. This respects business hours and maximizes response likelihood.`
      : `Next-day morning in ${tzAbbr} timezone balances availability with timely outreach. This timing works well for personal communication.`,
    alternatives: uniqueOptions.slice(1, 4)
  };
};

// Lazy initialization of Firebase Functions
let functionsInstance: any = null;
const getFunctionsInstance = () => {
  if (!functionsInstance) {
    try {
      functionsInstance = getFunctions(firebaseApp);
    } catch (error) {
      // Firebase Functions not available
      return null;
    }
  }
  return functionsInstance;
};

export class ContactHubAI {
  // Generate personalized messages using Firebase Functions
  static async generatePersonalizedMessage(
    groupName: string,
    backgroundInfo: string,
    contactCount: number,
    lastContactDate?: string,
    groupId?: string
  ): Promise<string> {
    const startTime = Date.now();
    try {
      const functions = getFunctionsInstance();
      let usedAI = false;
      let message: string;

      if (functions && groupId) {
        const generateGroupMessageFn = httpsCallable<{ groupId: string }, { message: string; generatedAt: any }>(functions, 'generateGroupMessage');
        const result = await generateGroupMessageFn({ groupId });
        message = result.data.message;
        usedAI = true;
      } else {
        // Fallback when Firebase Functions not available or no groupId
        message = fallbackMessageGeneration(groupName, backgroundInfo);
      }

      const duration = Date.now() - startTime;
      await metricsService.trackAIAction('generate_message', {
        groupName,
        contactCount,
        usedAI,
        duration,
        messageLength: message.length,
        hasBackgroundInfo: !!backgroundInfo
      });

      return message;
    } catch (error) {
      // Fallback to template-based generation
      const message = fallbackMessageGeneration(groupName, backgroundInfo);
      const duration = Date.now() - startTime;

      await metricsService.trackAIAction('generate_message', {
        groupName,
        contactCount,
        usedAI: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUsed: true
      });

      return message;
    }
  }

  // Categorize contacts automatically
  static async categorizeContact(
    name: string,
    email?: string,
    phone?: string,
    notes?: string,
    existingTags?: string[],
    contactId?: string
  ): Promise<{
    categories: string[];
    tags: string[];
    reasoning: string;
  }> {
    const startTime = Date.now();
    try {
      const functions = getFunctionsInstance();
      let result: { categories: string[]; tags: string[]; reasoning: string; };

      if (functions && contactId) {
        // Get the current user's ID token
        const auth = getAuth(firebaseApp);
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }
        
        const idToken = await user.getIdToken();
        
        // Make direct HTTP request to the function
        const functionUrl = `https://us-central1-contacthub-29950.cloudfunctions.net/categorizeContactV2`;
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ contactId }),
        });
        
        
        const responseText = await response.text();
        
        if (!response.ok) {
          throw new Error(`Function call failed: ${response.status} ${responseText}`);
        }
        
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('Invalid JSON response from function');
        }
        
        // Check if the result has the expected structure
        if (!result || typeof result !== 'object' || !result.categories) {
          throw new Error('Invalid response from categorization function');
        }
      } else {
        result = fallbackCategorization(name, email, phone, notes);
      }

      const duration = Date.now() - startTime;
      await metricsService.trackAIAction('categorize_contact', {
        contactName: name,
        hasEmail: !!email,
        hasPhone: !!phone,
        hasNotes: !!notes,
        existingTagsCount: existingTags?.length || 0,
        categoriesGenerated: result.categories.length,
        tagsGenerated: result.tags.length,
        duration,
        usedAI: !!functions
      });

      return result;
    } catch (error) {
      const result = fallbackCategorization(name, email, phone, notes);
      const duration = Date.now() - startTime;

      await metricsService.trackAIAction('categorize_contact', {
        contactName: name,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUsed: true,
        duration
      });

      return result;
    }
  }

  // Analyze communication patterns
  static async analyzeCommunicationPatterns(
    contactId: string,
    name: string,
    messageLogs: any[],
    lastContact: string,
    relationship: string = 'professional'
  ): Promise<{
    frequency: string;
    preferredMethod: string;
    nextContactSuggestion: string;
    insights: string[];
  }> {
    try {
      const callable = httpsCallable(getFunctions(), 'analyzeCommunicationPatterns');
      const result = await callable({
        contactId,
        messageLogs,
        lastContact,
        relationship
      });
      return result.data as any;
    } catch (error) {
      return fallbackCommunicationAnalysis(name, messageLogs, lastContact);
    }
  }

  // Smart scheduling recommendations
  static async suggestContactTime(
    contactId: string,
    name: string,
    timezone: string = 'America/New_York',
    preferredTimes?: string[],
    communicationStyle: string = 'professional',
    lastContact?: string,
    responsePatterns?: string[],
    userTimezone?: string
  ): Promise<{
    recommendedTime: string;
    reasoning: string;
    alternatives: string[];
  }> {
    try {
      const callable = httpsCallable(getFunctions(), 'suggestContactTime');
      const result = await callable({
        contactId,
        timezone,
        preferredTimes,
        communicationStyle,
        lastContact,
        responsePatterns,
        userTimezone
      });
      return result.data as any;
    } catch (error) {
      return fallbackSchedulingSuggestion(name, timezone, communicationStyle, userTimezone);
    }
  }

  // Generate contact summaries and insights
  static async generateContactSummary(contact: any, interactions: any[]): Promise<string> {
    try {
      const callable = httpsCallable(getFunctions(), 'generateContactSummary');
      const result = await callable({
        contactId: contact.id,
        interactions
      });
      return (result.data as any).summary;
    } catch (error) {
      return `${contact.name} - Contact details available.`;
    }
  }
}

export default ContactHubAI;