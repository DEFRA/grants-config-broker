import {
  getFeatureControlByNameSchema,
  getFeatureControlsSchema,
  postAddFeatureControlSchema,
  putUpdateFeatureControlValueSchema
} from './feature-control-schemas.js'

describe('feature-control-schemas', () => {
  describe('postAddFeatureControlSchema', () => {
    const validPayload = {
      name: 'ALLOW_LIST_WOODLANDS',
      status: 'active',
      displayName: 'Woodlands grant allow list',
      type: 'list-number',
      initialValue: {
        default: [123456789, 6544212, 2342323232],
        dev: [987654321]
      },
      scopes: ['grant.woodland'],
      description: 'Allow list for woodland grant',
      owner: 'Woodland team',
      expiryDate: '2028-01-01',
      createdBy: 'test-user'
    }

    it('should validate successfully for a valid payload', () => {
      const result = postAddFeatureControlSchema.validate(validPayload)
      expect(result.error).toBeUndefined()
    })

    it('should validate successfully for different types in initialValue', () => {
      const payloads = [
        {
          ...validPayload,
          type: 'boolean',
          initialValue: { default: true, dev: false }
        },
        { ...validPayload, type: 'string', initialValue: { default: 'value' } },
        { ...validPayload, type: 'number', initialValue: { default: 123 } },
        {
          ...validPayload,
          type: 'list-string',
          initialValue: { default: ['a', 'b'] }
        },
        {
          ...validPayload,
          type: 'date',
          initialValue: { default: '2025-01-01' }
        },
        {
          // environments present and no default, check initialValue includes required envs
          ...validPayload,
          environments: ['dev', 'test'],
          type: 'string',
          initialValue: { dev: 'a', test: 'b' }
        },
        {
          // environments absent and no default, check initialValue includes all envs
          ...validPayload,
          type: 'string',
          initialValue: {
            dev: 'a',
            test: 'b',
            'perf-test': 'c',
            'ext-test': 'd',
            prod: 'e'
          }
        },
        {
          // environments present, initialValue contains default and some envs have override
          ...validPayload,
          environments: ['dev', 'test', 'perf-test'],
          type: 'boolean',
          initialValue: { default: false, dev: true, test: true }
        }
      ]

      payloads.forEach((payload) => {
        const result = postAddFeatureControlSchema.validate(payload)
        expect(result.error).toBeUndefined()
      })
    })

    it('should uppercase name', () => {
      const result = postAddFeatureControlSchema.validate({
        ...validPayload,
        name: 'lowercase_name'
      })
      expect(result.error).toBeUndefined()
      expect(result.value.name).toBe('LOWERCASE_NAME')
    })

    it('should result in error for missing required fields', () => {
      const requiredFields = [
        'name',
        'type',
        'initialValue',
        'scopes',
        'description',
        'owner',
        'expiryDate',
        'createdBy'
      ]

      requiredFields.forEach((field) => {
        const payload = { ...validPayload }
        delete payload[field]
        const result = postAddFeatureControlSchema.validate(payload)
        expect(result.error).toBeDefined()
        expect(result.error.message).toMatch(`"${field}" is required`)
      })
    })

    it('should result in error for invalid type', () => {
      const result = postAddFeatureControlSchema.validate({
        ...validPayload,
        type: 'invalid'
      })
      expect(result.error).toBeDefined()
      expect(result.error.message).toMatch(
        '"type" must be one of [list-string, list-number, boolean, date, string, number]'
      )
    })

    it('should result in error for invalid scope pattern', () => {
      const result = postAddFeatureControlSchema.validate({
        ...validPayload,
        scopes: ['invalid.scope']
      })
      expect(result.error).toBeDefined()
    })

    it('should validate successfully for valid scope patterns', () => {
      const scopes = ['grant.woodland', 'service.auth', 'feature.toggle-123']
      scopes.forEach((scope) => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          scopes: [scope]
        })
        expect(result.error).toBeUndefined()
      })
    })

    describe('initialValue environment rules', () => {
      it('should validate when only default is present', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          initialValue: { default: [123] }
        })
        expect(result.error).toBeUndefined()
      })

      it('should validate when default and some others are present', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          initialValue: { default: [123], dev: [456] }
        })
        expect(result.error).toBeUndefined()
      })

      it('should validate when default is absent but ALL others are present', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          initialValue: {
            dev: [1],
            test: [2],
            'ext-test': [3],
            'perf-test': [4],
            prod: [5]
          }
        })
        expect(result.error).toBeUndefined()
      })

      it('should fail when default is absent and some others are missing', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          initialValue: {
            dev: [1],
            test: [2]
            // missing ext-test, perf-test, prod
          }
        })
        expect(result.error).toBeDefined()
      })

      it('should fail when an invalid environment key is used', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          initialValue: {
            default: [1],
            invalid: [2]
          }
        })
        expect(result.error).toBeDefined()
      })

      it('should fail when no default, environments provide and initialValue missing envs', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          environments: ['dev', 'test', 'perf-test'],
          initialValue: {
            dev: [1]
          }
        })
        expect(result.error).toBeDefined()
        expect(result.error.message).toBe(
          '"initialValue" must contain either a "default" value or values for required environments. Missing: test, perf-test'
        )
      })

      it('should fail when no default, environments absent and initialValue missing envs', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          initialValue: {
            dev: [1],
            prod: [5]
          }
        })
        expect(result.error).toBeDefined()
        expect(result.error.message).toBe(
          '"initialValue" must contain either a "default" value or values for required environments. Missing: test, perf-test, ext-test'
        )
      })
    })

    describe('initialValue type validation', () => {
      it('should fail when type is string but initialValue is number', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          type: 'string',
          initialValue: { default: 123 }
        })
        expect(result.error).toBeDefined()
      })

      it('should fail when type is list-string but initialValue contains numbers', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          type: 'list-string',
          initialValue: { default: [123] }
        })
        expect(result.error).toBeDefined()
      })

      it('should fail when type is boolean but initialValue is string', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          type: 'boolean',
          initialValue: { default: 'true' }
        })
        expect(result.error).toBeDefined()
      })

      it('should fail when type is number but initialValue is string', () => {
        const result = postAddFeatureControlSchema.validate({
          ...validPayload,
          type: 'number',
          initialValue: { default: '123' }
        })
        expect(result.error).toBeDefined()
      })
    })
  })

  describe('putUpdateFeatureControlValueSchema', () => {
    const validPayload = {
      name: 'ALLOW_LIST_WOODLANDS',
      value: [1, 2, 3],
      user: 'test-user',
      note: 'Updating for testing'
    }

    it('should validate successfully for a valid payload', () => {
      const result = putUpdateFeatureControlValueSchema.validate(validPayload)
      expect(result.error).toBeUndefined()
    })

    it('should validate successfully without a note', () => {
      const payload = { ...validPayload }
      delete payload.note
      const result = putUpdateFeatureControlValueSchema.validate(payload)
      expect(result.error).toBeUndefined()
    })

    it('should validate successfully with an empty note', () => {
      const result = putUpdateFeatureControlValueSchema.validate({
        ...validPayload,
        note: ''
      })
      expect(result.error).toBeUndefined()
    })

    it('should result in error for missing required fields', () => {
      const requiredFields = ['name', 'value', 'user']

      requiredFields.forEach((field) => {
        const payload = { ...validPayload }
        delete payload[field]
        const result = putUpdateFeatureControlValueSchema.validate(payload)
        expect(result.error).toBeDefined()
        expect(result.error.message).toMatch(`"${field}" is required`)
      })
    })

    it('should uppercase name', () => {
      const result = putUpdateFeatureControlValueSchema.validate({
        ...validPayload,
        name: 'lowercase_name'
      })
      expect(result.error).toBeUndefined()
      expect(result.value.name).toBe('LOWERCASE_NAME')
    })
  })

  describe('getFeatureControlByNameSchema', () => {
    it('should validate successfully for a valid name', () => {
      const result = getFeatureControlByNameSchema.validate({
        name: 'TEST_FEATURE'
      })
      expect(result.error).toBeUndefined()
    })

    it('should uppercase name', () => {
      const result = getFeatureControlByNameSchema.validate({
        name: 'test_feature'
      })
      expect(result.error).toBeUndefined()
      expect(result.value.name).toBe('TEST_FEATURE')
    })

    it('should result in error if name is missing', () => {
      const result = getFeatureControlByNameSchema.validate({})
      expect(result.error).toBeDefined()
    })
  })

  describe('getFeatureControlsSchema', () => {
    it('should validate successfully with defaults', () => {
      const result = getFeatureControlsSchema.validate({})
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        page: 1,
        pageSize: 10
      })
    })

    it('should validate successfully with all filters', () => {
      const result = getFeatureControlsSchema.validate({
        page: 2,
        pageSize: 50,
        name: 'test',
        owner: 'test-owner',
        scope: 'grant.test',
        type: 'boolean'
      })
      expect(result.error).toBeUndefined()
      expect(result.value.page).toBe(2)
      expect(result.value.pageSize).toBe(50)
      expect(result.value.name).toBe('test')
      expect(result.value.owner).toBe('test-owner')
      expect(result.value.scope).toBe('grant.test')
      expect(result.value.type).toBe('boolean')
    })

    it('should fail for invalid type', () => {
      const result = getFeatureControlsSchema.validate({ type: 'invalid' })
      expect(result.error).toBeDefined()
    })

    it('should fail for invalid page or pageSize', () => {
      expect(getFeatureControlsSchema.validate({ page: 0 }).error).toBeDefined()
      expect(
        getFeatureControlsSchema.validate({ pageSize: 0 }).error
      ).toBeDefined()
      expect(
        getFeatureControlsSchema.validate({ pageSize: 101 }).error
      ).toBeDefined()
    })
  })
})
