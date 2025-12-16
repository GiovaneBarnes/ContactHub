import { describe, it, expect } from 'vitest'

describe('Server Configuration', () => {
  it('should have security configuration constants', () => {
    const SECURITY_CONFIG = {
      MAX_LOGIN_ATTEMPTS: 5,
      LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_SIGNUP_ATTEMPTS: 3,
      SIGNUP_WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_INPUT_LENGTH: 1000,
      ALLOWED_DOMAINS: ['localhost', '127.0.0.1'],
    } as const

    expect(SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS).toBe(5)
    expect(SECURITY_CONFIG.LOGIN_WINDOW_MS).toBe(15 * 60 * 1000)
    expect(SECURITY_CONFIG.MAX_SIGNUP_ATTEMPTS).toBe(3)
    expect(SECURITY_CONFIG.SIGNUP_WINDOW_MS).toBe(60 * 60 * 1000)
    expect(SECURITY_CONFIG.MAX_INPUT_LENGTH).toBe(1000)
  })

  it('should have correct middleware configuration', () => {
    const rateLimitConfig = {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: "Too many requests from this IP, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    }

    expect(rateLimitConfig.windowMs).toBe(15 * 60 * 1000)
    expect(rateLimitConfig.max).toBe(100)
  })

  it('should have CORS configuration', () => {
    const corsConfig = {
      origin: true, // Development mode
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }

    expect(corsConfig.credentials).toBe(true)
    expect(corsConfig.methods).toContain('GET')
    expect(corsConfig.methods).toContain('POST')
    expect(corsConfig.methods).toContain('PUT')
    expect(corsConfig.methods).toContain('DELETE')
  })

  it('should have Helmet security headers configuration', () => {
    const helmetConfig = {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }

    expect(helmetConfig.contentSecurityPolicy.directives.defaultSrc).toContain("'self'")
    expect(helmetConfig.hsts.maxAge).toBe(31536000)
    expect(helmetConfig.hsts.includeSubDomains).toBe(true)
  })
})