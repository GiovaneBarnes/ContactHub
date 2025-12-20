// Microsoft Contacts Integration
// Provides secure OAuth flow and contact import from Microsoft Graph API

import { Contact } from './types';

// Microsoft Graph API types
interface MicrosoftContact {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  emailAddresses?: Array<{
    address: string;
    name?: string;
  }>;
  mobilePhone?: string;
  businessPhones?: string[];
  homePhones?: string[];
  companyName?: string;
  jobTitle?: string;
  personalNotes?: string;
  birthday?: string;
}

interface MicrosoftContactsResponse {
  value: MicrosoftContact[];
  '@odata.nextLink'?: string;
}

// Microsoft Identity Platform (MSAL) types
declare global {
  interface Window {
    msal?: {
      PublicClientApplication: new (config: any) => {
        loginPopup: (request: any) => Promise<{ accessToken: string; account: any }>;
        acquireTokenSilent: (request: any) => Promise<{ accessToken: string }>;
      };
    };
  }
}

export class MicrosoftContactsIntegration {
  private static readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  private static readonly SCOPES = ['Contacts.Read', 'User.Read'];
  private static readonly CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  private static readonly AUTHORITY = 'https://login.microsoftonline.com/common';

  /**
   * Load Microsoft Authentication Library (MSAL)
   */
  private static loadMSALLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.msal) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://alcdn.msauth.net/browser/2.38.1/js/msal-browser.min.js';
      script.integrity = 'sha384-2rW8rVnZf3M9XAV0z+rBpMH5q+jqL1T5lbLd+PmQ5kl5qBk5lGx1K2vOGqHxGrJ5';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Microsoft Authentication Library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Initiates OAuth flow and returns access token WITHOUT changing Firebase Auth session
   * @returns Access token for Microsoft Graph API
   */
  static async authenticate(): Promise<string> {
    console.log("[MicrosoftAuth] Starting authentication flow...");
    
    if (!MicrosoftContactsIntegration.CLIENT_ID) {
      throw new Error('Microsoft Client ID is not configured');
    }

    // Load MSAL library
    await MicrosoftContactsIntegration.loadMSALLibrary();
    console.log("[MicrosoftAuth] MSAL library loaded");

    try {
      const msalConfig = {
        auth: {
          clientId: MicrosoftContactsIntegration.CLIENT_ID,
          authority: MicrosoftContactsIntegration.AUTHORITY,
          redirectUri: window.location.origin,
        },
        cache: {
          cacheLocation: 'sessionStorage',
          storeAuthStateInCookie: false,
        },
      };

      const msalInstance = new window.msal!.PublicClientApplication(msalConfig);

      const loginRequest = {
        scopes: MicrosoftContactsIntegration.SCOPES,
        prompt: 'select_account',
      };

      console.log("[MicrosoftAuth] Opening popup...");
      const response = await msalInstance.loginPopup(loginRequest);
      
      console.log("[MicrosoftAuth] Authentication successful!");
      console.log("[MicrosoftAuth] User:", response.account.username);
      
      return response.accessToken;
    } catch (error: any) {
      console.error("[MicrosoftAuth] Authentication error:", error);
      console.error("[MicrosoftAuth] Error code:", error.errorCode);
      console.error("[MicrosoftAuth] Error message:", error.errorMessage);
      
      if (error.errorCode === 'user_cancelled') {
        throw new Error('Sign-in cancelled. Please try again.');
      } else if (error.errorCode === 'popup_window_error') {
        throw new Error('Popup was blocked. Please allow popups for this site.');
      }
      throw error;
    }
  }

  /**
   * Fetches contacts from Microsoft Graph API
   * @param accessToken OAuth access token
   * @returns Array of Microsoft contacts
   */
  static async fetchContacts(accessToken: string): Promise<MicrosoftContact[]> {
    console.log(`[MicrosoftAPI] Fetching contacts...`);
    const allContacts: MicrosoftContact[] = [];
    let nextLink: string | undefined = `${MicrosoftContactsIntegration.GRAPH_API_BASE}/me/contacts?$top=100`;

    while (nextLink) {
      console.log(`[MicrosoftAPI] Fetching page: ${allContacts.length} contacts so far...`);
      
      const response = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[MicrosoftAPI] HTTP ${response.status}:`, response.statusText);
        const errorText = await response.text();
        console.error(`[MicrosoftAPI] Error response:`, errorText);
        
        if (response.status === 401) {
          throw new Error('Access token expired. Please sign in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please grant permission to read contacts.');
        }
        throw new Error(`Failed to fetch contacts: ${response.statusText}`);
      }

      const data: MicrosoftContactsResponse = await response.json();
      console.log(`[MicrosoftAPI] Fetched ${data.value.length} contacts in this page`);
      
      allContacts.push(...data.value);
      nextLink = data['@odata.nextLink'];
    }

    console.log(`[MicrosoftAPI] Fetched total of ${allContacts.length} contacts`);
    return allContacts;
  }

  /**
   * Transforms Microsoft contacts to ContactHub format
   * @param microsoftContacts Raw Microsoft contacts
   * @returns Array of ContactHub contacts
   */
  static transformContacts(microsoftContacts: MicrosoftContact[]): Omit<Contact, 'id'>[] {
    console.log(`[MicrosoftTransform] Transforming ${microsoftContacts.length} contacts...`);
    
    const transformed = microsoftContacts
      .map((contact, index) => {
        const name = contact.displayName || '';
        const email = contact.emailAddresses?.[0]?.address || '';
        
        // Get phone number (mobile first, then business, then home)
        const phone = contact.mobilePhone 
          || contact.businessPhones?.[0] 
          || contact.homePhones?.[0] 
          || '';

        // Skip contacts without name
        if (!name) {
          console.log(`[MicrosoftTransform] Skipping contact ${index}: missing name`);
          return null;
        }
        
        // Must have at least email or phone
        if (!email && !phone) {
          console.log(`[MicrosoftTransform] Skipping contact ${index} (${name}): missing both email and phone`);
          return null;
        }

        // Build rich notes from available data
        const noteParts: string[] = [];
        
        if (contact.jobTitle && contact.companyName) {
          noteParts.push(`${contact.jobTitle} at ${contact.companyName}`);
        } else if (contact.companyName) {
          noteParts.push(`Works at ${contact.companyName}`);
        } else if (contact.jobTitle) {
          noteParts.push(contact.jobTitle);
        }

        if (contact.personalNotes) {
          noteParts.push(contact.personalNotes);
        }

        if (contact.birthday) {
          noteParts.push(`Birthday: ${new Date(contact.birthday).toLocaleDateString()}`);
        }

        // Add additional phone numbers
        const additionalPhones: string[] = [];
        if (contact.businessPhones && contact.businessPhones.length > 1) {
          additionalPhones.push(...contact.businessPhones.slice(1).map(p => `Business: ${p}`));
        }
        if (contact.homePhones && contact.homePhones.length > 0 && contact.homePhones[0] !== phone) {
          additionalPhones.push(...contact.homePhones.map(p => `Home: ${p}`));
        }
        if (additionalPhones.length > 0) {
          noteParts.push(additionalPhones.join(', '));
        }

        // Add additional emails
        if (contact.emailAddresses && contact.emailAddresses.length > 1) {
          const additionalEmails = contact.emailAddresses
            .slice(1)
            .map(e => `${e.name || 'Email'}: ${e.address}`)
            .join(', ');
          noteParts.push(additionalEmails);
        }

        const notes = noteParts.length > 0 
          ? `[Outlook] ${noteParts.join(' • ')}`
          : '[Outlook]';

        // Infer relationship from job/company
        let relationship: string | undefined = undefined;
        if (contact.companyName || contact.jobTitle) {
          relationship = 'Professional';
        }

        // Build tags
        const tags: string[] = ['Outlook'];
        if (contact.companyName || contact.jobTitle) {
          tags.push('Work');
        }

        return {
          name,
          email,
          phone,
          notes,
          ...(relationship && { relationship }),
          ...(tags.length > 0 && { tags }),
        } as Omit<Contact, 'id'>;
      })
      .filter((contact): contact is Omit<Contact, 'id'> => contact !== null);
    
    console.log(`[MicrosoftTransform] Transformed ${transformed.length} valid contacts (skipped ${microsoftContacts.length - transformed.length})`);
    return transformed;
  }

  /**
   * Full flow: Authenticate and import contacts
   * @returns Array of ContactHub-formatted contacts ready to import
   */
  static async importContacts(): Promise<Omit<Contact, 'id'>[]> {
    // Step 1: Authenticate and get access token
    const accessToken = await MicrosoftContactsIntegration.authenticate();

    // Step 2: Fetch all contacts from Microsoft Graph
    const microsoftContacts = await MicrosoftContactsIntegration.fetchContacts(accessToken);

    // Step 3: Transform to ContactHub format
    const contacts = MicrosoftContactsIntegration.transformContacts(microsoftContacts);

    return contacts;
  }

  /**
   * Get a preview of contacts without full import (first 10)
   * @returns Preview of contacts
   */
  static async previewContacts(): Promise<{
    preview: Omit<Contact, 'id'>[];
    totalCount: number;
  }> {
    const accessToken = await MicrosoftContactsIntegration.authenticate();
    const microsoftContacts = await MicrosoftContactsIntegration.fetchContacts(accessToken);
    const allContacts = MicrosoftContactsIntegration.transformContacts(microsoftContacts);

    return {
      preview: allContacts.slice(0, 10),
      totalCount: allContacts.length,
    };
  }
}

/**
 * Helper to format Microsoft contact count for display
 */
export const formatMicrosoftContactCount = (count: number): string => {
  if (count === 0) return 'No contacts';
  if (count === 1) return '1 contact';
  if (count < 100) return `${count} contacts`;
  if (count < 1000) return `${Math.floor(count / 10) * 10}+ contacts`;
  return `${Math.floor(count / 100) * 100}+ contacts`;
};
