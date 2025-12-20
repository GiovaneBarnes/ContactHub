// Google Contacts Integration
// Provides secure OAuth flow and contact import from Google Contacts API

import { getAuth } from 'firebase/auth';
import { Contact } from './types';

// Use Google Identity Services (GIS) for OAuth without affecting Firebase Auth
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

interface GoogleContact {
  resourceName: string;
  names?: Array<{
    displayName?: string;
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{
    value: string;
    type?: string;
  }>;
  phoneNumbers?: Array<{
    value: string;
    type?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  biographies?: Array<{
    value?: string;
  }>;
  userDefined?: Array<{
    key: string;
    value: string;
  }>;
}

interface GoogleContactsResponse {
  connections: GoogleContact[];
  nextPageToken?: string;
  totalItems: number;
}

export class GoogleContactsIntegration {
  private static readonly PEOPLE_API_BASE = 'https://people.googleapis.com/v1';
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/contacts.readonly',
  ];
  private static get CLIENT_ID(): string {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID;
  }

  /**
   * Load Google Identity Services library
   */
  private static loadGISLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  /**
   * Initiates OAuth flow and returns access token WITHOUT changing Firebase Auth session
   * @returns Access token for Google APIs
   */
  static async authenticate(): Promise<string> {
    console.log("[GoogleAuth] Starting authentication flow...");
    
    if (!GoogleContactsIntegration.CLIENT_ID) {
      throw new Error('Google Client ID is not configured');
    }

    // Load GIS library
    await GoogleContactsIntegration.loadGISLibrary();
    console.log("[GoogleAuth] GIS library loaded");

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: GoogleContactsIntegration.CLIENT_ID,
          scope: GoogleContactsIntegration.SCOPES.join(' '),
          callback: (response) => {
            if (response.error) {
              console.error("[GoogleAuth] Authentication error:", response.error);
              reject(new Error(response.error));
            } else {
              console.log("[GoogleAuth] Authentication successful!");
              resolve(response.access_token);
            }
          },
        });

