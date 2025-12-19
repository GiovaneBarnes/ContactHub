import {setGlobalOptions} from "firebase-functions";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {params} from "firebase-functions";
import * as logger from "firebase-functions/logger";
import {VertexAI} from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import twilio from "twilio";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const firebaseConfig = (() => {
  try {
    return process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
  } catch (error) {
    // console.error('❌ Failed to parse FIREBASE_CONFIG env', error);
    return {};
  }
})();

const PROJECT_ID = process.env.GCLOUD_PROJECT
  || process.env.GCP_PROJECT
  || firebaseConfig.projectId
  || process.env.PROJECT_ID
  || '';

const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const ENV_MODEL_LIST = (process.env.VERTEX_MODEL || 'gemini-2.5-flash')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const BUILTIN_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-001',
];
const DEFAULT_VERTEX_MODEL_LIST = Array.from(new Set([...ENV_MODEL_LIST, ...BUILTIN_MODEL_FALLBACKS]));

let vertexAIClient: VertexAI | null = null;

try {
  if (PROJECT_ID) {
    vertexAIClient = new VertexAI({
      project: PROJECT_ID,
      location: VERTEX_LOCATION,
    });
    // Vertex AI client initialized successfully
  } else {
    // console.error('❌ Vertex AI initialization failed: missing project ID');
  }
} catch (error) {
  // console.error('❌ Failed to initialize Vertex AI client', error);
}

type VertexGenerationOptions = {
  model?: string | string[];
  temperature?: number;
  maxOutputTokens?: number;
  preview?: boolean;
};

async function generateWithVertexAI(prompt: string, options?: VertexGenerationOptions) {
  if (!vertexAIClient) {
    throw new Error('Vertex AI client not initialized');
  }

  const generationConfig = {
    temperature: options?.temperature ?? 0.35,
    maxOutputTokens: options?.maxOutputTokens ?? 1024,
  };

  const modelPreferences = Array.isArray(options?.model)
    ? options?.model
    : options?.model
      ? [options.model]
      : DEFAULT_VERTEX_MODEL_LIST;

  let lastError: any = null;

  for (const model of modelPreferences) {
    try {
      // Vertex AI request
      const usePreview = options?.preview || model.includes('preview');
      const client = usePreview
        ? vertexAIClient.preview
        : vertexAIClient;

      const generativeModel = client.getGenerativeModel({
        model,
        generationConfig,
      });

      const vertexResult = await generativeModel.generateContent(prompt);
      const text = extractTextFromVertexResult(vertexResult);

      if (!text) {
        throw new Error(`Vertex AI returned an empty response for model ${model}`);
      }

      return {
        text,
        raw: vertexResult.response,
        model,
      };
    } catch (error) {
      lastError = error;
      // console.error('⚠️ Vertex AI model failed, trying next candidate', {
      //   model,
      //   errorMessage: (error as Error)?.message,
      // });
      continue;
    }
  }

  throw lastError || new Error('Vertex AI generation failed for all models');
}

function extractTextFromVertexResult(vertexResult: any): string {
  const candidates = vertexResult?.response?.candidates;
  if (!candidates?.length) {
    return '';
  }

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    const candidateText = parts
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (candidateText) {
      return candidateText;
    }
  }

  return '';
}

// Helper function to interpolate variables into template
function interpolateTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

// AI Prompts for ContactHub
const messageGenerationTemplate = `You are an expert communication coach crafting authentic, personalized messages that strengthen relationships.

CONTEXT:
Group Purpose: {{backgroundInfo}}
Recipients: {{contactCount}} people
Last Communication: {{lastContactDate}}

YOUR TASK: Write ONE complete message (80-150 words) that will be sent to everyone in the group. It should feel personal but appropriate for multiple recipients.

CRITICAL FORMATTING RULES:
1. Write ONLY the message text - no titles, no headers, no "Message 1:", no markdown formatting
2. Start immediately with the message content (e.g., "Hey!" or "How's it going?")
3. End with a complete sentence - no trailing dots or unfinished thoughts
4. The output should be ready to copy-paste and send as-is

CONTENT RULES:
1. NO placeholders like [Friend's Name] or [specific memory] - write actual, specific content
2. NO fabricated specific scenarios or memories (e.g., "Remember that soufflé?") - keep it general and authentic
3. NO mention of "group", "everyone", or "all of you" - write as if to one person
4. NO incomplete sentences - every thought must be finished
5. Must feel natural and conversational, not formal or stiff
6. ONLY use specific references if the "Group Purpose" explicitly mentions them - otherwise keep it general

TONE GUIDELINES:
• If Group Purpose is general/vague: Write a casual, friendly check-in message
• If Group Purpose mentions specific shared interests: Reference those interests naturally
• If Group Purpose mentions specific events/plans: Reference those appropriately
• Default to simple, genuine connection over forced creativity

STRUCTURE:
• Opening: Friendly greeting or simple question
• Middle: Brief context or thought (based ONLY on Group Purpose if specific, otherwise general)
• Closing: Clear invitation to respond or meet up

GOOD EXAMPLES (match this style):

Example 1 (Generic friends - like your prompt):
"Hey! How have you been? It's been a while since we caught up. What have you been up to lately? Would love to hear what's new with you. Let me know if you're free for coffee or a call soon!"

Example 2 (Specific shared interest):
"Hey! I just tried that new coffee shop downtown and the vibes reminded me of our college hangout spot. They've got this insane cold brew that I think you'd love. Planning to go back this weekend - want to join? We could finally catch up properly since it's been way too long."

Example 3 (Professional context):
"Hi! Hope you've been well. I've been thinking about some of the industry trends we discussed last time and would love to get your perspective. Are you free for coffee or a quick call next week? Would be great to catch up."

Now write ONE complete message in this exact style (no headers, no formatting, just the message):`;

