import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  cn,
  sanitizeInput,
  validateEmail,
  validatePhone,
  escapeHtml,
  RateLimiter,
  rateLimiter,
  SECURITY_CONFIG,
  generateId
} from '../utils'

describe('cn (className utility)', () => {
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
    expect(cn('class1', undefined, 'class2')).toBe('class1 class2')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500') // Tailwind merge
  })
})

describe('sanitizeInput', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script')
    expect(sanitizeInput('<b>Bold</b>')).toBe('bBold/b')
  })

  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('should limit length to 1000 characters', () => {
    const longInput = 'a'.repeat(1500)
    expect(sanitizeInput(longInput)).toHaveLength(1000)
  })
})

describe('validateEmail', () => {
  it('should validate correct email formats', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true)
  })

  it('should reject invalid email formats', () => {
    expect(validateEmail('invalid')).toBe(false)
    expect(validateEmail('@domain.com')).toBe(false)
    expect(validateEmail('test@')).toBe(false)
    expect(validateEmail('')).toBe(false)
  })

  it('should reject emails longer than 254 characters', () => {
    const longEmail = 'a'.repeat(250) + '@example.com'
    expect(validateEmail(longEmail)).toBe(false)
  })
})

describe('validatePhone', () => {
  it('should validate correct phone formats', () => {
    expect(validatePhone('+1234567890')).toBe(true)
    expect(validatePhone('123-456-7890')).toBe(true)
    expect(validatePhone('(123) 456-7890')).toBe(true)
    expect(validatePhone('123 456 7890')).toBe(true)
  })

  it('should reject invalid phone formats', () => {
    expect(validatePhone('123')).toBe(false) // Too short
    expect(validatePhone('12345678901234567890')).toBe(false) // Too long
    expect(validatePhone('abc1234567')).toBe(false) // Contains letters
    expect(validatePhone('')).toBe(false)
  })
})

describe('escapeHtml', () => {
  it('should escape HTML characters', () => {
    const escaped = escapeHtml('<div>"Hello & goodbye"</div>')
    expect(escaped).toContain('&lt;div&gt;')
    expect(escaped).toContain('&amp;')
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })
})

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter()
  })

  it('should allow requests within limits', () => {
    expect(limiter.isAllowed('user1', 3, 1000)).toBe(true)
    expect(limiter.isAllowed('user1', 3, 1000)).toBe(true)
    expect(limiter.isAllowed('user1', 3, 1000)).toBe(true)
  })

  it('should block requests exceeding limits', () => {
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed('user1', 3, 1000)
    }
    expect(limiter.isAllowed('user1', 3, 1000)).toBe(false)
  })

  it('should reset attempts', () => {
    limiter.isAllowed('user1', 1, 1000)
    expect(limiter.isAllowed('user1', 1, 1000)).toBe(false)

    limiter.reset('user1')
    expect(limiter.isAllowed('user1', 1, 1000)).toBe(true)
  })

  it('should handle different keys independently', () => {
    expect(limiter.isAllowed('user1', 1, 1000)).toBe(true)
    expect(limiter.isAllowed('user2', 1, 1000)).toBe(true)
    expect(limiter.isAllowed('user1', 1, 1000)).toBe(false)
    expect(limiter.isAllowed('user2', 1, 1000)).toBe(false)
  })
})

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
    expect(typeof id1).toBe('string')
    expect(id1.length).toBeGreaterThan(0)
  })

  it('should generate UUID-like format', () => {
    const id = generateId()
    // Basic UUID format check: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})

describe('SECURITY_CONFIG', () => {
  it('should have correct security limits', () => {
    expect(SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS).toBe(5)
    expect(SECURITY_CONFIG.LOGIN_WINDOW_MS).toBe(15 * 60 * 1000) // 15 minutes
    expect(SECURITY_CONFIG.MAX_SIGNUP_ATTEMPTS).toBe(3)
    expect(SECURITY_CONFIG.SIGNUP_WINDOW_MS).toBe(60 * 60 * 1000) // 1 hour
    expect(SECURITY_CONFIG.MAX_INPUT_LENGTH).toBe(1000)
  })

  it('should have correct allowed domains based on environment', () => {
    // In test environment, should allow localhost
    expect(SECURITY_CONFIG.ALLOWED_DOMAINS).toContain('localhost')
    expect(SECURITY_CONFIG.ALLOWED_DOMAINS).toContain('127.0.0.1')
  })

  describe('generateId', () => {
    it('should generate UUID using crypto.randomUUID when available', () => {
      const mockUUID = '12345678-1234-1234-1234-123456789abc'
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID)

      const result = generateId()
      expect(result).toBe(mockUUID)

      vi.restoreAllMocks()
    })

    it('should fallback to manual UUID generation when crypto.randomUUID is not available', () => {
      // Mock crypto.randomUUID to be undefined
      const originalRandomUUID = crypto.randomUUID
      ;(crypto as any).randomUUID = undefined

      // Mock Math.random for predictable results
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      const result = generateId()

      // Should generate a UUID-like string
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

      // Restore
      ;(crypto as any).randomUUID = originalRandomUUID
      vi.restoreAllMocks()
    })
  })
})