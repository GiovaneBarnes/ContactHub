import {setGlobalOptions} from "firebase-functions";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated, onDocumentDeleted} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
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
// Performance: Prioritize fastest models with lowest latency
const BUILTIN_MODEL_FALLBACKS = [
  'gemini-2.5-flash',      // Fastest, lowest latency
  'gemini-2.0-flash-001',  // Fast fallback
  'gemini-1.5-flash-001',  // Legacy fast
  // Removed heavier models for speed - uncomment if needed:
  // 'gemini-2.5-pro',
  // 'gemini-2.0-flash',
  // 'gemini-1.5-flash',
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
const messageGenerationTemplate = `You are an expert communication specialist creating natural, professional messages that people can trust and send immediately without editing.

CONTEXT:
Group Purpose: {{backgroundInfo}}
Number of Recipients: {{contactCount}}
Last Contact: {{lastContactDate}}

YOUR TASK: Write ONE complete, ready-to-send message (100-180 words) appropriate for this group.

===== CRITICAL OUTPUT REQUIREMENTS =====
1. Output ONLY the message text - absolutely no titles, headers, labels, or markdown
2. Start with a natural greeting ("Hey!", "Hi!", "Hello!", "Hope you're doing well!", etc.)
3. End with proper punctuation (. ! or ?) - NEVER leave thoughts unfinished
4. Every sentence must be complete and grammatically correct
5. Message must be immediately sendable without any editing

===== CONTENT QUALITY STANDARDS =====
1. NO placeholders like [Name], [Event], [Memory] - use only actual content
2. NO invented specific details unless explicitly in Group Purpose
3. NO references to "group", "everyone", "you all" - write as if to one person
4. NO generic corporate language - sound like a real human being
5. Keep tone warm, genuine, and appropriate for the relationship type
6. Base specificity ONLY on what's provided in Group Purpose - otherwise stay general

===== MESSAGE STRUCTURE =====
• Opening: Natural greeting that matches the relationship
• Body: 2-3 sentences showing genuine interest and context
• Close: Clear, actionable next step (suggest meeting, ask question, etc.)
• Signature feel: Warm but not forced

===== TONE MATCHING =====
• Professional contacts → Respectful, clear, purposeful
• Friends/Family → Warm, casual, enthusiastic
• Mixed/General → Friendly but professional
• Unknown context → Default to warm and authentic

===== PERFECT EXAMPLES =====

Example 1 (General friends, no specific details):
Hey! How have you been? I realized it's been way too long since we properly caught up. What have you been working on lately? I'd love to hear what's new in your world. Let me know if you're free for coffee or a quick call in the next couple weeks!

Example 2 (Professional network, light context):
Hi! Hope you've been doing well. I've been reflecting on some of our past conversations about the industry, and I'd really value your perspective on a few things. Would you be open to grabbing coffee or hopping on a brief call sometime next week? Would be great to reconnect.

Example 3 (Close friends, more casual):
Hey! It's been forever since we hung out and I've been thinking about you. Life has been crazy but I miss our catch-up sessions. How about we grab dinner or coffee soon? I want to hear everything that's been going on with you. When are you free?

Example 4 (Family check-in):
Hi! Hope you're doing well! I wanted to check in and see how things have been going for you. It feels like we haven't talked in a while and I'd love to catch up properly. Are you free for a call this week or maybe we could meet up soon?

===== OUTPUT FORMAT =====
Output the message starting immediately with the greeting. No explanations, no labels, no formatting.

Write the message now:`;

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
const communicationAnalysisTemplate = `You are a relationship intelligence analyst providing actionable communication insights.

CONTACT INFORMATION:
Name: {{name}}
Relationship: {{relationship}}
Last Contact: {{lastContact}}
Message History:
{{messageLogs}}

TASK: Analyze communication patterns and provide structured, trustworthy recommendations.

===== OUTPUT FORMAT (STRICT) =====
Frequency: [EXACT pattern - e.g., "Every 2-3 weeks", "Monthly", "Quarterly", "Sporadic"]
Preferred Method: [PRIMARY method - e.g., "Email", "SMS", "Phone calls", "In-person"]
Next Contact Suggestion: [SPECIFIC timing - e.g., "Within 7-10 days", "By end of next week", "Early next month"]
Insights: [Insight 1], [Insight 2], [Insight 3]

===== QUALITY REQUIREMENTS =====
1. Frequency: Be specific, not vague. Use actual time intervals.
2. Preferred Method: State only the MOST used method, not multiple.
3. Next Contact Suggestion: Give actionable timing, not generic advice.
4. Insights: Each must be specific, actionable, and based on observable patterns.

===== INSIGHT GUIDELINES =====
• Focus on patterns, not speculation
• Provide actionable relationship maintenance advice
• Note any concerning trends (e.g., declining frequency)
• Highlight strengths in the relationship
• Avoid generic statements like "communication is important"

===== EXAMPLES =====

Good Analysis:
Frequency: Every 3-4 weeks
Preferred Method: Email
Next Contact Suggestion: Within 5-7 days to maintain current rhythm
Insights: Response time typically 24-48 hours indicating engaged relationship, Recent 6-week gap is unusual and suggests overdue check-in, Prefers weekday communication based on response patterns

Bad Analysis:
Frequency: Sometimes
Preferred Method: Various methods
Next Contact Suggestion: Soon
Insights: Stay in touch, Communication matters, Be consistent

Provide your analysis now:`;

// AI prompt for smart contact time suggestions  
const contactTimeSuggestionTemplate = `You are a scheduling intelligence system providing precise, timezone-aware contact timing recommendations.

CONTACT PROFILE:
Name: {{name}}
Contact's Timezone: {{timezone}}
User's Timezone: {{userTimezone}}
Preferred Contact Times: {{preferredTimes}}
Communication Style: {{communicationStyle}}
Last Contact: {{lastContact}}
Response Patterns: {{responsePatterns}}

TASK: Provide specific, actionable timing recommendations that work for BOTH timezones and respect business/personal hours in BOTH locations.

===== OUTPUT FORMAT (STRICT) =====
Recommended Time: [DAY, TIME with timezone - e.g., "Tuesday, 10:00 AM EST", "Next Friday, 2:00 PM PST"]
Reasoning: [Complete 1-2 sentence explanation with proper punctuation]
Alternatives: [Alt 1 day/time], [Alt 2 day/time], [Alt 3 day/time]

===== ABSOLUTE REQUIREMENTS =====
1. TIME WINDOWS (MANDATORY):
   • Professional contacts: ONLY 9:00 AM - 5:00 PM (strict business hours)
   • Personal contacts: 9:00 AM - 8:00 PM (reasonable waking hours)
   • NEVER suggest: Before 8 AM, after 8 PM, or midnight (12:00 AM)
   
2. DAY SELECTION (MANDATORY):
   • Professional contacts: Monday-Friday ONLY (NO weekends)
   • Personal contacts: Any day acceptable
   • Suggest 1-5 days in the future (not same day, not too far out)

3. ALTERNATIVES (MANDATORY):
   • Must provide EXACTLY 3 different alternatives
   • Each alternative must be on a DIFFERENT day
   • Each alternative must have a DIFFERENT time
   • NO duplicates allowed
   • Must follow same time window rules as main recommendation

4. REASONING (MANDATORY):
   • Must be a complete sentence ending with punctuation (. or !)
   • Must reference specific factors (timezone, communication style, patterns)
   • Must be 20-100 words (not truncated)

===== TIME WINDOW REFERENCE =====
ACCEPTABLE HOURS for Professional:
• Early Morning: 9:00 AM - 9:30 AM
• Mid-Morning: 9:30 AM - 11:30 AM ⭐ IDEAL
• Noon: 12:00 PM - 1:00 PM
• Early Afternoon: 1:00 PM - 3:00 PM ⭐ IDEAL  
• Late Afternoon: 3:00 PM - 5:00 PM

UNACCEPTABLE (REJECT):
• 12:00 AM - 8:59 AM (too early)
• 5:01 PM - 11:59 PM (too late)
• Weekends (Saturday/Sunday) for professional

===== DECISION FACTORS =====
Priority Order:
1. Explicitly stated preferred times (highest weight)
2. Observed response patterns (medium-high weight)
3. Timezone-appropriate business/personal hours (medium weight)
4. Communication style norms (low weight)
5. General best practices (lowest weight)

===== EXAMPLES =====

PERFECT Recommendation (Professional):
Recommended Time: Tuesday, 10:30 AM EST
Reasoning: Mid-morning timing in EST aligns with professional communication norms and avoids early-morning disruption. This translates to 7:30 AM PST for you, allowing morning preparation before outreach.
Alternatives: Wednesday, 2:00 PM EST, Thursday, 10:00 AM EST, Friday, 3:00 PM EST

PERFECT Recommendation (Personal):
Recommended Time: Saturday, 11:00 AM EST  
Reasoning: Late-morning weekend timing respects casual communication style and ensures contact availability during leisurely hours.
Alternatives: Sunday, 2:00 PM EST, Friday, 6:30 PM EST, Saturday, 4:00 PM EST

TERRIBLE Recommendation (NEVER DO THIS):
Recommended Time: Sunday, 6:00 AM EST
Reasoning: Early morning contact in their timezone
Alternatives: Saturday, 12:00 AM EST, Saturday, 12:00 PM EST, Saturday, 12:00 AM EST
[PROBLEMS: 6 AM too early! Weekend for professional! Truncated reasoning! Duplicate alternatives! Midnight suggestion!]

Provide your recommendation now:`;

// AI prompt for smart group creation
const smartGroupCreationTemplate = `You are a relationship strategy expert helping organize contacts into effective communication groups.

CONTACT DATABASE:
{{contactData}}

TASK: Analyze these contacts and suggest 3-5 optimal groups that facilitate better relationship management and communication.

===== GROUPING PRINCIPLES =====

1. PURPOSEFUL GROUPING
   • Each group should have a clear communication purpose
   • Consider communication frequency needs
   • Think about message relevance across group members

2. BALANCED SIZING  
   • Minimum 2 contacts per group (no single-person groups)
   • Maximum ~15 contacts per group (keep manageable)
   • Similar engagement levels within groups

3. RELATIONSHIP CONTEXT
   • Professional vs personal boundaries
   • Shared interests or contexts
   • Communication style compatibility
   • Timezone and availability alignment

4. STRATEGIC VALUE
   • Groups should solve a real communication need
   • Enable batch communication where appropriate
   • Facilitate relationship nurturing at scale

===== OUTPUT FORMAT (STRICT JSON) =====
{
  "suggestedGroups": [
    {
      "name": "Concise, descriptive group name (max 30 chars)",
      "purpose": "Clear explanation of group's communication purpose (100-150 words)",
      "contacts": ["Contact Name 1", "Contact Name 2", "Contact Name 3"],
      "rationale": "Specific reasoning for this grouping based on shared attributes (50-100 words)"
    }
  ],
  "insights": "Overall strategy and recommendations for managing these contact groups (100-150 words)"
}

===== QUALITY REQUIREMENTS =====
• Group names: Professional, clear, specific (not generic like "Group 1")
• Purpose: Actionable and specific to group's communication needs
• Contacts: Use EXACT names as provided in contact data
• Rationale: Reference actual data points (categories, tags, notes)
• Insights: Strategic advice on group management and communication

===== EXAMPLE OUTPUT =====
{
  "suggestedGroups": [
    {
      "name": "Tech Industry Network",
      "purpose": "Professional contacts in technology sector for sharing industry insights, job opportunities, and collaborative project discussions. Regular quarterly updates recommended to maintain network strength and mutual value.",
      "contacts": ["Sarah Chen", "Michael Rodriguez", "Amy Park", "David Williams"],
      "rationale": "All four contacts work in technology roles based on notes and professional categories. They share common interests in AI and product development, making them ideal for group updates about industry trends and opportunities."
    },
    {
      "name": "Monthly Check-in Circle",
      "purpose": "Close personal friends who value regular connection. Perfect for monthly group updates, event planning, and maintaining strong personal relationships despite busy schedules. Casual, warm tone appropriate.",
      "contacts": ["Jessica Miller", "Tom Anderson", "Lisa Brown"],
      "rationale": "All tagged as close friends with notes indicating desire for regular contact. Similar communication preferences (prefer text/email over calls) and compatible schedules for group coordination."
    }
  ],
  "insights": "Your contact network shows a clear split between professional and personal relationships, with strong clustering in technology sector. Consider separating high-touch relationships (weekly/monthly) from low-touch (quarterly/annual) to optimize communication frequency. The professional network could benefit from structured quarterly updates, while personal connections may prefer more spontaneous check-ins."
}

Generate your recommendations now:`;

// AI prompt for contact summary generation
const contactSummaryTemplate = `You are a relationship intelligence analyst creating comprehensive, actionable contact summaries.

CONTACT DATA:
Name: {{name}}
Email: {{email}}
Phone: {{phone}}
Notes: {{notes}}
Categories: {{categories}}
Tags: {{tags}}

INTERACTION HISTORY:
{{interactions}}

TASK: Create a professional, actionable summary (200-350 words) that helps maintain and strengthen this relationship.

===== REQUIRED SECTIONS =====

1. RELATIONSHIP OVERVIEW (2-3 sentences)
   • Nature of the relationship and context
   • How long you've been in contact
   • Primary relationship category

2. COMMUNICATION PATTERNS (2-3 sentences)
   • Frequency of interaction
   • Preferred communication methods
   • Response patterns and engagement level

3. KEY TOPICS & INTERESTS (2-3 sentences)
   • Main subjects of discussion
   • Shared interests or professional topics
   • Notable conversation themes

4. RELATIONSHIP HEALTH (1-2 sentences)
   • Current status and trajectory
   • Any concerning or positive patterns

5. RECOMMENDED ACTIONS (2-3 specific items)
   • Actionable next steps
   • Timing for next contact
   • Suggested conversation topics

===== QUALITY STANDARDS =====
• Be specific and factual, not vague or generic
• Every statement should be backed by provided data
• Avoid speculation about feelings or intentions
• Write in clear, professional language
• End each section with complete sentences
• Make recommendations actionable and time-bound

===== EXAMPLE OUTPUT =====

{{name}} is a professional contact from the technology sector, with whom you've maintained regular communication over the past 18 months. The relationship began through a mutual connection and has evolved into a valuable professional network relationship.

Communication occurs approximately every 3-4 weeks, primarily via email with occasional phone calls for more substantive discussions. Response time is typically 24-48 hours, indicating an engaged and responsive relationship. The consistent communication rhythm suggests mutual value in maintaining contact.

Conversations center around industry trends, product development strategies, and occasionally personal updates about professional milestones. There's a shared interest in AI applications in business, which has been a recurring theme. Recent discussions have touched on market expansion and innovation challenges.

The relationship is healthy and mutually beneficial, with consistent engagement from both parties. The recent 6-week gap is unusual based on historical patterns and may warrant attention.

Recommended Actions:
1. Reach out within the next 5-7 days to re-establish regular rhythm and check in on recent project discussion
2. Reference the AI applications topic from last conversation as a natural continuation point
3. Suggest a coffee meeting or video call in the next 2-3 weeks to deepen the relationship beyond email exchanges

Write the complete summary now:`;

// Set global options for all functions - performance + cost optimized
setGlobalOptions({
  maxInstances: 20,        // Increased for better scaling under load
  // minInstances: 0 by default - set per-function only when needed
  concurrency: 80,         // Handle multiple requests per instance
  memory: '512MiB',        // Default memory for most functions
  timeoutSeconds: 30,      // Default timeout
});

// Cloud Functions
export const generateGroupMessage = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
    maxInstances: 10,        // Scale up quickly under load
    concurrency: 100,        // High concurrency keeps instance alive
    // No minInstances = $0 baseline cost
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
        temperature: 0.65, // Balanced for natural but consistent quality
        maxOutputTokens: 1536, // Ensure complete messages even for longer contexts
      });

      // Comprehensive message validation and cleanup
      let cleanedMessage = result.text.trim();
      
      // Remove any headers, labels, or meta-commentary
      cleanedMessage = cleanedMessage.replace(/^(Message \d+:|Message:|Output:|Result:|Here (is|are|'s) .*?messages?:|Here's .*?message:|\*\*Message \d+:\*\*|\*\*Output:\*\*)/gi, '').trim();
      
      // Remove markdown formatting that breaks plain text
      cleanedMessage = cleanedMessage.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
      cleanedMessage = cleanedMessage.replace(/\*(.*?)\*/g, '$1'); // Italic  
      cleanedMessage = cleanedMessage.replace(/^[•\-\*]\s+/gm, ''); // Bullet points
      cleanedMessage = cleanedMessage.replace(/^\d+\.\s+/gm, ''); // Numbered lists
      
      // Remove code fences or technical artifacts
      cleanedMessage = cleanedMessage.replace(/```[\s\S]*?```/g, '').trim();
      cleanedMessage = cleanedMessage.replace(/`([^`]+)`/g, '$1');
      
      // Clean up excessive spacing
      cleanedMessage = cleanedMessage.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
      cleanedMessage = cleanedMessage.replace(/ {2,}/g, ' '); // Single spaces only
      
      // Remove trailing ellipsis (incomplete thought indicator)
      cleanedMessage = cleanedMessage.replace(/\.{3,}$/g, '.');
      cleanedMessage = cleanedMessage.replace(/\.\.$/g, '.');
      
      // Critical validation: ensure message ends properly
      if (!/[.!?]$/.test(cleanedMessage)) {
        logger.warn(`Message incomplete, adding punctuation: "${cleanedMessage.slice(-50)}"`);
        // Add appropriate punctuation based on context
        if (cleanedMessage.match(/(\?|what|how|when|where|why|would|could|should)\s*$/i)) {
          cleanedMessage += '?'; // Looks like a question
        } else if (cleanedMessage.match(/(!)$/)) {
          cleanedMessage += '!'; // Exclamatory
        } else {
          cleanedMessage += '.'; // Default statement
        }
      }
      
      // Quality checks
      const wordCount = cleanedMessage.split(/\s+/).length;
      if (wordCount < 20) {
        logger.error(`Message too short (${wordCount} words): "${cleanedMessage}"`);
        throw new Error('Generated message is too short - regeneration required');
      }
      
      // Check for placeholder artifacts
      const placeholderPatterns = /\[(.*?)\]|\{\{.*?\}\}|\[Name\]|\[Event\]|\[specific memory\]/gi;
      if (placeholderPatterns.test(cleanedMessage)) {
        logger.error(`Message contains placeholders: "${cleanedMessage}"`);
        throw new Error('Generated message contains placeholder text - regeneration required');
      }

      logger.info(`Generated validated AI message for group ${groupId} (${wordCount} words)`);

      return {
        message: cleanedMessage,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          wordCount,
          model: result.model,
          validated: true
        }
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
    memory: "256MiB",
    timeoutSeconds: 20,
    maxInstances: 10,
    concurrency: 100,        // Keep instance alive during active periods
    // No minInstances = $0 baseline cost
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
    memory: "256MiB",
    timeoutSeconds: 20,
    maxInstances: 5,
    concurrency: 80,
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
        temperature: 0.2, // Low temperature for consistent, factual analysis
        maxOutputTokens: 1024,
      });

      const response = result.text;

      // Parse with validation
      const frequency = extractValueFromResponse(response, "Frequency:") || "Regular";
      const preferredMethod = extractValueFromResponse(response, "Preferred Method:") || "Email";
      const nextContactSuggestion = extractValueFromResponse(response, "Next Contact Suggestion:") || "Within 1-2 weeks";
      const insightsText = extractValueFromResponse(response, "Insights:");
      
      // Parse and validate insights
      let insights: string[] = [];
      if (insightsText) {
        insights = insightsText
          .split(/[,;]|\d+\.\s+/) // Split on commas, semicolons, or numbered lists
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 10) // Filter out too-short insights
          .slice(0, 5); // Max 5 insights
      }
      
      // Quality check: ensure we have actionable insights
      if (insights.length === 0) {
        insights = [
          `Communication frequency: ${frequency}`,
          `Primary contact method: ${preferredMethod}`,
          "Consider maintaining consistent contact rhythm"
        ];
      }

      logger.info(`Analyzed communication patterns for contact ${contactId}: ${frequency}, ${preferredMethod}`);

      return {
        frequency,
        preferredMethod,
        nextContactSuggestion,
        insights,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          model: result.model,
          validated: true
        }
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
    memory: "256MiB",
    timeoutSeconds: 15,
    maxInstances: 5,
    concurrency: 80,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {contactId, timezone, preferredTimes, communicationStyle, lastContact, responsePatterns, userTimezone} = request.data;
    if (!contactId) {
      throw new HttpsError("invalid-argument", "Contact ID is required");
    }

    try {
      const userId = request.auth.uid;

      // Get user timezone if not provided
      let finalUserTimezone = userTimezone;
      if (!finalUserTimezone) {
        const userDoc = await admin.firestore().doc(`users/${userId}`).get();
        finalUserTimezone = userDoc.data()?.timezone || 'America/New_York'; // Default to EST
      }

      // Get contact data for context
      const contactDoc = await admin.firestore()
        .doc(`contacts/${contactId}`)
        .get();

      if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Contact not found");
      }

      const contact = contactDoc.data()!;

      // Generate AI time suggestion with BOTH timezones
      const promptVariables = {
        name: contact.name,
        timezone: timezone || 'America/New_York',
        userTimezone: finalUserTimezone,
        preferredTimes: preferredTimes?.join(', ') || 'Not specified',
        communicationStyle: communicationStyle || 'professional',
        lastContact: lastContact || 'Unknown',
        responsePatterns: responsePatterns?.join(', ') || 'Not available',
      };
      
      logger.info(`Generating timing for ${contactId}:`, {
        contactTz: promptVariables.timezone,
        userTz: promptVariables.userTimezone,
        style: promptVariables.communicationStyle
      });
      
      const prompt = interpolateTemplate(contactTimeSuggestionTemplate, promptVariables);
      const result = await generateWithVertexAI(prompt, {
        model: ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'],
        temperature: 0.1, // Very low temperature for precise, consistent scheduling
        maxOutputTokens: 2048, // High token limit to prevent truncation of reasoning
      });

      const response = result.text;
      logger.info(`Raw AI timing response for ${contactId}:`, response);

      // Parse structured response with better extraction
      let recommendedTime = extractValueFromResponse(response, "Recommended Time:");
      let reasoning = extractMultiLineValue(response, "Reasoning:");
      const alternativesText = extractMultiLineValue(response, "Alternatives:");
      
      // CRITICAL VALIDATION: Reject obviously bad recommendations
      const isProfessional = (communicationStyle || '').toLowerCase().includes('professional');
      
      const isBadRecommendation = (time: string): boolean => {
        if (!time || time.length < 10) return true;
        
        // Extract hour from time string (e.g., "10:00 AM" -> 10, "2:00 PM" -> 14)
        const hourMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (hourMatch) {
          let hour = parseInt(hourMatch[1]);
          const isPM = hourMatch[3].toUpperCase() === 'PM';
          
          // Convert to 24-hour format
          if (isPM && hour !== 12) hour += 12;
          if (!isPM && hour === 12) hour = 0;
          
          // Reject times outside reasonable hours (before 8 AM or after 8 PM)
          if (hour < 8 || hour >= 20) {
            logger.warn(`Rejecting unreasonable hour: ${time} (hour: ${hour})`);
            return true;
          }
        }
        
        // Check for weekend if professional
        if (isProfessional && /(saturday|sunday|sat|sun)/i.test(time)) {
          logger.warn(`Rejecting weekend time for professional contact: ${time}`);
          return true;
        }
        
        return false;
      };
      
      // If AI recommendation is bad, use smart fallback
      if (isBadRecommendation(recommendedTime)) {
        logger.warn(`AI produced bad recommendation for ${contactId}, using smart fallback`);
        recommendedTime = '';
      }
      
      // Validate and clean up recommended time
      if (!recommendedTime || recommendedTime.length < 5) {
        const fallbackDay = new Date();
        const isProfessional = (communicationStyle || '').toLowerCase().includes('professional');
        
        // Find next appropriate day
        fallbackDay.setDate(fallbackDay.getDate() + 1);
        if (isProfessional) {
          while (fallbackDay.getDay() === 0 || fallbackDay.getDay() === 6) {
            fallbackDay.setDate(fallbackDay.getDate() + 1);
          }
        }
        
        const dayName = fallbackDay.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
        const tzAbbr = timezone.split('/').pop() || timezone;
        
        recommendedTime = `${dayName}, ${isProfessional ? '10:00' : '10:00'} AM ${tzAbbr}`;
        reasoning = isProfessional
          ? `Mid-morning on the next business day in ${tzAbbr} timezone provides optimal professional outreach timing.`
          : `Next-day morning in ${tzAbbr} timezone balances availability with timely outreach.`;
        logger.info(`Using fallback time for ${contactId}: ${recommendedTime}`);
      }
      
      // Parse alternatives with rigorous validation and deduplication
      let alternatives: string[] = [];
      if (alternativesText) {
        // Split by commas, semicolons, or numbered lists
        const parsedAlts = alternativesText
          .split(/[,;]|(?:\d+\.)\s+/)
          .map((s: string) => s.trim())
          .filter((s: string) => {
            // Must have meaningful content (day + time + timezone)
            if (s.length < 10 || !/\d{1,2}:\d{2}\s*(AM|PM)/i.test(s)) return false;
            
            // Reject if bad recommendation
            if (isBadRecommendation(s)) return false;
            
            // Reject if duplicate of main recommendation
            if (s === recommendedTime) return false;
            
            return true;
          });
        
        // Deduplicate and validate uniqueness
        const uniqueAlts = Array.from(new Set(parsedAlts));
        
        // Further validate: ensure different days
        const seenDays = new Set<string>();
        for (const alt of uniqueAlts) {
          const dayMatch = alt.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i);
          if (dayMatch) {
            const day = dayMatch[0].toLowerCase();
            if (!seenDays.has(day)) {
              seenDays.add(day);
              alternatives.push(alt);
              if (alternatives.length >= 3) break;
            }
          }
        }
      }
      
      // Generate SMART alternatives if we don't have 3 unique ones
      if (alternatives.length < 3) {
        const now = new Date();
        const isProfessional = (communicationStyle || '').toLowerCase().includes('professional');
        
        // Get proper timezone abbreviation
        const getTimezoneAbbr = (tz: string): string => {
          try {
            const date = new Date();
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              timeZoneName: 'short'
            }).formatToParts(date);
            return parts.find(p => p.type === 'timeZoneName')?.value || tz.split('/').pop() || tz;
          } catch {
            return tz.split('/').pop() || tz;
          }
        };
        
        const tzAbbr = getTimezoneAbbr(timezone);
        
        logger.info(`Generating ${3 - alternatives.length} fallback alternatives for ${contactId}`);
        
        const generateAlternative = (daysAhead: number, hour: number): string => {
          const date = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
          
          // Skip weekends for professional
          if (isProfessional) {
            while (date.getDay() === 0 || date.getDay() === 6) {
              date.setDate(date.getDate() + 1);
            }
          }
          
          const dayName = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });
          const period = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          return `${dayName}, ${displayHour}:00 ${period} ${tzAbbr}`;
        };
        
        // Professional: spread across weekdays with varied times
        // Personal: include weekends
        const fallbackTimes = isProfessional 
          ? [
              generateAlternative(2, 14),  // 2 business days, 2 PM
              generateAlternative(3, 10),  // 3 business days, 10 AM  
              generateAlternative(4, 15),  // 4 business days, 3 PM
              generateAlternative(5, 11)   // 5 business days, 11 AM
            ]
          : [
              generateAlternative(1, 18),  // Tomorrow, 6 PM
              generateAlternative(2, 11),  // 2 days, 11 AM
              generateAlternative(3, 15),  // 3 days, 3 PM
              generateAlternative(5, 19)   // 5 days, 7 PM
            ];
        
        // Add fallbacks, ensuring no duplicates
        for (const fallback of fallbackTimes) {
          if (alternatives.length >= 3) break;
          
          // Check it's not a duplicate
          if (fallback !== recommendedTime && !alternatives.includes(fallback)) {
            alternatives.push(fallback);
          }
        }
      }

      logger.info(`Suggested contact time for ${contactId}: ${recommendedTime}, alternatives: ${alternatives.join(', ')}`);

      // Helper function for timezone abbreviation (used throughout)
      const getTimezoneAbbr = (tz: string): string => {
        try {
          const date = new Date();
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            timeZoneName: 'short'
          }).formatToParts(date);
          return parts.find(p => p.type === 'timeZoneName')?.value || tz.split('/').pop() || tz;
        } catch {
          return tz.split('/').pop() || tz;
        }
      };
      
      // Ensure reasoning is complete (not truncated)
      if (!reasoning || reasoning.length < 20) {
        const isProfessional = (communicationStyle || '').toLowerCase().includes('professional');
        const tzAbbr = getTimezoneAbbr(timezone);
        reasoning = isProfessional
          ? `Mid-morning business hours in ${tzAbbr} timezone aligns with professional communication norms and maximizes engagement likelihood based on typical work patterns.`
          : `This timing in ${tzAbbr} timezone respects personal communication preferences while ensuring reasonable waking hours for casual outreach.`;
        logger.warn(`Reasoning was empty or too short for ${contactId}, using fallback`);
      } else if (!reasoning.match(/[.!?]$/)) {
        // Reasoning exists but is incomplete (truncated mid-sentence)
        logger.warn(`Reasoning truncated for ${contactId}, attempting completion: "${reasoning}"`);
        
        // Try to complete the sentence intelligently
        if (reasoning.match(/ensuring|allowing|providing|respecting/i) && reasoning.length > 50) {
          // Looks like it was cut off while explaining benefits
          reasoning += ' optimal communication timing.';
        } else {
          // Generic completion
          reasoning += '.';
        }
        
        logger.info(`Completed truncated reasoning: "${reasoning}"`);
      }

      return {
        recommendedTime,
        reasoning,
        alternatives,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          timezone,
          userTimezone: finalUserTimezone,
          model: result.model,
          validated: true,
          isProfessional: (communicationStyle || '').toLowerCase().includes('professional')
        }
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
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 5,
    concurrency: 50,         // Lower for more complex operations
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
        maxOutputTokens: 2048, // Allow for complete 350-word summaries
      });

      let summary = result.text.trim();
      
      // Validate summary quality
      const wordCount = summary.split(/\s+/).length;
      
      // Ensure minimum quality standards
      if (wordCount < 50) {
        logger.warn(`Summary too short (${wordCount} words), using enhanced fallback`);
        summary = `${contact.name} is a ${(contact.categories || ['General'])[0].toLowerCase()} contact with ${contact.email ? 'email' : ''}${contact.email && contact.phone ? ' and ' : ''}${contact.phone ? 'phone' : ''} information on file. ${contact.notes ? 'Notes indicate: ' + contact.notes.slice(0, 100) : 'No detailed notes available yet.'}\n\nCommunication history shows ${interactions?.length || 0} recorded interaction${interactions?.length === 1 ? '' : 's'}. ${interactions?.length ? 'Recent activity suggests an ongoing relationship.' : 'Consider establishing regular communication to strengthen this connection.'}\n\nRecommended Actions:\n1. Review contact information for completeness\n2. Schedule next check-in within 2-3 weeks\n3. Add detailed notes about context and recent interactions`;
      }
      
      // Remove any markdown headers or formatting
      summary = summary.replace(/^#+\s+/gm, '');
      summary = summary.replace(/\*\*(.*?)\*\*/g, '$1');
      summary = summary.replace(/\*(.*?)\*/g, '$1');
      
      // Ensure proper paragraph formatting
      summary = summary.replace(/\n{3,}/g, '\n\n');

      logger.info(`Generated contact summary for ${contactId} (${wordCount} words)`);

      return {
        summary,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          wordCount,
          model: result.model,
          validated: true
        }
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
    memory: "512MiB",
    timeoutSeconds: 45,
    maxInstances: 3,         // Rarely used
    concurrency: 50,
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
        temperature: 0.35, // Balanced creativity for group suggestions
        maxOutputTokens: 3072, // Allow for detailed group analysis
      });

      let suggestions;
      
      try {
        // Try to extract JSON from response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
          
          // Validate structure
          if (!suggestions.suggestedGroups || !Array.isArray(suggestions.suggestedGroups)) {
            throw new Error('Invalid suggestedGroups structure');
          }
          
          // Validate each group
          suggestions.suggestedGroups = suggestions.suggestedGroups
            .filter((group: any) => {
              return group.name && 
                     group.purpose && 
                     Array.isArray(group.contacts) && 
                     group.contacts.length >= 2; // Minimum 2 contacts per group
            })
            .slice(0, 8); // Maximum 8 groups
          
          // Ensure we have insights
          if (!suggestions.insights || suggestions.insights.trim().length < 20) {
            suggestions.insights = `Analyzed ${contacts.length} contacts and created ${suggestions.suggestedGroups.length} strategic groups based on relationship types, communication patterns, and shared contexts. Review and customize these groups based on your specific communication needs.`;
          }
          
        } else {
          throw new Error('No JSON structure found in response');
        }
      } catch (parseError) {
        logger.warn(`Failed to parse AI group suggestions: ${parseError}`);
        // Fallback to heuristic grouping
        suggestions = generateFallbackGroupSuggestions(contacts);
      }

      // Additional validation and enhancement
      const validatedSuggestions = validateAndEnhanceGroupSuggestions(suggestions, contacts);
      
      // Quality check: ensure meaningful groups
      if (validatedSuggestions.suggestedGroups.length === 0) {
        logger.warn('No valid groups generated, creating basic category groups');
        validatedSuggestions.suggestedGroups = generateFallbackGroupSuggestions(contacts).suggestedGroups;
      }

      logger.info(`Generated ${validatedSuggestions.suggestedGroups.length} smart group suggestions for user ${userId}`);

      return {
        ...validatedSuggestions,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          contactCount: contacts.length,
          groupCount: validatedSuggestions.suggestedGroups.length,
          model: result.model,
          validated: true
        }
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

// Trigger when a contact is deleted - remove from all groups
// CRITICAL: This listens to the root /contacts/{contactId} path, not /users/{userId}/contacts/{contactId}
export const onContactDeleted = onDocumentDeleted(
  {
    document: "contacts/{contactId}",
    region: "us-central1",
    memory: "512MiB",
  },
  async (event) => {
    const contactId = event.params.contactId;
    const contactData = event.data?.data();
    const userId = contactData?.userId;
    
    if (!userId) {
      logger.warn(`Contact ${contactId} deleted but no userId found in data`);
      return;
    }
    
    logger.info(`Contact ${contactId} deleted for user ${userId}, cleaning up groups...`);
    
    try {
      const db = admin.firestore();
      
      // Get all groups for this user (groups are stored at root level with userId field)
      const groupsSnapshot = await db
        .collection('groups')
        .where('userId', '==', userId)
        .get();
      
      const updatePromises: Promise<any>[] = [];
      
      for (const groupDoc of groupsSnapshot.docs) {
        const group = groupDoc.data();
        const contactIds = group.contactIds || [];
        
        // If this contact was in the group, remove it
        if (contactIds.includes(contactId)) {
          logger.info(`Removing contact ${contactId} from group ${groupDoc.id}`);
          
          const updatedContactIds = contactIds.filter((id: string) => id !== contactId);
          
          updatePromises.push(
            groupDoc.ref.update({
              contactIds: updatedContactIds,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
          );
        }
      }
      
      await Promise.all(updatePromises);
      
      logger.info(`Successfully cleaned up ${updatePromises.length} groups for deleted contact ${contactId}`);
    } catch (error) {
      logger.error(`Error cleaning up groups for deleted contact ${contactId}:`, error);
      // Don't throw - deletion should succeed even if cleanup fails
    }
  }
);

/**
 * One-time cleanup function to remove stale contact IDs from all groups
 * This fixes groups that reference deleted contacts from before the onContactDeleted trigger was fixed
 * 
 * Usage: Call this function via Firebase console or HTTP request to clean up existing data
 * After running once, the fixed onContactDeleted trigger will keep data clean going forward
 */
export const cleanupStaleGroupMembers = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const userId = request.auth.uid;
    logger.info(`Starting stale group member cleanup for user ${userId}`);

    try {
      const db = admin.firestore();
      
      // Get all contacts for this user to build a set of valid IDs
      const contactsSnapshot = await db
        .collection('contacts')
        .where('userId', '==', userId)
        .get();
      
      const validContactIds = new Set(contactsSnapshot.docs.map(doc => doc.id));
      logger.info(`Found ${validContactIds.size} valid contacts for user ${userId}`);
      
      // Get all groups for this user
      const groupsSnapshot = await db
        .collection('groups')
        .where('userId', '==', userId)
        .get();
      
      logger.info(`Found ${groupsSnapshot.size} groups to check`);
      
      const updatePromises: Promise<any>[] = [];
      let groupsUpdated = 0;
      let contactsRemoved = 0;
      
      for (const groupDoc of groupsSnapshot.docs) {
        const group = groupDoc.data();
        const currentContactIds = group.contactIds || [];
        
        // Filter out any contact IDs that don't exist anymore
        const validGroupContactIds = currentContactIds.filter((id: string) => validContactIds.has(id));
        const removedCount = currentContactIds.length - validGroupContactIds.length;
        
        if (removedCount > 0) {
          logger.info(`Group "${group.name}" (${groupDoc.id}): Removing ${removedCount} stale contact(s), keeping ${validGroupContactIds.length}`);
          
          updatePromises.push(
            groupDoc.ref.update({
              contactIds: validGroupContactIds,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
          );
          
          groupsUpdated++;
          contactsRemoved += removedCount;
        }
      }
      
      await Promise.all(updatePromises);
      
      const result = {
        success: true,
        totalGroups: groupsSnapshot.size,
        groupsUpdated,
        staleContactsRemoved: contactsRemoved,
        validContactsInDB: validContactIds.size
      };
      
      logger.info(`Cleanup complete for user ${userId}:`, result);
      return result;
    } catch (error) {
      logger.error(`Error cleaning up stale group members for user ${userId}:`, error);
      throw new HttpsError("internal", "Failed to cleanup stale group members");
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

function extractMultiLineValue(response: string, prefix: string): string {
  const start = response.indexOf(prefix);
  if (start === -1) return "";

  // Find the next section header (word followed by colon at start of line) or end of text
  const afterPrefix = response.substring(start + prefix.length);
  const nextSectionMatch = afterPrefix.match(/\n[A-Z][a-zA-Z\s]+:/);
  
  if (nextSectionMatch && nextSectionMatch.index !== undefined) {
    return afterPrefix.substring(0, nextSectionMatch.index).trim();
  }

  return afterPrefix.trim();
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

      const {to, subject, text} = req.body;
      if (!to || !subject || !text) {
        res.status(400).json({ error: 'To, subject, and text are required' });
        return;
      }

      const senderEmail = decodedToken.email || decodedToken.uid;
      const senderName = decodedToken.name || senderEmail;
      
      // Enhanced message with sender information and branding
      const enhancedText = `${text}\n\n---\nSent by ${senderName}\n\nManage your contacts at https://contact-hub.net`;
      
      // Create transporter within function using secrets
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: EMAIL_USER.value(),
          pass: EMAIL_PASS.value(),
        },
      });
      
      await transporter.sendMail({
        from: `"${senderName} via ContactHub" <${EMAIL_USER.value()}>`,
        to,
        subject: subject,
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

      const {to, message, senderName} = req.body;
      if (!to || !message) {
        res.status(400).json({ error: 'To and message are required' });
        return;
      }

      const fromName = senderName || decodedToken.name || decodedToken.email || 'ContactHub';
      const enhancedMessage = `${message}\n\n- ${fromName}\n\nManage contacts: https://contact-hub.net`;

      const client = twilio(TWILIO_SID.value(), TWILIO_AUTH_TOKEN.value());
      
      await client.messages.create({
        body: enhancedMessage,
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

// Scheduled function to send due messages every hour
export const sendScheduledMessages = onSchedule('every 1 hours', async (event) => {
  logger.info('Running scheduled message check...');
  
  try {
    const db = admin.firestore();
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Get all groups for this user
      const groupsSnapshot = await db.collection('users').doc(userId).collection('groups').get();
      
      for (const groupDoc of groupsSnapshot.docs) {
        const group = groupDoc.data();
        const groupId = groupDoc.id;
        const schedules = group.schedules || [];
        
        for (const schedule of schedules) {
          if (!schedule.enabled || !schedule.message) continue;
          
          const shouldSend = shouldSendScheduledMessage(schedule, today, currentTime);
          
          if (shouldSend) {
            logger.info(`Sending scheduled message for group ${groupId}, schedule ${schedule.id}`);
            
            // Get contacts in the group
            const contactIds = group.contactIds || [];
            if (contactIds.length === 0) continue;
            
            // Get contact details
            const contactsPromises = contactIds.map(async (contactId: string) => {
              const contactDoc = await db.collection('users').doc(userId).collection('contacts').doc(contactId).get();
              return contactDoc.exists ? { id: contactDoc.id, ...contactDoc.data() } : null;
            });
            
            const contacts = (await Promise.all(contactsPromises)).filter(c => c !== null);
            
            // Log the message for each contact
            for (const contact of contacts) {
              try {
                await db.collection('users').doc(userId).collection('messages').add({
                  contactId: contact.id,
                  groupId: groupId,
                  scheduleId: schedule.id,
                  message: schedule.message,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  status: 'scheduled',
                  type: 'scheduled',
                });
                
                logger.info(`Logged scheduled message for contact ${contact.id}`);
              } catch (error) {
                logger.error(`Failed to log message for contact ${contact.id}:`, error);
              }
            }
            
            // Update schedule's last run time
            const updatedSchedules = schedules.map((s: any) => 
              s.id === schedule.id 
                ? { ...s, lastRun: today, lastRunTime: currentTime }
                : s
            );
            
            await db.collection('users').doc(userId).collection('groups').doc(groupId).update({
              schedules: updatedSchedules
            });
          }
        }
      }
    }
    
    logger.info('Scheduled message check completed');
  } catch (error) {
    logger.error('Error in sendScheduledMessages:', error);
  }
});

// Helper function to determine if a schedule should send now
function shouldSendScheduledMessage(schedule: any, today: string, currentTime: string): boolean {
  // Check if this is an exception date
  if (schedule.exceptions?.includes(today)) {
    return false;
  }
  
  // Check if schedule has already run today
  if (schedule.lastRun === today) {
    return false;
  }
  
  // Check if start time matches (within 1 hour window since we run hourly)
  const scheduleTime = schedule.startTime || '09:00';
  const scheduleHour = parseInt(scheduleTime.split(':')[0]);
  const currentHour = parseInt(currentTime.split(':')[0]);
  
  if (scheduleHour !== currentHour) {
    return false;
  }
  
  // One-time schedule
  if (schedule.type === 'one-time') {
    return schedule.startDate === today;
  }
  
  // Recurring schedule
  if (schedule.type === 'recurring') {
    const startDate = new Date(schedule.startDate);
    const todayDate = new Date(today);
    const endDate = schedule.endDate ? new Date(schedule.endDate) : null;
    
    // Check if today is within the schedule range
    if (todayDate < startDate) return false;
    if (endDate && todayDate > endDate) return false;
    
    const frequency = schedule.frequency;
    if (!frequency) return false;
    
    const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (frequency.type) {
      case 'daily':
        return daysSinceStart % frequency.interval === 0;
        
      case 'weekly':
        const dayOfWeek = todayDate.getDay();
        const weeksSinceStart = Math.floor(daysSinceStart / 7);
        return (weeksSinceStart % frequency.interval === 0) && 
               (frequency.daysOfWeek?.includes(dayOfWeek) ?? false);
        
      case 'monthly':
        const dayOfMonth = todayDate.getDate();
        const monthsSinceStart = (todayDate.getFullYear() - startDate.getFullYear()) * 12 + 
                                 (todayDate.getMonth() - startDate.getMonth());
        return (monthsSinceStart % frequency.interval === 0) && 
               (frequency.daysOfMonth?.includes(dayOfMonth) ?? false);
        
      case 'yearly':
        const monthOfYear = todayDate.getMonth();
        const yearsSinceStart = todayDate.getFullYear() - startDate.getFullYear();
        return (yearsSinceStart % frequency.interval === 0) && 
               (frequency.monthsOfYear?.includes(monthOfYear) ?? false);
        
      default:
        return false;
    }
  }
  
  return false;
}

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
    .filter(([_, groupContacts]) => groupContacts.length >= 2) // Minimum 2 per group
    .map(([category, groupContacts]) => {
      const categoryLower = category.toLowerCase();
      
      // Category-specific purposes
      const purposes: Record<string, string> = {
        'family': 'Family members for coordinating events, sharing updates, and maintaining close family bonds. Ideal for holiday planning, milestone celebrations, and regular family check-ins.',
        'friend': 'Personal friends for social coordination, event planning, and maintaining friendships. Perfect for group hangouts, catching up, and sharing life updates.',
        'professional': 'Professional contacts for industry updates, collaboration opportunities, and career networking. Suitable for sharing professional insights and maintaining business relationships.',
        'colleague': 'Work colleagues for project updates, team coordination, and professional communication. Best for work-related discussions and team collaboration.',
        'client': 'Client contacts for project updates, deliverables discussion, and relationship management. Enables professional communication while maintaining service quality.',
        'lead': 'Prospective leads for follow-ups, nurturing relationships, and conversion tracking. Facilitates consistent outreach and pipeline management.',
        'vendor': 'Service providers and vendors for coordination, orders, and business transactions. Streamlines vendor communication and relationship management.',
        'mentor': 'Mentors and advisors for guidance, career development, and strategic advice. Maintains valuable advisory relationships.',
        'community': 'Community members for event coordination, shared interests, and group activities. Enables community engagement and event planning.',
      };
      
      return {
        name: `${category} Network`,
        purpose: purposes[categoryLower] || `Contacts categorized as ${categoryLower} for organized communication and relationship management. Group messaging enables efficient updates while maintaining personal touch.`,
        contacts: groupContacts.map(c => c.name),
        contactIds: groupContacts.map(c => c.id),
        contactCount: groupContacts.length,
        rationale: `All contacts share the ${category} category, indicating similar relationship contexts and communication needs. Grouping enables efficient, relevant communication while respecting relationship boundaries.`
      };
    });

  return {
    suggestedGroups,
    insights: `Created ${suggestedGroups.length} category-based groups covering ${contacts.length} contacts. These groups are organized by relationship type to facilitate appropriate and efficient communication. Consider customizing group names and purposes based on your specific communication strategy and relationship goals.`
  };
}

function validateAndEnhanceGroupSuggestions(suggestions: any, contacts: any[]) {
  const contactNameMap = new Map(contacts.map(c => [c.name.toLowerCase().trim(), c]));
  const usedContactIds = new Set<string>();
  
  // Validate and enhance each suggested group
  const validatedGroups = (suggestions.suggestedGroups || []).map((group: any) => {
    // Validate contact assignments with fuzzy matching
    const validContacts: string[] = [];
    const contactIds: string[] = [];
    
    (group.contacts || []).forEach((contactName: string) => {
      const normalized = contactName.toLowerCase().trim();
      const contact = contactNameMap.get(normalized);
      
      if (contact && !usedContactIds.has(contact.id)) {
        validContacts.push(contact.name);
        contactIds.push(contact.id);
        usedContactIds.add(contact.id);
      } else if (!contact) {
        // Try partial matching for names that might be slightly different
        for (const [mapName, mapContact] of contactNameMap.entries()) {
          if (!usedContactIds.has(mapContact.id) && 
              (mapName.includes(normalized) || normalized.includes(mapName))) {
            validContacts.push(mapContact.name);
            contactIds.push(mapContact.id);
            usedContactIds.add(mapContact.id);
            break;
          }
        }
      }
    });

    // Enhance group with metadata
    return {
      name: (group.name || 'Unnamed Group').trim().slice(0, 50),
      purpose: (group.purpose || 'Group purpose not specified').trim(),
      rationale: (group.rationale || 'Grouped by relationship type').trim(),
      contacts: validContacts,
      contactIds,
      contactCount: validContacts.length
    };
  }).filter((group: any) => group.contacts.length >= 2); // Only keep groups with 2+ contacts

  // Add any unassigned contacts to a catch-all group
  const unassignedContacts = contacts.filter(c => !usedContactIds.has(c.id));
  if (unassignedContacts.length >= 2) {
    validatedGroups.push({
      name: "Additional Contacts",
      purpose: "Contacts that didn't fit into specific categories. Review these individually to determine the best grouping strategy, or create custom groups based on your unique communication needs.",
      contacts: unassignedContacts.map(c => c.name),
      contactIds: unassignedContacts.map(c => c.id),
      contactCount: unassignedContacts.length,
      rationale: "These contacts have diverse characteristics that don't cluster clearly into the main groups. Consider creating specialized groups or managing them individually based on your specific relationship context."
    });
  }

  return {
    suggestedGroups: validatedGroups,
    insights: suggestions.insights || `Analyzed ${contacts.length} contacts and created ${validatedGroups.length} strategic groups. Review these suggestions and customize based on your specific communication needs and relationship management strategy.`
  };
}

// Archive user data exports
export {archiveUserData, cleanupExpiredArchives} from './archive';