const contactCategorizationTemplate = `You are an AI assistant that categorizes contacts based on their information and communication patterns.

Contact Details:
Name: {{name}}
Email: {{email}}
Phone: {{phone}}
Notes: {{notes}}
Tags: {{tags}}

Categorization rules:
- Choose 1-3 categories using ONLY this controlled vocabulary: Family, Friend, Personal, Professional, Colleague, Client, Prospect, Lead, Vendor, Service Provider, Partner, Investor, Mentor, Community, Organization, VIP, General.
- Never leave the categories array empty. If information is thin, select the closest fit (General is an acceptable fallback).
- Provide 3-5 concise descriptive tags (single words or kebab-case). Focus on relationship context, urgency, and follow-up signals. Examples: family, vip, warm-lead, partner, follow-up, community-leader, beta-tester, vendor, mentor.
- Tags must stay short (<= 2 words) and avoid duplicates. Prefer lowercase.
- If details conflict, choose the safest category/tag rather than returning empty arrays.

Respond ONLY with valid JSON using this shape:
{
  "categories": ["Category 1", "Category 2"],
  "tags": ["tag1", "tag2", "tag3"],
  "reasoning": "Short explanation of why these categories/tags were chosen."
}

Do not include markdown, backticks, extra commentary, timestamps, or any keys beyond the three listed above. Returning empty arrays or additional keys will result in the response being rejected.`;

const CATEGORIZATION_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'];
const MAX_CATEGORY_COUNT = 3;
const MAX_TAG_COUNT = 5;
const CATEGORY_TAXONOMY = [
  'Family',
  'Friend',
  'Personal',
  'Professional',
  'Colleague',
  'Client',
  'Prospect',
  'Lead',
  'Vendor',
  'Service Provider',
  'Partner',
  'Investor',
  'Mentor',
  'Community',
  'Organization',
  'VIP',
  'General',
];
const CATEGORY_ALIAS_MAP: Record<string, string> = {
  family: 'Family',
  families: 'Family',
  friend: 'Friend',
  friends: 'Friend',
  personal: 'Personal',
  professional: 'Professional',
  colleague: 'Colleague',
  colleagues: 'Colleague',
  coworker: 'Colleague',
  coworkers: 'Colleague',
  client: 'Client',
  clients: 'Client',
  customer: 'Client',
  customers: 'Client',
  account: 'Client',
  accounts: 'Client',
  prospect: 'Prospect',
  prospects: 'Prospect',
  lead: 'Lead',
  leads: 'Lead',
  vendor: 'Vendor',
  vendors: 'Vendor',
  supplier: 'Vendor',
  suppliers: 'Vendor',
  contractor: 'Service Provider',
  contractors: 'Service Provider',
  consultant: 'Service Provider',
  consultants: 'Service Provider',
  provider: 'Service Provider',
  providers: 'Service Provider',
  service: 'Service Provider',
  'service provider': 'Service Provider',
  partner: 'Partner',
  partners: 'Partner',
  partnership: 'Partner',
  investor: 'Investor',
  investors: 'Investor',
  mentor: 'Mentor',
  mentors: 'Mentor',
  advisor: 'Mentor',
  advisors: 'Mentor',
  adviser: 'Mentor',
  advisers: 'Mentor',
  community: 'Community',
  organization: 'Organization',
  organisations: 'Organization',
  org: 'Organization',
  committee: 'Organization',
  vip: 'VIP',
  general: 'General',
};
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Family: ['family', 'parent', 'mom', 'dad', 'sister', 'brother', 'cousin', 'aunt', 'uncle', 'relative'],
  Friend: ['friend', 'buddy', 'pal', 'roommate', 'classmate', 'college', 'school'],
  Personal: ['neighbor', 'neighbour', 'personal'],
  Professional: ['work', 'coworker', 'colleague', 'manager', 'boss', 'teammate'],
  Colleague: ['coworker', 'teammate', 'colleague'],
  Client: ['client', 'customer', 'account', 'project', 'invoice', 'contract', 'retainer'],
  Prospect: ['prospect', 'pipeline', 'pitch', 'opportunity'],
  Lead: ['lead', 'follow up', 'follow-up'],
  Vendor: ['vendor', 'supplier', 'manufacturer'],
  'Service Provider': ['service provider', 'contractor', 'consultant', 'agency', 'doctor', 'dentist', 'lawyer', 'attorney', 'therapist', 'accountant'],
  Partner: ['partner', 'partnership', 'collaboration', 'affiliate'],
  Investor: ['investor', 'vc', 'venture', 'angel', 'seed', 'fund'],
  Mentor: ['mentor', 'coach', 'advisor', 'adviser'],
  Community: ['community', 'group', 'club', 'chapter', 'board'],
  Organization: ['organization', 'organisation', 'company', 'startup', 'nonprofit'],
  VIP: ['vip', 'important', 'priority'],
};
const TAG_ALIAS_MAP: Record<string, string> = {
  'hot lead': 'hot-lead',
  'warm lead': 'warm-lead',
  'cold lead': 'cold-lead',
  followup: 'follow-up',
  'follow up': 'follow-up',
  'customer success': 'customer-success',
  newsletter: 'newsletter',
  beta: 'beta',
  'beta tester': 'beta',
};
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'pm.me',
  'live.com',
  'msn.com',
]);

type ContactRecord = admin.firestore.DocumentData & {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
  timezone?: string;
  preferredContactTimes?: string[];
};

type CategorizationPayload = {
  categories: string[];
  tags: string[];
  reasoning: string;
  usedFallback: boolean;
  signals: string[];
  model?: string;
};

type CategorizationComputation = CategorizationPayload & {
  prompt: string;
  rawResponse: string;
};

// AI prompt for communication pattern analysis
const communicationAnalysisTemplate = `You are an AI communication analyst helping understand contact relationship patterns.

Contact: {{name}}
Relationship Type: {{relationship}}
Last Contact: {{lastContact}}
Message History: {{messageLogs}}

Analyze the communication patterns and provide insights:

1. **Frequency Analysis**: Based on the message history, determine the typical communication frequency (daily, weekly, monthly, quarterly, etc.)

2. **Preferred Method**: Analyze which communication method is most used (SMS, email, calls, etc.)

3. **Next Contact Suggestion**: When would be the optimal time to reach out next based on patterns?

4. **Key Insights**: Provide 2-3 specific insights about this relationship based on the communication history.

Format your response as:
Frequency: [frequency pattern]
Preferred Method: [most used method]
Next Contact Suggestion: [optimal timing]
Insights: [insight 1, insight 2, insight 3]`;

