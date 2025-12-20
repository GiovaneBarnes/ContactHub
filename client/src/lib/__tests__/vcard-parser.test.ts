import { describe, it, expect, vi } from 'vitest'
import { VCardParser, isVCardFile } from '@/lib/vcard-parser'

describe('VCardParser', () => {
  describe('parseFile', () => {
    it('should parse vCard file successfully', async () => {
      const vCardContent = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
TEL:+1234567890
END:VCARD`

      const mockFile = new File([vCardContent], 'contacts.vcf', { type: 'text/vcard' })
      mockFile.text = vi.fn().mockResolvedValue(vCardContent)

      const result = await VCardParser.parseFile(mockFile as any)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        notes: '[vCard Import]',
        tags: ['vCard']
      })
    })

    it('should handle multiple vCards in one file', async () => {
      const vCardContent = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Jane Smith
TEL:+0987654321
END:VCARD`

      const mockFile = new File([vCardContent], 'contacts.vcf', { type: 'text/vcard' })
      mockFile.text = vi.fn().mockResolvedValue(vCardContent)

      const result = await VCardParser.parseFile(mockFile as any)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('John Doe')
      expect(result[1].name).toBe('Jane Smith')
    })
  })

  describe('parseText', () => {
    it('should parse vCard 3.0 format', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
TEL:+1234567890
ORG:Acme Corp;Engineering
TITLE:Software Engineer
NOTE:Great developer
BDAY:1990-01-01
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        notes: '[vCard Import] Software Engineer at Acme Corp • Great developer • Birthday: 01/01/1990',
        relationship: 'Professional',
        tags: ['vCard', 'Work']
      })
    })

    it('should parse vCard 4.0 format', () => {
      const vCardText = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
EMAIL:john@example.com
TEL:+1234567890
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John Doe')
    })

    it('should handle structured name (N property) when FN is missing', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
N:Doe;John;;;
EMAIL:john@example.com
TEL:+1234567890
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John Doe')
    })

    it('should skip contacts without name', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
EMAIL:john@example.com
TEL:+1234567890
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result).toHaveLength(0)
    })

    it('should skip contacts without email or phone', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result).toHaveLength(0)
    })

    it('should handle multiple emails and phones', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL;TYPE=WORK:john@work.com
EMAIL;TYPE=HOME:john@home.com
TEL;TYPE=WORK:+1234567890
TEL;TYPE=CELL:+0987654321
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result).toHaveLength(1)
      expect(result[0].email).toBe('john@work.com')
      expect(result[0].phone).toBe('+1234567890')
      expect(result[0].notes).toContain('HOME: john@home.com')
      expect(result[0].notes).toContain('CELL: +0987654321')
    })

    it('should handle organization without title', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
ORG:Acme Corp
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result[0].notes).toContain('Works at Acme Corp')
      expect(result[0].relationship).toBe('Professional')
      expect(result[0].tags).toEqual(['vCard', 'Work'])
    })

    it('should handle title without organization', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
TITLE:Software Engineer
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result[0].notes).toContain('Software Engineer')
      expect(result[0].relationship).toBe('Professional')
      expect(result[0].tags).toEqual(['vCard', 'Work'])
    })

    it('should handle invalid birthday dates gracefully', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
BDAY:invalid-date
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result[0].notes).not.toContain('Birthday:')
    })

    it('should handle line folding', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
NOTE:This is a long note that spans
 multiple lines in the vCard format
EMAIL:john@example.com
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result[0].notes).toContain('This is a long note that spansmultiple lines in the vCard format')
    })

    it('should handle escaped characters in values', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
NOTE:Line 1\\nLine 2\\, with comma\\; with semicolon\\\\ backslash
EMAIL:john@example.com
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result[0].notes).toContain('Line 1\nLine 2, with comma; with semicolon\\ backslash')
    })

    it('should handle parameters without equals sign', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
TEL;HOME:+1234567890
EMAIL:john@example.com
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result[0].phone).toBe('+1234567890')
    })

    it('should handle multiple organizations', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
ORG:Primary Corp;Secondary Inc
EMAIL:john@example.com
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result[0].notes).toContain('Works at Primary Corp')
    })

    it('should handle malformed vCards gracefully', () => {
      const vCardText = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
TEL:+1234567890
END:VCARD
BEGIN:VCARD
VERSION:3.0
INVALID:DATA
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Jane Smith
EMAIL:jane@example.com
END:VCARD`

      const result = VCardParser.parseText(vCardText)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('John Doe')
      expect(result[1].name).toBe('Jane Smith')
    })
  })

  describe('unfoldLines', () => {
    it('should unfold CRLF+space continuation', () => {
      const input = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:John\r\n Doe\r\nEMAIL:john@example.com\r\nEND:VCARD`
      const result = VCardParser['unfoldLines'](input)

      expect(result).toEqual([
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:JohnDoe',
        'EMAIL:john@example.com',
        'END:VCARD'
      ])
    })

    it('should unfold CRLF+tab continuation', () => {
      const input = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:John\r\n\tDoe\r\nEMAIL:john@example.com\r\nEND:VCARD`
      const result = VCardParser['unfoldLines'](input)

      expect(result).toEqual([
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:JohnDoe',
        'EMAIL:john@example.com',
        'END:VCARD'
      ])
    })

    it('should handle LF line endings', () => {
      const input = `BEGIN:VCARD\nVERSION:3.0\nFN:John\n Doe\nEMAIL:john@example.com\nEND:VCARD`
      const result = VCardParser['unfoldLines'](input)

      expect(result).toEqual([
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:JohnDoe',
        'EMAIL:john@example.com',
        'END:VCARD'
      ])
    })
  })

  describe('parseProperties', () => {
    it('should parse simple properties', () => {
      const lines = ['FN:John Doe', 'EMAIL:john@example.com']
      const result = VCardParser['parseProperties'](lines)

      expect(result).toEqual([
        { name: 'FN', params: {}, value: 'John Doe' },
        { name: 'EMAIL', params: {}, value: 'john@example.com' }
      ])
    })

    it('should parse properties with parameters', () => {
      const lines = ['TEL;TYPE=WORK:+1234567890', 'EMAIL;TYPE=HOME:john@example.com']
      const result = VCardParser['parseProperties'](lines)

      expect(result).toEqual([
        { name: 'TEL', params: { TYPE: 'WORK' }, value: '+1234567890' },
        { name: 'EMAIL', params: { TYPE: 'HOME' }, value: 'john@example.com' }
      ])
    })

    it('should handle quoted parameter values', () => {
      const lines = ['EMAIL;TYPE="WORK":john@example.com']
      const result = VCardParser['parseProperties'](lines)

      expect(result).toEqual([
        { name: 'EMAIL', params: { TYPE: 'WORK' }, value: 'john@example.com' }
      ])
    })

    it('should handle parameters without equals', () => {
      const lines = ['TEL;HOME:+1234567890']
      const result = VCardParser['parseProperties'](lines)

      expect(result).toEqual([
        { name: 'TEL', params: { TYPE: 'HOME' }, value: '+1234567890' }
      ])
    })

    it('should skip BEGIN and END lines', () => {
      const lines = ['BEGIN:VCARD', 'FN:John Doe', 'END:VCARD']
      const result = VCardParser['parseProperties'](lines)

      expect(result).toEqual([
        { name: 'FN', params: {}, value: 'John Doe' }
      ])
    })

    it('should skip malformed lines', () => {
      const lines = ['FN:John Doe', 'INVALID_LINE', 'EMAIL:john@example.com']
      const result = VCardParser['parseProperties'](lines)

      expect(result).toEqual([
        { name: 'FN', params: {}, value: 'John Doe' },
        { name: 'EMAIL', params: {}, value: 'john@example.com' }
      ])
    })
  })

  describe('decodeValue', () => {
    it('should decode escaped newlines', () => {
      expect(VCardParser['decodeValue']('Line 1\\nLine 2')).toBe('Line 1\nLine 2')
    })

    it('should decode escaped commas', () => {
      expect(VCardParser['decodeValue']('Smith\\, John')).toBe('Smith, John')
    })

    it('should decode escaped semicolons', () => {
      expect(VCardParser['decodeValue']('Item 1\\; Item 2')).toBe('Item 1; Item 2')
    })

    it('should decode escaped backslashes', () => {
      expect(VCardParser['decodeValue']('Path\\\\to\\\\file')).toBe('Path\\to\\file')
    })

    it('should handle multiple escape sequences', () => {
      expect(VCardParser['decodeValue']('Name\\, Inc.\\nAddress\\\\123')).toBe('Name, Inc.\nAddress\\123')
    })

    it('should handle unescaped content', () => {
      expect(VCardParser['decodeValue']('Simple text')).toBe('Simple text')
    })
  })
})

describe('isVCardFile', () => {
  it('should detect .vcf extension', () => {
    const file = new File([], 'contacts.vcf')
    expect(isVCardFile(file)).toBe(true)
  })

  it('should detect .VCF extension (uppercase)', () => {
    const file = new File([], 'contacts.VCF')
    expect(isVCardFile(file)).toBe(true)
  })

  it('should detect text/vcard MIME type', () => {
    const file = new File([], 'contacts.txt', { type: 'text/vcard' })
    expect(isVCardFile(file)).toBe(true)
  })

  it('should detect text/x-vcard MIME type', () => {
    const file = new File([], 'contacts.txt', { type: 'text/x-vcard' })
    expect(isVCardFile(file)).toBe(true)
  })

  it('should reject non-vCard files', () => {
    const file = new File([], 'contacts.txt', { type: 'text/plain' })
    expect(isVCardFile(file)).toBe(false)
  })

  it('should reject files without .vcf extension', () => {
    const file = new File([], 'contacts.txt')
    expect(isVCardFile(file)).toBe(false)
  })
})