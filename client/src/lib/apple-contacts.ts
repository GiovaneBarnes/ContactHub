// Apple Contacts Integration
// Provides secure OAuth flow and contact import from iCloud Contacts

import { Contact } from './types';

// CloudKit types for Apple iCloud Contacts
interface AppleContact {
  recordName: string;
  fields: {
    firstName?: { value: string };
    lastName?: { value: string };
    emailAddresses?: { value: Array<{ field: string; label: string }> };
    phoneNumbers?: { value: Array<{ field: string; label: string }> };
    organizationName?: { value: string };
    departmentName?: { value: string };
    jobTitle?: { value: string };
    note?: { value: string };
    birthday?: { value: string };
  };
}

interface AppleContactsResponse {
  records: AppleContact[];
  continuationMarker?: string;
}

// CloudKit JS types
declare global {
  interface Window {
    CloudKit?: {
      configure: (config: any) => void;
      getDefaultContainer: () => {
        setUpAuth: () => Promise<any>;
        whenUserSignsIn: () => Promise<{ userIdentity: any }>;
        publicCloudDatabase: {
          performQuery: (query: any) => Promise<AppleContactsResponse>;
        };
        privateCloudDatabase: {
          performQuery: (query: any) => Promise<AppleContactsResponse>;
        };
      };
    };
  }
}

export class AppleContactsIntegration {
  private static readonly CONTAINER_ID = 'com.apple.contacts'; // iCloud Contacts container
  private static readonly API_TOKEN = import.meta.env.VITE_APPLE_API_TOKEN;
  private static readonly ENVIRONMENT = 'production';