// AI prompt for smart contact time suggestions
const contactTimeSuggestionTemplate = `You are an AI scheduling assistant helping optimize contact timing for better relationship management.

Contact: {{name}}
Timezone: {{timezone}}
Preferred Times: {{preferredTimes}}
Communication Style: {{communicationStyle}}
Last Contact: {{lastContact}}
Response Patterns: {{responsePatterns}}

Based on this information, suggest the optimal time to contact this person:

1. **Recommended Time**: Suggest a specific time/day that would be most effective
2. **Reasoning**: Explain why this time is optimal based on timezone, preferences, and patterns
3. **Alternative Times**: Provide 2-3 backup time suggestions

Consider:
- Timezone differences
- Business hours vs personal time
- Response patterns and availability
- Communication style preferences
- Cultural norms for the contact's likely location

Format your response as:
Recommended Time: [specific time and day]
Reasoning: [detailed explanation]
Alternatives: [time 1, time 2, time 3]`;

// AI prompt for smart group creation
const smartGroupCreationTemplate = `You are an AI relationship strategist helping organize contacts into meaningful groups for better relationship management.

Contact Analysis:
{{contactData}}

Your task is to analyze these contacts and suggest optimal group structures. Consider:

1. **Relationship Types**: Group contacts with similar relationship contexts (family, friends, colleagues, clients, etc.)
2. **Communication Patterns**: Consider how often you communicate and preferred methods
3. **Shared Interests**: Look for common themes in notes, tags, or categories
4. **Life Contexts**: Work, personal, community, professional networks
5. **Geographic/Regional**: If location data suggests regional groupings
6. **Communication Frequency**: High-touch vs low-touch relationships

Provide 3-5 suggested groups with:
- Group name (concise, descriptive)
- Group purpose (1-2 sentences explaining the group's focus)
- Contact assignments (list contact names that should be in this group)
- Rationale (why this grouping makes sense)

Format your response as JSON:
{
  "suggestedGroups": [
    {
      "name": "Group Name",
      "purpose": "Group purpose description",
      "contacts": ["Contact Name 1", "Contact Name 2"],
      "rationale": "Why this grouping is optimal"
    }
  ],
  "insights": "Overall insights about the contact network structure"
}

Ensure groups are mutually exclusive where possible, and cover all contacts provided.`;

// AI prompt for contact summary generation
const contactSummaryTemplate = `You are an AI relationship analyst creating comprehensive contact summaries.

Contact Information:
Name: {{name}}
Email: {{email}}
Phone: {{phone}}
Notes: {{notes}}
Tags: {{tags}}
Categories: {{categories}}

Interaction History:
{{interactions}}

Create a concise but comprehensive summary (150-300 words) that includes:

1. **Relationship Overview**: What type of relationship this is and how long you've known them
2. **Communication Patterns**: How often you communicate and preferred methods
3. **Key Topics**: Main subjects discussed or areas of shared interest
4. **Relationship Status**: Current state of the relationship and any notable patterns
5. **Action Items**: Any follow-up actions or reminders based on the interaction history

Make it personal and actionable, focusing on maintaining and strengthening the relationship.

Summary:`;

// Set global options for all functions
setGlobalOptions({maxInstances: 10});

// Cloud Functions
export const generateGroupMessage = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
    // enforceAppCheck: true, // Temporarily disabled for debugging
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {groupId} = request.data;
    if (!groupId) {
      throw new HttpsError("invalid-argument", "Group ID is required");
    }

    try {
      const userId = request.auth.uid;

      // Get group data from Firestore
      const groupQuery = await admin.firestore()
        .collection("groups")
        .where("userId", "==", userId)
        .get();

      const groupDoc = groupQuery.docs.find((doc) => doc.id === groupId);

      if (!groupDoc) {
        throw new HttpsError("not-found", "Group not found");
      }

      const group = groupDoc.data();

      // Get contact count
      const contactCount = group.contactIds?.length || 0;

      // Get last contact date from message logs
      const lastLogQuery = await admin.firestore()
        .collection("messageLogs")
        .where("userId", "==", userId)
        .where("groupId", "==", groupId)
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

      const lastContactDate = lastLogQuery.docs[0]?.data().timestamp.toDate().toISOString() || "Never contacted";

      // Generate AI message
      const prompt = interpolateTemplate(messageGenerationTemplate, {
        backgroundInfo: group.backgroundInfo || "Long-time friends who value staying connected",
        contactCount: contactCount.toString(),
        lastContactDate,
      });
      const result = await generateWithVertexAI(prompt, {
        model: ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'],
        temperature: 0.7, // Higher for more creative, varied messages
        maxOutputTokens: 1024, // Increased to ensure complete messages
      });

      // Post-process to clean up any formatting artifacts
      let cleanedMessage = result.text.trim();
      
      // Remove common headers/prefixes
      cleanedMessage = cleanedMessage.replace(/^(Message \d+:|Message:|Here (is|are) .*?messages?:|Here's .*?message:|\*\*Message \d+:\*\*)/gi, '').trim();
      
      // Remove markdown formatting
      cleanedMessage = cleanedMessage.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
      cleanedMessage = cleanedMessage.replace(/\*(.*?)\*/g, '$1'); // Italic
      cleanedMessage = cleanedMessage.replace(/^[•\-\*]\s+/gm, ''); // Bullet points
      
      // Remove trailing ellipsis
      cleanedMessage = cleanedMessage.replace(/\.{3,}$/g, '.');
      
      // Check if message ends mid-sentence (no punctuation)
      if (!/[.!?]$/.test(cleanedMessage)) {
        logger.warn(`Generated message appears incomplete: "${cleanedMessage.slice(-50)}"`);
        // Try to add proper ending punctuation if it seems like a statement
        if (cleanedMessage.length > 0) {
          cleanedMessage += '.';
        }
      }

      logger.info(`Generated AI message for group ${groupId} by user ${userId}`);

      return {
        message: cleanedMessage,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      logger.error("Error generating group message:", error);
      throw new HttpsError("internal", "Failed to generate message");
    }
  }
);

export const categorizeContact = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
    // enforceAppCheck: true, // Temporarily disabled for debugging
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {contactId} = request.data;
    if (!contactId) {
      throw new HttpsError("invalid-argument", "Contact ID is required");
    }

    try {
      const userId = request.auth.uid;
      logger.info(`Starting categorization for user ${userId}, contact ${contactId}`);

      // Get contact data
      const contactDoc = await admin.firestore()
        .doc(`contacts/${contactId}`)
        .get();

      if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
        logger.warn(`Contact not found or access denied: ${contactId} for user ${userId}`);
        throw new HttpsError("not-found", "Contact not found");
      }

      const contact = contactDoc.data() as ContactRecord;
      logger.info(`Contact data retrieved: ${contact.name}`);

      let categorization: CategorizationPayload;
      try {
        categorization = await generateCategorizationWithGuardrails(contact);
      } catch (aiError) {
        logger.error(`AI generation failed for ${contact.name}`, aiError);
        const error = aiError as any;
        categorization = buildHeuristicCategorization(
          contact,
          `AI service temporarily unavailable - using heuristic categorization. Error: ${error?.message || 'Unknown error'}`
        );
      }
      logger.info(`Categorization completed for ${contact.name}`, {
        categories: categorization.categories,
        tags: categorization.tags,
        usedFallback: categorization.usedFallback,
        model: categorization.model,
      });

      await contactDoc.ref.update({
        aiCategories: categorization.categories,
        aiTags: categorization.tags,
        aiReasoning: categorization.reasoning,
        aiCategorizedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        categories: categorization.categories,
        tags: categorization.tags,
        reasoning: categorization.reasoning,
        usedFallback: categorization.usedFallback,
        model: categorization.model,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error categorizing contact:", error);
      throw new HttpsError("internal", "Failed to categorize contact");
    }
  }
);