        console.log("[GoogleAuth] Opening popup...");
        tokenClient.requestAccessToken();
      } catch (error: any) {
        console.error("[GoogleAuth] Authentication error:", error);
        reject(error);
      }
    });
  }

  /**
   * Fetches contacts from Google Contacts API
   * @param accessToken OAuth access token
   * @param pageSize Number of contacts per page (max 1000)
   * @returns Array of Google contacts
   */
  static async fetchContacts(
    accessToken: string,
    pageSize: number = 1000
  ): Promise<GoogleContact[]> {
    console.log(`[GoogleAPI] Fetching contacts (page size: ${pageSize})...`);
    const allContacts: GoogleContact[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[GoogleAPI] Fetching page ${pageCount}...`);
      
      const url = new URL(`${GoogleContactsIntegration.PEOPLE_API_BASE}/people/me/connections`);
      url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,organizations,biographies');
      url.searchParams.set('pageSize', pageSize.toString());
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[GoogleAPI] HTTP ${response.status}:`, response.statusText);
        const errorText = await response.text();
        console.error(`[GoogleAPI] Error response:`, errorText);
        
        if (response.status === 401) {
          throw new Error('Access token expired. Please sign in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please grant permission to read contacts.');
        }
        throw new Error(`Failed to fetch contacts: ${response.statusText}`);
      }

      const data: GoogleContactsResponse = await response.json();
      console.log(`[GoogleAPI] Page ${pageCount}: ${data.connections?.length || 0} contacts`);
      
      if (data.connections) {
        allContacts.push(...data.connections);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`[GoogleAPI] Fetched total of ${allContacts.length} contacts in ${pageCount} pages`);
    return allContacts;
  }

  /**
   * Transforms Google contacts to ContactHub format
   * @param googleContacts Raw Google contacts
   * @returns Array of ContactHub contacts
   */
  static transformContacts(googleContacts: GoogleContact[]): Omit<Contact, 'id'>[] {
    console.log(`[GoogleTransform] Transforming ${googleContacts.length} contacts...`);
    
    const transformed = googleContacts
      .map((contact, index) => {
        const name = contact.names?.[0]?.displayName || '';
        const email = contact.emailAddresses?.[0]?.value || '';
        const phone = contact.phoneNumbers?.[0]?.value || '';

        // Skip contacts without name (email is optional since we have phone)
        if (!name) {
          console.log(`[GoogleTransform] Skipping contact ${index}: missing name`);
          return null;
        }
        
        // Must have at least email or phone
        if (!email && !phone) {
          console.log(`[GoogleTransform] Skipping contact ${index} (${name}): missing both email and phone`);
          return null;
        }

        // Build rich notes from available data
        const noteParts: string[] = [];
        
        if (contact.organizations?.[0]) {
          const org = contact.organizations[0];
          if (org.name && org.title) {
            noteParts.push(`${org.title} at ${org.name}`);
          } else if (org.name) {
            noteParts.push(`Works at ${org.name}`);
          } else if (org.title) {
            noteParts.push(org.title);
          }
        }

        if (contact.biographies?.[0]?.value) {
          noteParts.push(contact.biographies[0].value);
        }

        // Add additional phone numbers
        if (contact.phoneNumbers && contact.phoneNumbers.length > 1) {
          const additionalPhones = contact.phoneNumbers
            .slice(1)
            .map(p => `${p.type || 'Phone'}: ${p.value}`)
            .join(', ');
          noteParts.push(additionalPhones);
        }

        // Add additional emails
        if (contact.emailAddresses && contact.emailAddresses.length > 1) {
          const additionalEmails = contact.emailAddresses
            .slice(1)
            .map(e => `${e.type || 'Email'}: ${e.value}`)
            .join(', ');
          noteParts.push(additionalEmails);
        }

        const notes = noteParts.length > 0 
          ? `[Google Contacts] ${noteParts.join(' • ')}`
          : '[Google Contacts]';

        // Infer relationship from organization
        let relationship: string | undefined = undefined;
        if (contact.organizations?.[0]?.name) {
          relationship = 'Professional';
        }

        // Build tags
        const tags: string[] = ['Google'];
        if (contact.organizations?.[0]?.name) {
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
    
    console.log(`[GoogleTransform] Transformed ${transformed.length} valid contacts (skipped ${googleContacts.length - transformed.length})`);
    return transformed;
  }

  /**
   * Full flow: Authenticate and import contacts
   * @returns Array of ContactHub-formatted contacts ready to import
   */
  static async importContacts(): Promise<Omit<Contact, 'id'>[]> {
    // Step 1: Authenticate and get access token
    const accessToken = await GoogleContactsIntegration.authenticate();

    // Step 2: Fetch all contacts from Google
    const googleContacts = await GoogleContactsIntegration.fetchContacts(accessToken);

    // Step 3: Transform to ContactHub format
    const contacts = GoogleContactsIntegration.transformContacts(googleContacts);

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
    const accessToken = await GoogleContactsIntegration.authenticate();
    const googleContacts = await GoogleContactsIntegration.fetchContacts(accessToken, 10);
    const allContacts = GoogleContactsIntegration.transformContacts(googleContacts);

    return {
      preview: allContacts.slice(0, 10),
      totalCount: googleContacts.length,
    };
  }
}

/**
 * Helper function to check if Google auth is available
 */
export const isGoogleAuthAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'GoogleAuthProvider' in window;
};

/**
 * Helper to format Google contact count for display
 */
export const formatContactCount = (count: number): string => {
  if (count === 0) return 'No contacts';
  if (count === 1) return '1 contact';
  if (count < 100) return `${count} contacts`;
  if (count < 1000) return `${Math.floor(count / 10) * 10}+ contacts`;
  return `${Math.floor(count / 100) * 100}+ contacts`;
};
