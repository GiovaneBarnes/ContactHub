import { describe, it, expect } from 'vitest'
import { insertUserSchema, insertGroupSchema, type User, type Group, type InsertUser, type InsertGroup } from '../schema'

describe('User Schema Validation', () => {
  it('should validate valid user data', () => {
    const validUser = {
      username: 'testuser',
      password: 'password123'
    }

    const result = insertUserSchema.safeParse(validUser)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validUser)
    }
  })

  it('should reject user data without username', () => {
    const invalidUser = {
      password: 'password123'
    }

    const result = insertUserSchema.safeParse(invalidUser)
    expect(result.success).toBe(false)
  })

  it('should reject user data without password', () => {
    const invalidUser = {
      username: 'testuser'
    }

    const result = insertUserSchema.safeParse(invalidUser)
    expect(result.success).toBe(false)
  })

  it('should accept empty username', () => {
    const user = {
      username: '',
      password: 'password123'
    }

    const result = insertUserSchema.safeParse(user)
    expect(result.success).toBe(true)
  })

  it('should accept empty password', () => {
    const user = {
      username: 'testuser',
      password: ''
    }

    const result = insertUserSchema.safeParse(user)
    expect(result.success).toBe(true)
  })
})

describe('Group Schema Validation', () => {
  it('should validate valid group data', () => {
    const validGroup = {
      name: 'Test Group',
      description: 'A test group',
      contactIds: ['contact1', 'contact2'],
      schedules: [],
      backgroundInfo: 'Some background info',
      enabled: true
    }

    const result = insertGroupSchema.safeParse(validGroup)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validGroup)
    }
  })

  it('should validate minimal group data', () => {
    const minimalGroup = {
      name: 'Test Group',
      description: 'A test group',
      backgroundInfo: 'Some background info'
    }

    const result = insertGroupSchema.safeParse(minimalGroup)
    expect(result.success).toBe(true)
  })

  it('should reject group data without name', () => {
    const invalidGroup = {
      description: 'A test group',
      backgroundInfo: 'Some background info'
    }

    const result = insertGroupSchema.safeParse(invalidGroup)
    expect(result.success).toBe(false)
  })

  it('should reject group data without description', () => {
    const invalidGroup = {
      name: 'Test Group',
      backgroundInfo: 'Some background info'
    }

    const result = insertGroupSchema.safeParse(invalidGroup)
    expect(result.success).toBe(false)
  })

  it('should reject group data without backgroundInfo', () => {
    const invalidGroup = {
      name: 'Test Group',
      description: 'A test group'
    }

    const result = insertGroupSchema.safeParse(invalidGroup)
    expect(result.success).toBe(false)
  })

  it('should validate contactIds as array of strings', () => {
    const groupWithContacts = {
      name: 'Test Group',
      description: 'A test group',
      contactIds: ['contact1', 'contact2'],
      backgroundInfo: 'Some background info'
    }

    const result = insertGroupSchema.safeParse(groupWithContacts)
    expect(result.success).toBe(true)
  })

  it('should validate enabled as boolean', () => {
    const validGroup = {
      name: 'Test Group',
      description: 'A test group',
      backgroundInfo: 'Some background info',
      enabled: false
    }

    const result = insertGroupSchema.safeParse(validGroup)
    expect(result.success).toBe(true)

    // Test invalid enabled value
    const invalidGroup = {
      name: 'Test Group',
      description: 'A test group',
      backgroundInfo: 'Some background info',
      enabled: 'not-a-boolean'
    }

    const invalidResult = insertGroupSchema.safeParse(invalidGroup)
    expect(invalidResult.success).toBe(false)
  })
})

describe('Type Definitions', () => {
  it('should have correct User type structure', () => {
    const user: User = {
      id: '123',
      username: 'testuser',
      password: 'hashedpassword'
    }

    expect(user.id).toBe('123')
    expect(user.username).toBe('testuser')
    expect(user.password).toBe('hashedpassword')
  })

  it('should have correct Group type structure', () => {
    const group: Group = {
      id: '123',
      name: 'Test Group',
      description: 'A test group',
      contactIds: ['contact1'],
      schedules: [],
      backgroundInfo: 'Info',
      enabled: true
    }

    expect(group.id).toBe('123')
    expect(group.name).toBe('Test Group')
    expect(group.contactIds).toEqual(['contact1'])
    expect(group.enabled).toBe(true)
  })

  it('should have correct InsertUser type', () => {
    const insertUser: InsertUser = {
      username: 'testuser',
      password: 'password123'
    }

    expect(insertUser.username).toBe('testuser')
    expect(insertUser.password).toBe('password123')
  })

  it('should have correct InsertGroup type', () => {
    const insertGroup: InsertGroup = {
      name: 'Test Group',
      description: 'A test group',
      contactIds: ['contact1'],
      schedules: [],
      backgroundInfo: 'Info',
      enabled: true
    }

    expect(insertGroup.name).toBe('Test Group')
    expect(insertGroup.contactIds).toEqual(['contact1'])
  })
})