// Analyze communication patterns
export const analyzeCommunicationPatterns = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {contactId, messageLogs, lastContact, relationship} = request.data;
    if (!contactId) {
      throw new HttpsError("invalid-argument", "Contact ID is required");
    }

    try {
      const userId = request.auth.uid;

      // Get contact data for context
      const contactDoc = await admin.firestore()
        .doc(`contacts/${contactId}`)
        .get();

      if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Contact not found");
      }

      const contact = contactDoc.data()!;

      // Format message logs for AI analysis
      const formattedLogs = messageLogs?.map((log: any) => 
        `${log.timestamp?.toDate?.()?.toISOString() || log.timestamp}: ${log.method} - ${log.status}`
      ).join('\n') || 'No message history available';

      // Generate AI analysis
      const prompt = interpolateTemplate(communicationAnalysisTemplate, {
        name: contact.name,
        relationship: relationship || 'professional',
        lastContact: lastContact || 'Unknown',
        messageLogs: formattedLogs,
      });
      const result = await generateWithVertexAI(prompt, {
        model: ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'],
        temperature: 0.3,
        maxOutputTokens: 768,
      });

      const response = result.text;

      // Parse the structured response
      const frequency = extractValueFromResponse(response, "Frequency:");
      const preferredMethod = extractValueFromResponse(response, "Preferred Method:");
      const nextContactSuggestion = extractValueFromResponse(response, "Next Contact Suggestion:");
      const insightsText = extractValueFromResponse(response, "Insights:");
      const insights = insightsText ? insightsText.split(',').map((s: string) => s.trim()) : [];

      logger.info(`Analyzed communication patterns for contact ${contactId} by user ${userId}`);

      return {
        frequency,
        preferredMethod,
        nextContactSuggestion,
        insights,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      logger.error("Error analyzing communication patterns:", error);
      throw new HttpsError("internal", "Failed to analyze communication patterns");
    }
  }
);

// Suggest optimal contact times
export const suggestContactTime = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {contactId, timezone, preferredTimes, communicationStyle, lastContact, responsePatterns} = request.data;
    if (!contactId) {
      throw new HttpsError("invalid-argument", "Contact ID is required");
    }

    try {
      const userId = request.auth.uid;

      // Get contact data for context
      const contactDoc = await admin.firestore()
        .doc(`contacts/${contactId}`)
        .get();

      if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Contact not found");
      }

      const contact = contactDoc.data()!;

      // Generate AI time suggestion
      const prompt = interpolateTemplate(contactTimeSuggestionTemplate, {
        name: contact.name,
        timezone: timezone || 'UTC',
        preferredTimes: preferredTimes?.join(', ') || 'Not specified',
        communicationStyle: communicationStyle || 'professional',
        lastContact: lastContact || 'Unknown',
        responsePatterns: responsePatterns?.join(', ') || 'Not available',
      });
      const result = await generateWithVertexAI(prompt, {
        model: ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'],
        temperature: 0.25,
        maxOutputTokens: 512,
      });

      const response = result.text;

      // Parse the structured response
      const recommendedTime = extractValueFromResponse(response, "Recommended Time:");
      const reasoning = extractValueFromResponse(response, "Reasoning:");
      const alternativesText = extractValueFromResponse(response, "Alternatives:");
      const alternatives = alternativesText ? alternativesText.split(',').map((s: string) => s.trim()) : [];

      logger.info(`Suggested contact time for contact ${contactId} by user ${userId}`);

      return {
        recommendedTime,
        reasoning,
        alternatives,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      logger.error("Error suggesting contact time:", error);
      throw new HttpsError("internal", "Failed to suggest contact time");
    }
  }
);

