import {
  getAllGrantsSchema,
  getAllVersionsSchema,
  getLatestVersionSchema,
  getSpecificVersionSchema
} from './version-schemas.js'

describe('version-schemas', () => {
  describe('getLatestVersionSchema', () => {
    it('should validate successfully for minimum options set', () => {
      const result = getLatestVersionSchema.validate({ grant: 'grant' })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully for all options set', () => {
      const result = getLatestVersionSchema.validate({
        grant: 'grant',
        draft: 'include',
        constrainMajor: 1,
        constrainMinor: 2
      })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully for major constraint only', () => {
      const result = getLatestVersionSchema.validate({
        grant: 'grant',
        draft: 'only',
        constrainMajor: 1
      })

      expect(result.error).toBeUndefined()
    })

    it('should result in error for minor constraint only', () => {
      const result = getLatestVersionSchema.validate({
        grant: 'grant',
        constrainMinor: 1
      })

      expect(result.error.stack).to.eql(
        'ValidationError: "constrainMajor" is required'
      )
    })

    it('should result in error for unknown draft option', () => {
      const result = getLatestVersionSchema.validate({
        grant: 'grant',
        draft: 'true'
      })

      expect(result.error.stack).to.eql(
        'ValidationError: "draft" must be one of [include, only]'
      )
    })

    it('should result in error for missing mandatory option', () => {
      const result = getLatestVersionSchema.validate({})

      expect(result.error.stack).to.eql('ValidationError: "grant" is required')
    })
  })

  describe('getAllVersionSchema', () => {
    it('should validate successfully for minimum options set', () => {
      const result = getAllVersionsSchema.validate({ grant: 'grant' })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully for all options set', () => {
      const result = getAllVersionsSchema.validate({
        grant: 'grant',
        draft: 'include',
        constrainMajor: 1,
        constrainMinor: 2
      })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully for major constraint only', () => {
      const result = getAllVersionsSchema.validate({
        grant: 'grant',
        draft: 'only',
        constrainMajor: 1
      })

      expect(result.error).toBeUndefined()
    })

    it('should result in error for minor constraint only', () => {
      const result = getAllVersionsSchema.validate({
        grant: 'grant',
        constrainMinor: 1
      })

      expect(result.error.stack).to.eql(
        'ValidationError: "constrainMajor" is required'
      )
    })

    it('should result in error for unknown draft option', () => {
      const result = getAllVersionsSchema.validate({
        grant: 'grant',
        draft: 'true'
      })

      expect(result.error.stack).to.eql(
        'ValidationError: "draft" must be one of [include, only]'
      )
    })

    it('should result in error for missing mandatory option', () => {
      const result = getAllVersionsSchema.validate({})

      expect(result.error.stack).to.eql('ValidationError: "grant" is required')
    })
  })

  describe('getAllGrantsSchema', () => {
    it('should validate successfully with draft option set', () => {
      const result = getAllGrantsSchema.validate({ draft: 'include' })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully with draft option set to only', () => {
      const result = getAllGrantsSchema.validate({ draft: 'only' })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully with draft option not set', () => {
      const result = getAllGrantsSchema.validate({})

      expect(result.error).toBeUndefined()
    })

    it('should result in error for unknown option', () => {
      const result = getAllGrantsSchema.validate({
        grant: 'grant'
      })

      expect(result.error.stack).to.eql(
        'ValidationError: "grant" is not allowed'
      )
    })
  })

  describe('getSpecificVersionSchema', () => {
    it('should validate successfully with grant and version options set', () => {
      const result = getSpecificVersionSchema.validate({
        grant: 'grant',
        version: '1.0.0'
      })

      expect(result.error).toBeUndefined()
    })

    it('should validate successfully with grant and version component options set', () => {
      const result = getSpecificVersionSchema.validate({
        grant: 'grant',
        major: 1,
        minor: 0,
        patch: 0
      })

      expect(result.error).toBeUndefined()
    })

    it('should result in error when neither version or component parts is supplied', () => {
      const result = getSpecificVersionSchema.validate({
        grant: 'grant'
      })

      expect(result.error.stack).toMatch(
        'Error: Specify either version or major, minor and patch'
      )
    })
  })
})
