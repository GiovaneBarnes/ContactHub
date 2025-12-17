import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Firestore Security Rules', () => {
  let rulesContent: string

  beforeAll(() => {
    const rulesPath = path.join(__dirname, 'firestore.rules')
    rulesContent = fs.readFileSync(rulesPath, 'utf-8')
  })

  it('should have valid Firestore rules structure', () => {
    expect(rulesContent).toContain('rules_version = \'2\'')
    expect(rulesContent).toContain('service cloud.firestore')
    expect(rulesContent).toContain('match /databases/{database}/documents')
  })

  it('should require authentication for all operations', () => {
    expect(rulesContent).toContain('request.auth != null')
    expect(rulesContent).toContain('request.auth.uid')
  })

  it('should secure users collection', () => {
    expect(rulesContent).toContain('match /users/{userId}')
    expect(rulesContent).toContain('allow read, write: if request.auth != null && request.auth.uid == userId')
  })

  it('should secure contacts collection', () => {
    expect(rulesContent).toContain('match /contacts/{contactId}')
    expect(rulesContent).toContain('allow read, write: if request.auth != null && resource.data.userId == request.auth.uid')
    expect(rulesContent).toContain('allow create: if request.auth != null && request.auth.uid == request.resource.data.userId')
  })

  it('should secure groups collection', () => {
    expect(rulesContent).toContain('match /groups/{groupId}')
    expect(rulesContent).toContain('allow read, write: if request.auth != null && resource.data.userId == request.auth.uid')
    expect(rulesContent).toContain('allow create: if request.auth != null && request.auth.uid == request.resource.data.userId')
  })

  it('should secure message logs collection', () => {
    expect(rulesContent).toContain('match /logs/{logId}')
    expect(rulesContent).toContain('allow read, write: if request.auth != null && resource.data.userId == request.auth.uid')
    expect(rulesContent).toContain('allow create: if request.auth != null && request.auth.uid == request.resource.data.userId')
  })

  it('should validate userId field in create operations', () => {
    const createRules = rulesContent.match(/allow create:.*request\.auth\.uid.*request\.resource\.data\.userId/g)
    expect(createRules).toBeTruthy()
    expect(createRules!.length).toBeGreaterThan(0)
  })
})