// Generate contact summaries
export const generateContactSummary = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {contactId, interactions} = request.data;
    if (!contactId) {
      throw new HttpsError("invalid-argument", "Contact ID is required");
    }

    try {
      const userId = request.auth.uid;

      // Get contact data
      const contactDoc = await admin.firestore()
        .doc(`contacts/${contactId}`)
        .get();

      if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Contact not found");
      }

      const contact = contactDoc.data()!;

      // Format interactions for AI analysis
      const formattedInteractions = interactions?.map((interaction: any) => 
        `${interaction.date || interaction.timestamp}: ${interaction.type} - ${interaction.notes || interaction.content || 'No details'}`
      ).join('\n') || 'No interaction history available';

      // Generate AI summary
      const prompt = interpolateTemplate(contactSummaryTemplate, {
        name: contact.name,
        email: contact.email || 'Not provided',
        phone: contact.phone || 'Not provided',
        notes: contact.notes || 'No notes available',
        tags: contact.tags?.join(', ') || 'None',
        categories: contact.categories?.join(', ') || 'Uncategorized',
        interactions: formattedInteractions,
      });
      const result = await generateWithVertexAI(prompt, {
        model: ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'],
        temperature: 0.3,
        maxOutputTokens: 1536, // Increased from 896 to allow for complete 300-word summaries
      });

      logger.info(`Generated contact summary for contact ${contactId} by user ${userId}`);

      return {
        summary: result.text,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      logger.error("Error generating contact summary:", error);
      throw new HttpsError("internal", "Failed to generate contact summary");
    }
  }
);

// Smart group creation suggestions
export const suggestSmartGroups = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const userId = request.auth.uid;

      // Get all user's contacts with AI categorization data
      const contactsSnapshot = await admin.firestore()
        .collection("contacts")
        .where("userId", "==", userId)
        .get();

      if (contactsSnapshot.empty) {
        return {
          suggestedGroups: [],
          insights: "No contacts found to analyze for group suggestions.",
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
      }

      const contacts: ContactRecord[] = contactsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ContactRecord[];

      // Format contact data for AI analysis
      const contactData = contacts.map(contact => 
        `Name: ${contact.name || 'Unknown'}
Email: ${contact.email || 'Not provided'}
Phone: ${contact.phone || 'Not provided'}
Notes: ${contact.notes || 'No notes'}
AI Categories: ${(contact.aiCategories || contact.categories || []).join(', ') || 'Uncategorized'}
AI Tags: ${(contact.aiTags || contact.tags || []).join(', ') || 'No tags'}
Last Contact: ${contact.lastContactedAt?.toDate?.()?.toISOString() || 'Never contacted'}`
      ).join('\n\n---\n\n');

      // Generate AI group suggestions
      const prompt = interpolateTemplate(smartGroupCreationTemplate, {
        contactData,
      });
      const result = await generateWithVertexAI(prompt, {
        model: ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'],
        temperature: 0.4, // Slightly higher creativity for group suggestions
        maxOutputTokens: 2048, // Allow for detailed group suggestions
      });

      let suggestions;
      try {
        suggestions = JSON.parse(result.text);
      } catch (parseError) {
        logger.warn(`Failed to parse AI group suggestions, using fallback: ${parseError}`);
        // Fallback to basic grouping by AI categories
        suggestions = generateFallbackGroupSuggestions(contacts);
      }

      // Validate and enhance suggestions
      const validatedSuggestions = validateAndEnhanceGroupSuggestions(suggestions, contacts);

      logger.info(`Generated smart group suggestions for user ${userId}: ${validatedSuggestions.suggestedGroups.length} groups`);

      return {
        ...validatedSuggestions,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      logger.error("Error generating smart group suggestions:", error);
      throw new HttpsError("internal", "Failed to generate smart group suggestions");
    }
  }
);

// Firestore trigger for automatic contact categorization on creation
export const onContactCreated = onDocumentCreated(
  {
    document: "contacts/{contactId}",
    region: "us-central1",
  },
  async (event) => {
    const contactId = event.params.contactId;
    const contactData = event.data?.data();

    if (!contactData) return;

    try {
      // Auto-categorize new contacts
      let categorization: CategorizationPayload;
      try {
        categorization = await generateCategorizationWithGuardrails(contactData as ContactRecord);
      } catch (aiError) {
        logger.error(`AI auto-categorization failed for ${contactId}`, aiError);
        categorization = buildHeuristicCategorization(contactData as ContactRecord, 'AI unavailable during auto-categorization');
      }

      // Update contact with AI-generated categories and tags
      await admin.firestore()
        .doc(`contacts/${contactId}`)
        .update({
          aiCategories: categorization.categories,
          aiTags: categorization.tags,
          aiReasoning: categorization.reasoning,
          aiCategorizedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      logger.info(`Auto-categorized new contact ${contactId}`);
    } catch (error) {
      logger.error("Error auto-categorizing contact:", error);
    }
  }
);

// Helper functions
function extractListFromResponse(response: string, prefix: string): string[] {
  const start = response.indexOf(prefix);
  if (start === -1) return [];

  const listStart = response.indexOf("[", start);
  const listEnd = response.indexOf("]", listStart);
  if (listStart === -1 || listEnd === -1) return [];

  const listContent = response.substring(listStart + 1, listEnd);
  return listContent.split(",").map((item) => item.trim().replace(/['"]/g, ""));
}

function extractReasoningFromResponse(response: string): string {
  const start = response.indexOf("Reasoning:");
  if (start === -1) return "AI-generated categorization";

  return response.substring(start + 11).trim();
}

function extractValueFromResponse(response: string, prefix: string): string {
  const start = response.indexOf(prefix);
  if (start === -1) return "";

  const end = response.indexOf("\n", start + prefix.length);
  if (end === -1) return response.substring(start + prefix.length).trim();

  return response.substring(start + prefix.length, end).trim();
}

function sanitizeStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item === null || item === undefined) return '';
      return String(item).trim();
    })
    .filter((entry) => !!entry);
}

function parseCategorizationResponse(text: string) {
  const safeText = text || '';

  const fallback = {
    categories: extractListFromResponse(safeText, "Categories:"),
    tags: extractListFromResponse(safeText, "Tags:"),
    reasoning: extractReasoningFromResponse(safeText) || 'AI-generated categorization',
  };

  if (!safeText.trim()) {
    return fallback;
  }

  const jsonStart = safeText.indexOf('{');
  const jsonEnd = safeText.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const possibleJson = safeText.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(possibleJson);
      const categories = sanitizeStringArray(parsed?.categories);
      const tags = sanitizeStringArray(parsed?.tags);
      const reasoning = typeof parsed?.reasoning === 'string'
        ? parsed.reasoning.trim() || fallback.reasoning
        : fallback.reasoning;

      if (categories.length || tags.length) {
        return {
          categories: categories.length ? categories : fallback.categories,
          tags: tags.length ? tags : fallback.tags,
          reasoning,
        };
      }
    } catch (error) {
      // console.warn('⚠️ Failed to parse AI JSON response, falling back to regex parsing', error);
    }
  }

  if (!fallback.categories.length && !fallback.tags.length) {
    return {
      categories: [],
      tags: [],
      reasoning: fallback.reasoning,
    };
  }

  return fallback;
}