  /**
   * Load CloudKit JS library
   */
  private static loadCloudKitLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.CloudKit) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load CloudKit library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Initiates OAuth flow and returns authenticated container
   * @returns CloudKit container
   */
  static async authenticate(): Promise<any> {
    console.log("[AppleAuth] Starting authentication flow...");
    
    if (!AppleContactsIntegration.API_TOKEN) {
      throw new Error('Apple API Token is not configured. Please set up CloudKit in Apple Developer Portal.');
    }

    // Load CloudKit library
    await AppleContactsIntegration.loadCloudKitLibrary();
    console.log("[AppleAuth] CloudKit library loaded");

    try {
      // Configure CloudKit
      window.CloudKit!.configure({
        containers: [{
          containerIdentifier: AppleContactsIntegration.CONTAINER_ID,
          apiTokenAuth: {
            apiToken: AppleContactsIntegration.API_TOKEN,
            persist: false,
          },
          environment: AppleContactsIntegration.ENVIRONMENT,
        }],
      });

      const container = window.CloudKit!.getDefaultContainer();
      
      console.log("[AppleAuth] Setting up authentication...");
      await container.setUpAuth();

      console.log("[AppleAuth] Waiting for user sign-in...");
      const userIdentity = await container.whenUserSignsIn();
      
      console.log("[AppleAuth] Authentication successful!");
      console.log("[AppleAuth] User:", userIdentity.userIdentity);
      
      return container;
    } catch (error: any) {
      console.error("[AppleAuth] Authentication error:", error);
      console.error("[AppleAuth] Error code:", error.ckErrorCode);
      console.error("[AppleAuth] Error message:", error.message);
      
      if (error.ckErrorCode === 'AUTH_PERSIST_ERROR') {
        throw new Error('Failed to authenticate. Please try again.');
      } else if (error.ckErrorCode === 'NOT_AUTHENTICATED') {
        throw new Error('Sign-in cancelled. Please try again.');
      }
      throw new Error('Failed to authenticate with Apple. Please try again.');
    }
  }

  /**
   * Fetches contacts from iCloud using CloudKit
   * @param container Authenticated CloudKit container
   * @returns Array of Apple contacts
   */
  static async fetchContacts(container: any): Promise<AppleContact[]> {
    console.log(`[AppleAPI] Fetching contacts from iCloud...`);
    const allContacts: AppleContact[] = [];
    
    try {
      // Note: iCloud Contacts uses the Contacts app's private database
      const database = container.privateCloudDatabase;
      
      // Query for all contact records
      // Note: Actual query structure depends on iCloud schema
      const query = {
        recordType: 'Contact',
        sortBy: [{ fieldName: 'lastName', ascending: true }],
      };

      let continuationMarker: string | undefined = undefined;
      let pageCount = 0;

      do {
        pageCount++;
        console.log(`[AppleAPI] Fetching page ${pageCount}...`);
        
        const queryOptions = continuationMarker 
          ? { ...query, continuationMarker }
          : query;

        const response: AppleContactsResponse = await database.performQuery(queryOptions);
        console.log(`[AppleAPI] Page ${pageCount}: ${response.records?.length || 0} contacts`);
        
        if (response.records) {
          allContacts.push(...response.records);
        }

        continuationMarker = response.continuationMarker;
      } while (continuationMarker);

      console.log(`[AppleAPI] Fetched total of ${allContacts.length} contacts in ${pageCount} pages`);
      return allContacts;
    } catch (error: any) {
      console.error(`[AppleAPI] Error fetching contacts:`, error);
      console.error(`[AppleAPI] Error code:`, error.ckErrorCode);
      
      if (error.ckErrorCode === 'ACCESS_DENIED') {
        throw new Error('Access denied. Please grant permission to read contacts.');
      } else if (error.ckErrorCode === 'NETWORK_FAILURE') {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw new Error('Failed to fetch contacts from iCloud. Please try again.');
    }
  }

  /**
   * Transforms Apple contacts to ContactHub format
   * @param appleContacts Raw Apple contacts
   * @returns Array of ContactHub contacts
   */
  static transformContacts(appleContacts: AppleContact[]): Omit<Contact, 'id'>[] {
    console.log(`[AppleTransform] Transforming ${appleContacts.length} contacts...`);
    
    const transformed = appleContacts
      .map((contact, index) => {
        const firstName = contact.fields.firstName?.value || '';
        const lastName = contact.fields.lastName?.value || '';
        const name = `${firstName} ${lastName}`.trim();
        
        const email = contact.fields.emailAddresses?.value?.[0]?.field || '';
        const phone = contact.fields.phoneNumbers?.value?.[0]?.field || '';

        // Skip contacts without name
        if (!name) {
          console.log(`[AppleTransform] Skipping contact ${index}: missing name`);
          return null;
        }
        
        // Must have at least email or phone
        if (!email && !phone) {
          console.log(`[AppleTransform] Skipping contact ${index} (${name}): missing both email and phone`);
          return null;
        }

        // Build rich notes from available data
        const noteParts: string[] = [];
        
        const company = contact.fields.organizationName?.value;
        const department = contact.fields.departmentName?.value;
        const jobTitle = contact.fields.jobTitle?.value;
        
        if (jobTitle && company) {
          noteParts.push(`${jobTitle} at ${company}`);
        } else if (company) {
          noteParts.push(`Works at ${company}`);
        } else if (jobTitle) {
          noteParts.push(jobTitle);
        }

        if (department) {
          noteParts.push(`Department: ${department}`);
        }

        if (contact.fields.note?.value) {
          noteParts.push(contact.fields.note.value);
        }

        if (contact.fields.birthday?.value) {
          noteParts.push(`Birthday: ${new Date(contact.fields.birthday.value).toLocaleDateString()}`);
        }

        // Add additional phone numbers
        if (contact.fields.phoneNumbers?.value && contact.fields.phoneNumbers.value.length > 1) {
          const additionalPhones = contact.fields.phoneNumbers.value
            .slice(1)
            .map(p => `${p.label || 'Phone'}: ${p.field}`)
            .join(', ');
          noteParts.push(additionalPhones);
        }

        // Add additional emails
        if (contact.fields.emailAddresses?.value && contact.fields.emailAddresses.value.length > 1) {
          const additionalEmails = contact.fields.emailAddresses.value
            .slice(1)
            .map(e => `${e.label || 'Email'}: ${e.field}`)
            .join(', ');
          noteParts.push(additionalEmails);
        }

        const notes = noteParts.length > 0 
          ? `[Apple Contacts] ${noteParts.join(' • ')}`
          : '[Apple Contacts]';

        // Infer relationship from job/company
        let relationship: string | undefined = undefined;
        if (company || jobTitle) {
          relationship = 'Professional';
        }

        // Build tags
        const tags: string[] = ['Apple', 'iCloud'];
        if (company || jobTitle) {
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
    
    console.log(`[AppleTransform] Transformed ${transformed.length} valid contacts (skipped ${appleContacts.length - transformed.length})`);
    return transformed;
  }

  /**
   * Full flow: Authenticate and import contacts
   * @returns Array of ContactHub-formatted contacts ready to import
   */
  static async importContacts(): Promise<Omit<Contact, 'id'>[]> {
    // Step 1: Authenticate and get container
    const container = await AppleContactsIntegration.authenticate();

    // Step 2: Fetch all contacts from iCloud
    const appleContacts = await AppleContactsIntegration.fetchContacts(container);

    // Step 3: Transform to ContactHub format
    const contacts = AppleContactsIntegration.transformContacts(appleContacts);

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
    const container = await AppleContactsIntegration.authenticate();
    const appleContacts = await AppleContactsIntegration.fetchContacts(container);
    const allContacts = AppleContactsIntegration.transformContacts(appleContacts);

    return {
      preview: allContacts.slice(0, 10),
      totalCount: allContacts.length,
    };
  }
}

/**
 * Helper to format Apple contact count for display
 */
export const formatAppleContactCount = (count: number): string => {
  if (count === 0) return 'No contacts';
  if (count === 1) return '1 contact';
  if (count < 100) return `${count} contacts`;
  if (count < 1000) return `${Math.floor(count / 10) * 10}+ contacts`;
  return `${Math.floor(count / 100) * 100}+ contacts`;
};
