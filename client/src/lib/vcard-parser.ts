// vCard Parser
// Parses vCard (.vcf) files exported from iPhone, Mac, Google, Outlook, etc.

import { Contact } from './types';

interface VCardProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/**
 * Parse a vCard file and extract contacts
 * Supports vCard 2.1, 3.0, and 4.0 formats
 */
export class VCardParser {
  /**
   * Parse vCard content from file
   */
  static async parseFile(file: File): Promise<Omit<Contact, 'id'>[]> {
    console.log(`[VCardParser] Parsing file: ${file.name}`);
    
    const text = await file.text();
    return VCardParser.parseText(text);
  }

  /**
   * Parse vCard text content
   */
  static parseText(text: string): Omit<Contact, 'id'>[] {
    // Split into individual vCards
    const vCards = text.split(/BEGIN:VCARD/i).slice(1); // Skip first empty split
    
    console.log(`[VCardParser] Found ${vCards.length} vCards`);
    
    const contacts = vCards
      .map((vCardText, index) => {
        try {
          // Add back the BEGIN:VCARD that was removed by split
          const fullVCard = 'BEGIN:VCARD' + vCardText;
          return VCardParser.parseVCard(fullVCard, index);
        } catch (error) {
          console.error(`[VCardParser] Error parsing vCard ${index}:`, error);
          return null;
        }
      })
      .filter((contact): contact is Omit<Contact, 'id'> => contact !== null);
    
    console.log(`[VCardParser] Successfully parsed ${contacts.length} contacts`);
    return contacts;
  }

  /**
   * Parse a single vCard
   */
  private static parseVCard(vCardText: string, index: number): Omit<Contact, 'id'> | null {
    const lines = VCardParser.unfoldLines(vCardText);
    const properties = VCardParser.parseProperties(lines);
    
    // Extract name
    let name = '';
    const fnProp = properties.find(p => p.name === 'FN');
    if (fnProp) {
      name = fnProp.value;
    } else {
      // Fallback to N (structured name)
      const nProp = properties.find(p => p.name === 'N');
      if (nProp) {
        const parts = nProp.value.split(';');
        // N format: Family;Given;Additional;Prefix;Suffix
        const lastName = parts[0] || '';
        const firstName = parts[1] || '';
        name = `${firstName} ${lastName}`.trim();
      }
    }

    if (!name) {
      console.log(`[VCardParser] Skipping vCard ${index}: missing name`);
      return null;
    }

    // Extract email
    const emailProps = properties.filter(p => p.name === 'EMAIL');
    const email = emailProps[0]?.value || '';

    // Extract phone
    const telProps = properties.filter(p => p.name === 'TEL');
    const phone = telProps[0]?.value || '';

    // Must have at least email or phone
    if (!email && !phone) {
      console.log(`[VCardParser] Skipping vCard ${index} (${name}): missing both email and phone`);
      return null;
    }

    // Build rich notes
    const noteParts: string[] = [];

    // Organization and title
    const orgProp = properties.find(p => p.name === 'ORG');
    const titleProp = properties.find(p => p.name === 'TITLE');
    
    if (titleProp && orgProp) {
      noteParts.push(`${titleProp.value} at ${orgProp.value.split(';')[0]}`);
    } else if (orgProp) {
      noteParts.push(`Works at ${orgProp.value.split(';')[0]}`);
    } else if (titleProp) {
      noteParts.push(titleProp.value);
    }

    // Note field
    const noteProp = properties.find(p => p.name === 'NOTE');
    if (noteProp) {
      noteParts.push(noteProp.value);
    }

    // Birthday
    const bdayProp = properties.find(p => p.name === 'BDAY');
    if (bdayProp) {
      try {
        // Parse date string manually to avoid timezone issues
        const dateMatch = bdayProp.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          noteParts.push(`Birthday: ${month}/${day}/${year}`);
        } else {
          // Fallback to Date parsing for other formats
          const date = new Date(bdayProp.value);
          if (!isNaN(date.getTime())) {
            const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const day = date.getUTCDate().toString().padStart(2, '0');
            const year = date.getUTCFullYear();
            noteParts.push(`Birthday: ${month}/${day}/${year}`);
          }
        }
      } catch (e) {
        // Invalid date, skip
      }
    }

    // Additional emails
    if (emailProps.length > 1) {
      const additionalEmails = emailProps
        .slice(1)
        .map(e => {
          const type = e.params.TYPE || 'Email';
          return `${type}: ${e.value}`;
        })
        .join(', ');
      noteParts.push(additionalEmails);
    }

    // Additional phones
    if (telProps.length > 1) {
      const additionalPhones = telProps
        .slice(1)
        .map(t => {
          const type = t.params.TYPE || 'Phone';
          return `${type}: ${t.value}`;
        })
        .join(', ');
      noteParts.push(additionalPhones);
    }

    const notes = noteParts.length > 0 
      ? `[vCard Import] ${noteParts.join(' • ')}`
      : '[vCard Import]';

    // Infer relationship
    let relationship: string | undefined = undefined;
    if (orgProp || titleProp) {
      relationship = 'Professional';
    }

    // Build tags
    const tags: string[] = ['vCard'];
    if (orgProp || titleProp) {
      tags.push('Work');
    }

    return {
      name,
      email,
      phone,
      notes,
      ...(relationship && { relationship }),
      ...(tags.length > 0 && { tags }),
    };
  }

  /**
   * Unfold lines (vCard uses line folding with CRLF + space/tab)
   */
  private static unfoldLines(text: string): string[] {
    // Replace CRLF+space or CRLF+tab with nothing (unfold)
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    
    // Split into lines
    return unfolded.split(/\r?\n/).filter(line => line.trim());
  }

  /**
   * Parse vCard properties
   */
  private static parseProperties(lines: string[]): VCardProperty[] {
    const properties: VCardProperty[] = [];

    for (const line of lines) {
      // Skip BEGIN and END
      if (line.startsWith('BEGIN:') || line.startsWith('END:')) {
        continue;
      }

      // Parse property: NAME;PARAM=value:VALUE
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const propPart = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);

      // Parse name and parameters
      const parts = propPart.split(';');
      const name = parts[0].toUpperCase();
      const params: Record<string, string> = {};

      for (let i = 1; i < parts.length; i++) {
        const param = parts[i];
        const eqIndex = param.indexOf('=');
        if (eqIndex !== -1) {
          const key = param.substring(0, eqIndex).toUpperCase();
          const val = param.substring(eqIndex + 1).replace(/^"(.*)"$/, '$1');
          params[key] = val;
        } else {
          // Some vCards use TYPE without = (e.g., TYPE;HOME)
          params['TYPE'] = param.toUpperCase();
        }
      }

      properties.push({
        name,
        params,
        value: VCardParser.decodeValue(value),
      });
    }

    return properties;
  }

  /**
   * Decode vCard value (handle escaping)
   */
  private static decodeValue(value: string): string {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }
}

/**
 * Detect if a file is a vCard file
 */
export function isVCardFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.vcf') || 
         file.type === 'text/vcard' || 
         file.type === 'text/x-vcard';
}