function buildCategorizationPrompt(contact: ContactRecord): string {
  const cleanTags = sanitizeStringArray(contact.tags);
  return interpolateTemplate(contactCategorizationTemplate, {
    name: contact.name || 'Unknown contact',
    email: contact.email || 'Not provided',
    phone: contact.phone || 'Not provided',
    notes: contact.notes || 'No notes available',
    tags: cleanTags.length ? cleanTags.join(', ') : 'None',
  });
}

async function generateCategorizationWithGuardrails(contact: ContactRecord, prompt?: string): Promise<CategorizationComputation> {
  const resolvedPrompt = prompt ?? buildCategorizationPrompt(contact);
  const result = await generateWithVertexAI(resolvedPrompt, {
    model: CATEGORIZATION_MODEL_CANDIDATES,
    temperature: 0.25,
    maxOutputTokens: 640,
  });

  const parsed = parseCategorizationResponse(result.text);
  const enriched = applyCategorizationGuardrails(contact, parsed);

  return {
    ...enriched,
    prompt: resolvedPrompt,
    rawResponse: result.text,
    model: result.model,
  };
}

function buildHeuristicCategorization(contact: ContactRecord, reason?: string): CategorizationPayload {
  const heuristics = deriveHeuristicSignals(contact);
  const heuristicReason = reason
    ? `${reason} ${heuristics.reasoning.length ? `Signals: ${heuristics.reasoning.join(', ')}` : ''}`.trim()
    : heuristics.reasoning.length
      ? `Signals: ${heuristics.reasoning.join(', ')}`
      : 'Heuristic categorization';

  return {
    categories: heuristics.categories.length ? heuristics.categories : ['General'],
    tags: heuristics.tags.length ? heuristics.tags : ['contact'],
    reasoning: heuristicReason,
    usedFallback: true,
    signals: heuristics.reasoning,
  };
}

function applyCategorizationGuardrails(contact: ContactRecord, parsed: {categories: string[]; tags: string[]; reasoning: string;}): CategorizationPayload {
  const normalizedCategories = limitArrayUnique(
    (parsed.categories || [])
      .map((category) => normalizeCategoryLabel(category))
      .filter((category): category is string => Boolean(category)),
    MAX_CATEGORY_COUNT,
  );

  const normalizedTags = limitArrayUnique(
    (parsed.tags || [])
      .map((tag) => normalizeTagLabel(tag))
      .filter((tag): tag is string => Boolean(tag)),
    MAX_TAG_COUNT,
  );

  const heuristics = deriveHeuristicSignals(contact);
  const categories = normalizedCategories.length ? normalizedCategories : heuristics.categories;
  const tags = normalizedTags.length ? normalizedTags : heuristics.tags;
  const usedFallback = !normalizedCategories.length || !normalizedTags.length;

  const reasoningParts = [parsed.reasoning?.trim() || 'AI-generated categorization'];
  if (usedFallback && heuristics.reasoning.length) {
    reasoningParts.push(`Signals: ${heuristics.reasoning.join(', ')}`);
  }

  return {
    categories: categories.length ? categories : ['General'],
    tags: tags.length ? tags : ['contact'],
    reasoning: reasoningParts.join(' ').trim(),
    usedFallback,
    signals: heuristics.reasoning,
  };
}

function deriveHeuristicSignals(contact: ContactRecord) {
  const categories: string[] = [];
  const tags: string[] = [];
  const reasons: string[] = [];

  const notes = (contact.notes || '').toLowerCase();
  const existingTags = sanitizeStringArray(contact.tags);

  const addCategory = (category: string, reason: string) => {
    if (!CATEGORY_TAXONOMY.includes(category)) return;
    if (categories.includes(category)) return;
    categories.push(category);
    reasons.push(reason);
  };

  const addTag = (tag: string, reason?: string) => {
    const normalized = normalizeTagLabel(tag);
    if (!normalized) return;
    if (tags.includes(normalized)) return;
    tags.push(normalized);
    if (reason) {
      reasons.push(reason);
    }
  };

  existingTags.forEach((tag) => {
    addTag(tag);
    const aliasCategory = CATEGORY_ALIAS_MAP[tag.toLowerCase()];
    if (aliasCategory) {
      addCategory(aliasCategory, `existing tag "${tag}"`);
    }
  });

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    const match = findKeywordMatch(notes, keywords);
    if (match) {
      addCategory(category, `notes mention "${match}"`);
    }
  });

  const emailDomain = contact.email?.split('@')[1]?.toLowerCase();
  if (emailDomain) {
    if (FREE_EMAIL_DOMAINS.has(emailDomain)) {
      addCategory('Personal', `personal email domain ${emailDomain}`);
    } else {
      addCategory('Professional', `business domain ${emailDomain}`);
    }
  }

  if (!contact.email && contact.phone) {
    addTag('phone-first', 'phone number present without email');
  }

  if (contact.email && !contact.phone) {
    addTag('email-first', 'email present without phone');
  }

  if (notes.includes('follow up') || notes.includes('follow-up')) {
    addTag('follow-up', 'notes request a follow-up');
  }

  if (notes.includes('birthday') || notes.includes('anniversary')) {
    addTag('milestone', 'notes mention a milestone');
  }

  if (notes.includes('event') || notes.includes('conference') || notes.includes('meetup')) {
    addCategory('Community', 'notes mention an event or community');
    addTag('event', 'notes mention an event');
  }

  if (contact.preferredContactTimes?.length) {
    addTag('scheduled-check-ins', 'preferred contact schedule recorded');
  }

  if (!categories.length) {
    addCategory('General', 'no strong categorization signals');
  }

  if (!tags.length) {
    addTag('contact');
  }

  return {
    categories: limitArrayUnique(categories, MAX_CATEGORY_COUNT),
    tags: limitArrayUnique(tags, MAX_TAG_COUNT),
    reasoning: reasons,
  };
}

function normalizeCategoryLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const trimmed = label.toString().trim();
  if (!trimmed) return null;
  const alias = CATEGORY_ALIAS_MAP[trimmed.toLowerCase()];
  if (alias) return alias;

  const normalized = trimmed
    .split(/[\s-]+/)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');

  return CATEGORY_TAXONOMY.includes(normalized) ? normalized : null;
}

function normalizeTagLabel(label: string | null | undefined): string | null {
  if (label === undefined || label === null) return null;
  const base = label.toString().trim();
  if (!base) return null;
  const alias = TAG_ALIAS_MAP[base.toLowerCase()];
  const cleaned = (alias || base.toLowerCase())
    .replace(/[^a-z0-9:\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, 40);
}

function limitArrayUnique(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    results.push(value);
    if (results.length >= limit) break;
  }

  return results;
}

function findKeywordMatch(text: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

// Define parameters with secrets
const EMAIL_USER = params.defineSecret("EMAIL_USER");
const EMAIL_PASS = params.defineSecret("EMAIL_PASS");
const TWILIO_SID = params.defineSecret("TWILIO_SID");
const TWILIO_AUTH_TOKEN = params.defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = params.defineSecret("TWILIO_PHONE_NUMBER");

// Function to send email
export const sendEmail = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
    secrets: [EMAIL_USER, EMAIL_PASS],
    cors: true, // Allow all origins
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      // Verify Firebase Auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      const {to, subject, text, fromName} = req.body;
      if (!to || !subject || !text) {
        res.status(400).json({ error: 'To, subject, and text are required' });
        return;
      }

      const displayName = fromName || "Contact Book";
      const senderEmail = decodedToken.email || decodedToken.uid;
      const senderName = decodedToken.name || senderEmail;
      
      // Enhanced message with sender information
      const enhancedText = `${text}\n\n---\nSent by: ${senderName} (${senderEmail})\nFrom group: ${displayName}\nVia ContactHub`;
      
      // Create transporter within function using secrets
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: EMAIL_USER.value(),
          pass: EMAIL_PASS.value(),
        },
      });
      
      await transporter.sendMail({
        from: `"${displayName} (ContactHub)" <${EMAIL_USER.value()}>`,
        to,
        subject: `${subject} - via ContactHub`,
        text: enhancedText,
        replyTo: EMAIL_USER.value(),
      });

      logger.info(`Email sent to ${to} by user ${decodedToken.uid}`);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error sending email:", error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  }
);

// Function to send SMS
export const sendSMS = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
    secrets: [TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER],
    cors: true, // Allow all origins
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      // Verify Firebase Auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      const {to, message} = req.body;
      if (!to || !message) {
        res.status(400).json({ error: 'To and message are required' });
        return;
      }

      const client = twilio(TWILIO_SID.value(), TWILIO_AUTH_TOKEN.value());
      
      await client.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER.value(),
        to,
      });

      logger.info(`SMS sent to ${to} by user ${decodedToken.uid}`);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error sending SMS:", error);
      res.status(500).json({ error: 'Failed to send SMS' });
    }
  }
);

// Scheduled function to send due messages - DISABLED for now

