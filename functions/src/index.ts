import {setGlobalOptions} from "firebase-functions";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {params} from "firebase-functions";
import * as logger from "firebase-functions/logger";
import {Genkit} from "genkit";
import {googleAI} from "@genkit-ai/googleai";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import twilio from "twilio";

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Genkit with Google AI (Gemini)
const ai = new Genkit({
  plugins: [googleAI()],
});

// Helper function to interpolate variables into template
function interpolateTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

// AI Prompts for ContactHub
const messageGenerationTemplate = `You are an expert communication assistant helping users craft personalized messages for their contacts.

Given the following information about a contact group:
Group Name: {{groupName}}
Background Info: {{backgroundInfo}}
Contact Count: {{contactCount}}
Last Contact Date: {{lastContactDate}}

Generate a personalized, professional message that:
1. Acknowledges the relationship/group context
2. Includes relevant background information naturally
3. Is appropriate for the group's purpose
4. Encourages engagement or response
5. Is concise but meaningful (50-100 words)

Message:`;

const contactCategorizationTemplate = `You are an AI assistant that categorizes contacts based on their information and communication patterns.

Contact Details:
Name: {{name}}
Email: {{email}}
Phone: {{phone}}
Notes: {{notes}}
Tags: {{tags}}

Based on this information, suggest appropriate categories and tags for this contact. Consider:
- Professional relationships (work, business, colleagues)
- Personal relationships (family, friends, acquaintances)
- Service providers (doctors, lawyers, contractors)
- Organizations (companies, clubs, groups)
- Geographic location if relevant
- Communication frequency preferences

Provide 2-4 relevant categories and 3-6 descriptive tags.

Categories: [list]
Tags: [list]
Reasoning: [brief explanation]`;

// Set global options for all functions
setGlobalOptions({maxInstances: 10});

// Cloud Functions
export const generateGroupMessage = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
    enforceAppCheck: true, // Enable Firebase App Check
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
        groupName: group.name,
        backgroundInfo: group.backgroundInfo || "General group communication",
        contactCount: contactCount.toString(),
        lastContactDate,
      });
      const result = await ai.generate(prompt);

      logger.info(`Generated AI message for group ${groupId} by user ${userId}`);

      return {
        message: result.text,
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

      // Get contact data
      const contactDoc = await admin.firestore()
        .doc(`contacts/${contactId}`)
        .get();

      if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Contact not found");
      }

      const contact = contactDoc.data()!;

      // Generate categorization
      const prompt = interpolateTemplate(contactCategorizationTemplate, {
        name: contact.name,
        email: contact.email || "Not provided",
        phone: contact.phone || "Not provided",
        notes: contact.notes || "No notes available",
        tags: contact.tags?.join(", ") || "None",
      });
      const result = await ai.generate(prompt);

      const response = result.text;

      // Parse the structured response
      const categories = extractListFromResponse(response, "Categories:");
      const tags = extractListFromResponse(response, "Tags:");
      const reasoning = extractReasoningFromResponse(response);

      logger.info(`Categorized contact ${contactId} for user ${userId}`);

      return {
        categories,
        tags,
        reasoning,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      logger.error("Error categorizing contact:", error);
      throw new HttpsError("internal", "Failed to categorize contact");
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
      const prompt = interpolateTemplate(contactCategorizationTemplate, {
        name: contactData.name,
        email: contactData.email || "Not provided",
        phone: contactData.phone || "Not provided",
        notes: contactData.notes || "No notes available",
        tags: contactData.tags?.join(", ") || "None",
      });
      const result = await ai.generate(prompt);

      const response = result.text;
      const categories = extractListFromResponse(response, "Categories:");
      const tags = extractListFromResponse(response, "Tags:");

      // Update contact with AI-generated categories and tags
      await admin.firestore()
        .doc(`contacts/${contactId}`)
        .update({
          aiCategories: categories,
          aiTags: tags,
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
    cors: true, // Allow all origins
    secrets: [EMAIL_USER, EMAIL_PASS],
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
    cors: true, // Allow all origins
    secrets: [TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER],
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
