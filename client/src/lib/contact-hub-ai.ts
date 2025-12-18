import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import firebaseApp from './firebase';
import { metricsService } from './metrics';

// Fallback implementations for when Firebase Functions are not available
const fallbackMessageGeneration = (groupName: string, backgroundInfo: string): string => {
  const templates = [
    `Hello ${groupName} team! ${backgroundInfo} Let's connect soon.`,
    `Greetings to the ${groupName} group. ${backgroundInfo} Looking forward to our next interaction.`,
    `Hi everyone in ${groupName}! ${backgroundInfo} Please let me know if you need anything.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
};

const fallbackCategorization = (name: string) => ({
  categories: ['General'],
  tags: ['contact'],
  reasoning: 'AI service temporarily unavailable - using fallback categorization'
});

const fallbackCommunicationAnalysis = (name: string) => ({
  frequency: 'Regular',
  preferredMethod: 'Email',
  nextContactSuggestion: 'Within 2 weeks',
  insights: ['AI analysis temporarily unavailable']
});

const fallbackSchedulingSuggestion = (name: string) => ({
  recommendedTime: 'Next business day, 9 AM',
  reasoning: 'AI scheduling temporarily unavailable',
  alternatives: ['Tomorrow 2 PM', 'Friday 10 AM']
});

// Lazy initialization of Firebase Functions
let functionsInstance: any = null;
const getFunctionsInstance = () => {
  if (!functionsInstance) {
    try {
      functionsInstance = getFunctions(firebaseApp);
    } catch (error) {
      console.warn('Firebase Functions not available:', error);
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
    lastContactDate?: string
  ): Promise<string> {
    const startTime = Date.now();
    try {
      const functions = getFunctionsInstance();
      let usedAI = false;
      let message: string;

      if (functions) {
        const generateGroupMessageFn = httpsCallable<{ groupId: string }, { message: string; generatedAt: any }>(functions, 'generateGroupMessage');
        const result = await generateGroupMessageFn({ groupId: 'temp-group-id' });
        message = result.data.message;
        usedAI = true;
      } else {
        // Fallback when Firebase Functions not available
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
      console.error('AI Message Generation Error:', error);
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
    existingTags?: string[]
  ): Promise<{
    categories: string[];
    tags: string[];
    reasoning: string;
  }> {
    const startTime = Date.now();
    try {
      const functions = getFunctionsInstance();
      let result: { categories: string[]; tags: string[]; reasoning: string; };

      if (functions) {
        const categorizeContactFn = httpsCallable<{ contactId: string }, { categories: string[]; tags: string[]; reasoning: string; generatedAt: any }>(functions, 'categorizeContact');
        const response = await categorizeContactFn({ contactId: 'temp-contact-id' });
        result = response.data;
      } else {
        result = fallbackCategorization(name);
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
      console.error('AI Contact Categorization Error:', error);
      const result = fallbackCategorization(name);
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
      // TODO: Implement Firebase Function call
      return fallbackCommunicationAnalysis(name);
    } catch (error) {
      console.error('AI Communication Analysis Error:', error);
      return fallbackCommunicationAnalysis(name);
    }
  }

  // Smart scheduling recommendations
  static async suggestContactTime(
    name: string,
    timezone: string = 'UTC',
    preferredTimes?: string[],
    communicationStyle: string = 'professional',
    lastContact?: string,
    responsePatterns?: string[]
  ): Promise<{
    recommendedTime: string;
    reasoning: string;
    alternatives: string[];
  }> {
    try {
      // TODO: Implement Firebase Function call
      return fallbackSchedulingSuggestion(name);
    } catch (error) {
      console.error('AI Scheduling Error:', error);
      return fallbackSchedulingSuggestion(name);
    }
  }

  // Generate contact summaries and insights
  static async generateContactSummary(contact: any, interactions: any[]): Promise<string> {
    try {
      // TODO: Implement Firebase Function call for summary generation
      return `${contact.name} - Contact details available.`;
    } catch (error) {
      console.error('AI Summary Generation Error:', error);
      return `${contact.name} - Contact details available.`;
    }
  }
}

export default ContactHubAI;