// New function with explicit CORS handling
export const categorizeContactV2 = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    // categorizeContactV2 function started
    // Vertex AI environment check completed
    
    // Set CORS headers for all responses - allow localhost for development and production domain
    const allowedOrigins = [
      'https://contacthub-29950.web.app',
      'http://localhost:8000',
      'http://localhost:3000',
      'http://localhost:5003' // Firebase hosting emulator
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin || '')) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Firebase-Instance-ID-Token');
    res.set('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // console.log('📝 Processing main request');
    // console.log('🔍 Request body:', JSON.stringify(req.body, null, 2));
    // console.log('👤 Auth header present:', !!req.headers.authorization);
    // console.log('🌐 Origin:', req.headers.origin);

    try {
      // Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      // console.log('✅ Authentication successful for user:', userId);

      const { contactId } = req.body;
      if (!contactId) {
        // console.log('❌ Missing contactId in request body');
        res.status(400).json({ error: 'Contact ID is required' });
        return;
      }

      // console.log('🔍 Looking up contact:', contactId);

      logger.info(`Starting categorization for user ${userId}, contact ${contactId}`);

      // Get contact data
      const contactDoc = await admin.firestore()
        .doc(`contacts/${contactId}`)
        .get();

      if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
        logger.warn(`Contact not found or access denied: ${contactId} for user ${userId}`);
        // console.log('❌ Contact not found or access denied:', contactId);
        res.status(404).json({ error: 'Contact not found' });
        return;
      }

      const contact = contactDoc.data() as ContactRecord;
      // console.log('✅ Contact found:', { name: contact.name, email: contact.email, hasNotes: !!contact.notes });
      logger.info(`Contact data retrieved: ${contact.name}`);

      const prompt = buildCategorizationPrompt(contact);
      // Prompt preview logged

      let categorization: CategorizationComputation;
      try {
        categorization = await generateCategorizationWithGuardrails(contact, prompt);
        // AI generation completed
        logger.info(`AI generation completed for ${contact.name}`);
      } catch (aiError) {
        logger.error(`AI generation failed for ${contact.name}:`, aiError);
        const error = aiError as any;
        logger.error(`AI Error details:`, {
          message: error?.message,
          code: error?.code,
          status: error?.status,
          details: error?.details,
        });

        // console.error('🔴 AI CATEGORIZATION ERROR:', {
        //   contactName: contact.name,
        //   contactId,
        //   errorMessage: error?.message,
        //   errorCode: error?.code,
        //   errorStatus: error?.status,
        //   errorDetails: error?.details,
        //   stack: error?.stack,
        //   fullError: aiError,
        // });

        const fallbackCategorization = buildHeuristicCategorization(
          contact,
          `AI service temporarily unavailable - using heuristic categorization. Error: ${error?.message || 'Unknown error'} (Code: ${error?.code || 'N/A'})`
        );

        const debugInfo = {
          errorMessage: error?.message,
          errorCode: error?.code,
          errorStatus: error?.status,
          errorDetails: error?.details,
          vertexProjectId: PROJECT_ID || 'unknown',
          vertexLocation: VERTEX_LOCATION,
          modelsTried: CATEGORIZATION_MODEL_CANDIDATES,
          promptLength: prompt.length,
          contactName: contact.name,
          contactId,
          timestamp: new Date().toISOString(),
        };

        // console.log(`💾 Updating contact ${contactId} with fallback aiCategories:`, fallbackCategorization.categories);
        await contactDoc.ref.update({
          aiCategories: fallbackCategorization.categories,
          aiTags: fallbackCategorization.tags,
          aiReasoning: fallbackCategorization.reasoning,
          aiCategorizedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // console.log(`✅ Successfully updated contact ${contactId} in Firestore with fallback`);

        logger.info(`Updated contact ${contactId} with fallback categories: ${fallbackCategorization.categories.join(', ')}`);

        res.json({
          categories: fallbackCategorization.categories,
          tags: fallbackCategorization.tags,
          reasoning: fallbackCategorization.reasoning,
          usedFallback: true,
          generatedAt: new Date().toISOString(),
          debugInfo,
        });
        return;
      }

      // console.log(`💾 Updating contact ${contactId} with aiCategories:`, categorization.categories);
      await contactDoc.ref.update({
        aiCategories: categorization.categories,
        aiTags: categorization.tags,
        aiReasoning: categorization.reasoning,
        aiCategorizedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // console.log(`✅ Successfully updated contact ${contactId} in Firestore`);

      logger.info(`Updated contact ${contactId} with categories: ${categorization.categories.join(', ')}`);

      res.json({
        categories: categorization.categories,
        tags: categorization.tags,
        reasoning: categorization.reasoning,
        usedFallback: categorization.usedFallback,
        model: categorization.model,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error categorizing contact:", error);
      res.status(500).json({ error: 'Failed to categorize contact' });
    }
  }
);

// Helper functions for smart group creation
function generateFallbackGroupSuggestions(contacts: any[]) {
  const categoryGroups: Record<string, any[]> = {};
  
  // Group contacts by their primary AI category
  contacts.forEach(contact => {
    const primaryCategory = (contact.aiCategories || contact.categories || ['General'])[0];
    if (!categoryGroups[primaryCategory]) {
      categoryGroups[primaryCategory] = [];
    }
    categoryGroups[primaryCategory].push(contact);
  });

  const suggestedGroups = Object.entries(categoryGroups)
    .filter(([_, groupContacts]) => groupContacts.length > 0)
    .map(([category, groupContacts]) => ({
      name: `${category} Contacts`,
      purpose: `A group for all your ${category.toLowerCase()} contacts to help organize and communicate with this relationship type.`,
      contacts: groupContacts.map(c => c.name),
      rationale: `Grouped by AI-detected ${category.toLowerCase()} relationship category`
    }));

  return {
    suggestedGroups,
    insights: `Created ${suggestedGroups.length} groups based on contact categories. Consider reviewing and customizing these groups based on your specific communication needs.`
  };
}

function validateAndEnhanceGroupSuggestions(suggestions: any, contacts: any[]) {
  const contactNameMap = new Map(contacts.map(c => [c.name.toLowerCase(), c]));
  const usedContactIds = new Set<string>();
  
  // Validate and enhance each suggested group
  const validatedGroups = suggestions.suggestedGroups?.map((group: any) => {
    // Validate contact assignments
    const validContacts: string[] = [];
    const contactIds: string[] = [];
    
    group.contacts?.forEach((contactName: string) => {
      const contact = contactNameMap.get(contactName.toLowerCase());
      if (contact && !usedContactIds.has(contact.id)) {
        validContacts.push(contact.name);
        contactIds.push(contact.id);
        usedContactIds.add(contact.id);
      }
    });

    return {
      ...group,
      contacts: validContacts,
      contactIds,
      contactCount: validContacts.length
    };
  }).filter((group: any) => group.contacts.length > 0) || [];

  // Add any unassigned contacts to a catch-all group
  const unassignedContacts = contacts.filter(c => !usedContactIds.has(c.id));
  if (unassignedContacts.length > 0) {
    validatedGroups.push({
      name: "Additional Contacts",
      purpose: "Contacts that didn't fit neatly into other suggested groups. Review and assign to appropriate groups.",
      contacts: unassignedContacts.map(c => c.name),
      contactIds: unassignedContacts.map(c => c.id),
      contactCount: unassignedContacts.length,
      rationale: "Catch-all group for contacts not assigned to specific categories"
    });
  }

  return {
    suggestedGroups: validatedGroups,
    insights: suggestions.insights || "AI-powered group suggestions based on contact analysis and relationship patterns."
  };
}

// Archive user data exports
export {archiveUserData, cleanupExpiredArchives} from './archive';
