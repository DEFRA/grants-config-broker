import { describe, it, expect } from 'vitest'
import { inputMessageSchema } from './message-schemas.js'

describe('message-schemas', () => {
  describe('inputMessageSchema', () => {
    it('should validate a valid input message', () => {
      const message = {
        grant: 'grant-name',
        version: '1.0.0',
        files: ['file1.json'],
        status: 'draft',
        user: 'user-id'
      }
      const { error } = inputMessageSchema.validate(message)
      expect(error).toBeUndefined()
    })

    it('should validate a valid input message with no optional values', () => {
      const message = {
        grant: 'grant-name',
        version: '1.0.0',
        files: ['file1.json'],
        user: 'user-id'
      }
      const { error } = inputMessageSchema.validate(message)
      expect(error).toBeUndefined()
    })

    it('should fail if files are empty', () => {
      const message = {
        grant: 'grant-name',
        version: '1.0.0',
        files: []
      }
      const { error } = inputMessageSchema.validate(message)
      expect(error).toBeDefined()
    })
  })
})
