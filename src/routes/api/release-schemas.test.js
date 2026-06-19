import { postReleaseConfigSchema } from './release-schemas.js'

describe('release-schemas', () => {
  describe('postReleaseConfigSchema', () => {
    it('should validate successfully for minimum options set', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0',
        files: ['file1.json']
      })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully for all options set', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0',
        files: ['file1.json', 'file2.json'],
        status: 'active',
        user: 'user-id'
      })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully for draft status', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0',
        files: ['file1.json'],
        status: 'draft'
      })

      expect(result.error).toBeUndefined()
    })

    it('should lowercase status', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0',
        files: ['file1.json'],
        status: 'ACTIVE'
      })

      expect(result.error).toBeUndefined()
      expect(result.value.status).toBe('active')
    })

    it('should result in error for missing grant', () => {
      const result = postReleaseConfigSchema.validate({
        version: '1.0.0',
        files: ['file1.json']
      })

      expect(result.error.stack).toMatch('ValidationError: "grant" is required')
    })

    it('should result in error for missing version', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        files: ['file1.json']
      })

      expect(result.error.stack).toMatch(
        'ValidationError: "version" is required'
      )
    })

    it('should result in error for missing files', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0'
      })

      expect(result.error.stack).toMatch('ValidationError: "files" is required')
    })

    it('should result in error for empty files array', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0',
        files: []
      })

      expect(result.error.stack).toMatch(
        'ValidationError: "files" must contain at least 1 items'
      )
    })

    it('should result in error for invalid status', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0',
        files: ['file1.json'],
        status: 'invalid'
      })

      expect(result.error.stack).toMatch(
        'ValidationError: "status" must be one of [draft, active]'
      )
    })

    it('should result in error for unknown option', () => {
      const result = postReleaseConfigSchema.validate({
        grant: 'grant',
        version: '1.0.0',
        files: ['file1.json'],
        unknown: 'option'
      })

      expect(result.error.stack).toMatch(
        'ValidationError: "unknown" is not allowed'
      )
    })
  })
})
