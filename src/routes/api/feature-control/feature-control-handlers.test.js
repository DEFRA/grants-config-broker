import {
  getFeatureControlByNameHandler,
  getFeatureControlsHandler,
  postAddFeatureControlHandler,
  putUpdateFeatureControlValueHandler
} from './feature-control-handlers.js'
import { StatusCodes } from 'http-status-codes'

vi.mock('../../../repositories/feature-control-repository.js', () => ({
  getFeatureControlByName: vi.fn(),
  getFeatureControls: vi.fn(),
  storeFeatureControl: vi.fn(),
  updateFeatureControlDefinition: vi.fn(),
  updateFeatureControlValue: vi.fn()
}))

vi.mock('../../../messaging/outbound/notify-feature-control.js', () => ({
  notifyFeatureControlUpdate: vi.fn()
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn().mockReturnValue('dev')
  }
}))

import {
  getFeatureControlByName,
  getFeatureControls,
  storeFeatureControl,
  updateFeatureControlDefinition,
  updateFeatureControlValue
} from '../../../repositories/feature-control-repository.js'
import { notifyFeatureControlUpdate } from '../../../messaging/outbound/notify-feature-control.js'

describe('feature-control-handlers', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    setBindings: vi.fn()
  }
  const mockDb = {}
  const mockH = {
    response: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('postAddFeatureControlHandler', () => {
    const payload = {
      name: 'ALLOW_LIST_WOODLANDS',
      type: 'list-number',
      initialValue: {
        default: [123],
        dev: [456]
      },
      scopes: ['grant.woodland'],
      description: 'Allow list for woodland grant',
      owner: 'Woodland team',
      expiryDate: new Date('2028-01-01'),
      createdBy: 'user1',
      roleRequired: ['grant.view']
    }
    const mockRequest = {
      payload,
      logger: mockLogger,
      db: mockDb
    }

    it('should store new feature control and return accepted', async () => {
      getFeatureControlByName.mockResolvedValue(null)

      const result = await postAddFeatureControlHandler(mockRequest, mockH)

      expect(getFeatureControlByName).toHaveBeenCalledWith(payload.name, mockDb)
      expect(storeFeatureControl).toHaveBeenCalledWith(
        expect.objectContaining({
          name: payload.name,
          type: payload.type,
          value: [456], // Uses 'dev' from mocked config
          scopes: payload.scopes,
          description: payload.description,
          owner: payload.owner,
          createdBy: payload.createdBy
        }),
        mockDb
      )
      expect(notifyFeatureControlUpdate).toHaveBeenCalledWith(
        {
          name: payload.name,
          scopes: payload.scopes,
          value: [456],
          updatedBy: payload.createdBy,
          valueType: 'list-number'
        },
        mockLogger
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should use default initial value if current environment is not present', async () => {
      const payloadNoDev = {
        ...payload,
        initialValue: {
          default: [123]
        }
      }
      const mockRequestNoDev = {
        ...mockRequest,
        payload: payloadNoDev
      }
      getFeatureControlByName.mockResolvedValue(null)

      await postAddFeatureControlHandler(mockRequestNoDev, mockH)

      expect(storeFeatureControl).toHaveBeenCalledWith(
        expect.objectContaining({
          value: [123]
        }),
        mockDb
      )
    })

    it('should update existing feature control definition if changed and return accepted', async () => {
      const existing = {
        name: payload.name,
        type: payload.type,
        value: 'some-value',
        scopes: ['old.scope'],
        description: 'old desc',
        owner: 'old owner',
        expiryDate: new Date('2027-01-01'),
        roleRequired: ['old.role']
      }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await postAddFeatureControlHandler(mockRequest, mockH)

      expect(updateFeatureControlDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          name: payload.name,
          scopes: payload.scopes,
          description: payload.description,
          owner: payload.owner,
          expiryDate: payload.expiryDate,
          createdBy: payload.createdBy,
          roleRequired: payload.roleRequired,
          existingValue: existing.value
        }),
        mockDb
      )
      expect(notifyFeatureControlUpdate).toHaveBeenCalledWith(
        {
          name: payload.name,
          scopes: payload.scopes,
          value: existing.value,
          updatedBy: payload.createdBy,
          valueType: payload.type
        },
        mockLogger
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should update existing feature control definition if only description changed and return accepted without emitting', async () => {
      const existing = {
        name: payload.name,
        type: payload.type,
        scopes: payload.scopes,
        description: 'old desc',
        owner: payload.owner,
        expiryDate: payload.expiryDate,
        roleRequired: payload.roleRequired
      }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await postAddFeatureControlHandler(mockRequest, mockH)

      expect(updateFeatureControlDefinition).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Not emitting')
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should return no content if existing feature control definition is unchanged', async () => {
      const existing = {
        name: payload.name,
        type: payload.type,
        scopes: payload.scopes,
        description: payload.description,
        owner: payload.owner,
        expiryDate: payload.expiryDate,
        roleRequired: payload.roleRequired
      }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await postAddFeatureControlHandler(mockRequest, mockH)

      expect(updateFeatureControlDefinition).not.toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.NO_CONTENT)
      expect(result).toBe(mockH)
    })

    it('should return conflict if immutable field (type) is changed', async () => {
      const existing = {
        name: payload.name,
        type: 'different-type',
        scopes: payload.scopes,
        description: payload.description,
        owner: payload.owner,
        expiryDate: payload.expiryDate,
        roleRequired: payload.roleRequired
      }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await postAddFeatureControlHandler(mockRequest, mockH)

      expect(updateFeatureControlDefinition).not.toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.CONFLICT)
      expect(result).toBe(mockH)
    })

    it('should update definition when roleRequired changes', async () => {
      const existing = {
        ...payload,
        roleRequired: ['old.role']
      }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await postAddFeatureControlHandler(mockRequest, mockH)

      expect(updateFeatureControlDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          roleRequired: payload.roleRequired
        }),
        mockDb
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should handle undefined roleRequired in definition update', async () => {
      const { roleRequired, ...payloadNoRole } = payload
      const mockRequestNoRole = {
        ...mockRequest,
        payload: payloadNoRole
      }
      const existing = {
        ...payload,
        roleRequired: ['some-role']
      }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await postAddFeatureControlHandler(
        mockRequestNoRole,
        mockH
      )

      expect(updateFeatureControlDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          roleRequired: undefined
        }),
        mockDb
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })
  })

  describe('putUpdateFeatureControlValueHandler', () => {
    const payload = {
      name: 'ALLOW_LIST_WOODLANDS',
      value: [1, 2, 3],
      user: 'user1',
      note: 'test note'
    }
    const mockRequest = {
      payload,
      logger: mockLogger,
      db: mockDb
    }

    it('should update feature control value and return accepted', async () => {
      const existing = {
        name: payload.name,
        type: 'list-number',
        scopes: ['list', 'of', 'scopes']
      }
      getFeatureControlByName.mockResolvedValue(existing)
      updateFeatureControlValue.mockResolvedValue(existing)

      const result = await putUpdateFeatureControlValueHandler(
        mockRequest,
        mockH
      )

      expect(getFeatureControlByName).toHaveBeenCalledWith(payload.name, mockDb)
      expect(updateFeatureControlValue).toHaveBeenCalledWith(
        {
          name: payload.name,
          user: payload.user,
          value: payload.value,
          note: payload.note
        },
        mockDb
      )
      expect(notifyFeatureControlUpdate).toHaveBeenCalledWith(
        {
          name: payload.name,
          scopes: ['list', 'of', 'scopes'],
          value: payload.value,
          updatedBy: payload.user,
          valueType: existing.type
        },
        mockLogger
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should return not found if feature control does not exist', async () => {
      getFeatureControlByName.mockResolvedValue(null)

      const result = await putUpdateFeatureControlValueHandler(
        mockRequest,
        mockH
      )

      expect(updateFeatureControlValue).not.toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(result).toBe(mockH)
    })

    it('should return bad request if value does not match type (boolean case)', async () => {
      const booleanPayload = {
        name: 'MY_SPECIAL_FEATURE',
        value: 'ho ho ho',
        user: 'Aaron',
        note: 'Blummin felt like it'
      }
      const mockRequestBoolean = {
        payload: booleanPayload,
        logger: mockLogger,
        db: mockDb
      }
      getFeatureControlByName.mockResolvedValue({
        name: booleanPayload.name,
        type: 'boolean'
      })

      const result = await putUpdateFeatureControlValueHandler(
        mockRequestBoolean,
        mockH
      )

      expect(updateFeatureControlValue).not.toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid value for feature control')
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(result).toBe(mockH)
    })

    it('should return bad request if value does not match type (number case)', async () => {
      const numberPayload = {
        ...payload,
        value: 'not-a-number'
      }
      const mockRequestNumber = {
        ...mockRequest,
        payload: numberPayload
      }
      getFeatureControlByName.mockResolvedValue({
        name: payload.name,
        type: 'number'
      })

      const result = await putUpdateFeatureControlValueHandler(
        mockRequestNumber,
        mockH
      )

      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(result).toBe(mockH)
    })

    it('should update feature control value for string type', async () => {
      const stringPayload = {
        ...payload,
        value: 'a string'
      }
      const mockRequestString = {
        ...mockRequest,
        payload: stringPayload
      }
      getFeatureControlByName.mockResolvedValue({
        name: payload.name,
        type: 'string'
      })

      const result = await putUpdateFeatureControlValueHandler(
        mockRequestString,
        mockH
      )

      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })
  })

  describe('getFeatureControlByNameHandler', () => {
    it('should return feature control if found', async () => {
      const mockRequest = {
        params: { name: 'TEST_FEATURE' },
        db: mockDb
      }
      const existing = { name: 'TEST_FEATURE', value: true }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await getFeatureControlByNameHandler(mockRequest, mockH)

      expect(getFeatureControlByName).toHaveBeenCalledWith(
        'TEST_FEATURE',
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith(existing)
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.OK)
      expect(result).toBe(mockH)
    })

    it('should return not found if not found', async () => {
      const mockRequest = {
        params: { name: 'NOT_FOUND' },
        db: mockDb
      }
      getFeatureControlByName.mockResolvedValue(null)

      const result = await getFeatureControlByNameHandler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(result).toBe(mockH)
    })
  })

  describe('getFeatureControlsHandler', () => {
    it('should return paginated results', async () => {
      const query = { page: 1, pageSize: 10, name: 'test', owner: 'test-owner' }
      const mockRequest = { query, db: mockDb }
      const expectedResults = { items: [], total: 0 }
      getFeatureControls.mockResolvedValue(expectedResults)

      const result = await getFeatureControlsHandler(mockRequest, mockH)

      expect(getFeatureControls).toHaveBeenCalledWith(query, mockDb)
      expect(mockH.response).toHaveBeenCalledWith(expectedResults)
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.OK)
      expect(result).toBe(mockH)
    })
  })
})
