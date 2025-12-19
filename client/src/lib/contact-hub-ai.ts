import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import firebaseApp from './firebase';
import { metricsService } from './metrics';

// Fallback implementations for when Firebase Functions are not available
const fallbackMessageGeneration = (groupName: string, backgroundInfo: string): string => {
  const templates = [
    `Hey there! It's been a while since we last caught up with ${groupName}. ${backgroundInfo} How have you been?`,
    `Hi! I've been thinking about our long conversations with ${groupName} and wanted to check in. ${backgroundInfo} What's new with you?`,
    `Hello! Remembering our shared experiences with ${groupName} and thought it was time for a proper catch-up. ${backgroundInfo} How's everything going?`,
    `Hey! It's been too long since our last chat with ${groupName}. ${backgroundInfo} I'd love to hear what you've been up to lately.`,
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
      return fallbackCommunicationAnalysis(name);
    }
  }

  // Smart scheduling recommendations
  static async suggestContactTime(
    contactId: string,
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
      const callable = httpsCallable(getFunctions(), 'suggestContactTime');
      const result = await callable({
        contactId,
        timezone,
        preferredTimes,
        communicationStyle,
        lastContact,
        responsePatterns
      });
      return result.data as any;
    } catch (error) {
      return fallbackSchedulingSuggestion(name);
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