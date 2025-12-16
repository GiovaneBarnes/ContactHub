import { describe, it, expect } from 'vitest'
import type { Contact, Group, User } from '../types'

describe('Type Definitions from mock-api', () => {
  it('should define User type correctly', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User'
    }

    expect(user.id).toBe('1')
    expect(user.email).toBe('test@example.com')
    expect(user.name).toBe('Test User')
  })

  it('should define Contact type correctly', () => {
    const contact: Contact = {
      id: '1',
      name: 'John Doe',
      phone: '+15551234567',
      email: 'john@example.com',
      notes: 'Test contact'
    }

    expect(contact.id).toBe('1')
    expect(contact.name).toBe('John Doe')
    expect(contact.phone).toBe('+15551234567')
    expect(contact.email).toBe('john@example.com')
  })

  it('should define Group type correctly', () => {
    const group: Group = {
      id: '1',
      name: 'Test Group',
      description: 'A test group',
      contactIds: ['1', '2'],
      schedules: [],
      backgroundInfo: 'Test info',
      enabled: true
    }

    expect(group.id).toBe('1')
    expect(group.name).toBe('Test Group')
    expect(group.contactIds).toHaveLength(2)
    expect(group.enabled).toBe(true)
  })
})