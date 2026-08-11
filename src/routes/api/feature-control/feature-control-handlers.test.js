import {
  getFeatureControlByNameHandler,
  getFeatureControlsHandler,
  postAddFeatureControlHandler,
  putUpdateFeatureControlValueHandler
} from './feature-control-handlers.js'
import { StatusCodes } from 'http-status-codes'
import {
  getFeatureControlByName,
  getFeatureControls,
  updateFeatureControlValue
} from '../../../repositories/feature-control-repository.js'
import { notifyFeatureControlUpdate } from '../../../messaging/outbound/notify-feature-control.js'
import { addOrUpdateFeatureControlDefinition } from '../../../service/feature-control-definition-processor.js'
import { publishEvent } from '../../../common/helpers/audit/event-publisher.js'

vi.mock('../../../repositories/feature-control-repository.js', () => ({
  getFeatureControlByName: vi.fn(),
  getFeatureControls: vi.fn(),
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

vi.mock('../../../service/feature-control-definition-processor.js')

vi.mock('../../../common/helpers/audit/event-publisher.js', () => ({
  publishEvent: vi.fn()
}))

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
      roleRequired: { default: ['grant.view'] }
    }
    const mockRequest = {
      payload,
      logger: mockLogger,
      db: mockDb
    }

    it('should return unprocessable entity if current env is not included in environments field', async () => {
      const payloadWithEnvs = {
        ...payload,
        environments: ['perf-test']
      }
      const mockRequestWithEnvs = {
        payload: payloadWithEnvs,
        logger: mockLogger,
        db: mockDb
      }

      const result = await postAddFeatureControlHandler(
        mockRequestWithEnvs,
        mockH
      )

      expect(addOrUpdateFeatureControlDefinition).not.toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY)
      expect(result).toBe(mockH)
    })

    it('should handle undefined roleRequired in definition update and return status code form addOrUpdate function', async () => {
      addOrUpdateFeatureControlDefinition.mockResolvedValue(
        StatusCodes.ACCEPTED
      )
      const { roleRequired, ...payloadNoRole } = payload
      const mockRequestNoRole = {
        ...mockRequest,
        payload: payloadNoRole
      }

      const result = await postAddFeatureControlHandler(
        mockRequestNoRole,
        mockH
      )

      expect(addOrUpdateFeatureControlDefinition).toHaveBeenCalledWith(
        {
          ...mockRequestNoRole.payload,
          possibleRoleRequired: null,
          currentEnv: 'dev'
        },
        mockDb,
        mockLogger
      )

      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should handle specific roleRequired in definition update and return status code form addOrUpdate function', async () => {
      addOrUpdateFeatureControlDefinition.mockResolvedValue(
        StatusCodes.ACCEPTED
      )
      const { roleRequired, ...payloadNoRole } = payload
      const mockRequestNoRole = {
        ...mockRequest,
        payload: {
          ...payloadNoRole,
          roleRequired: {
            dev: ['grant.update', 'grant.admin'],
            default: ['grant.view']
          }
        }
      }

      const result = await postAddFeatureControlHandler(
        mockRequestNoRole,
        mockH
      )

      expect(addOrUpdateFeatureControlDefinition).toHaveBeenCalledWith(
        {
          ...mockRequestNoRole.payload,
          possibleRoleRequired: ['grant.update', 'grant.admin'],
          currentEnv: 'dev'
        },
        mockDb,
        mockLogger
      )

      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should handle default roleRequired in definition update and return status code form addOrUpdate function', async () => {
      addOrUpdateFeatureControlDefinition.mockResolvedValue(
        StatusCodes.ACCEPTED
      )
      const mockRequestNoRole = {
        ...mockRequest,
        payload
      }

      const result = await postAddFeatureControlHandler(
        mockRequestNoRole,
        mockH
      )

      expect(addOrUpdateFeatureControlDefinition).toHaveBeenCalledWith(
        {
          ...mockRequestNoRole.payload,
          possibleRoleRequired: ['grant.view'],
          currentEnv: 'dev'
        },
        mockDb,
        mockLogger
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
        scopes: ['list', 'of', 'scopes'],
        value: [1, 2, 3, 4]
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
          note: payload.note,
          changeToValue: 'Removed: 4',
          notificationEmitted: true
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
      expect(publishEvent).toHaveBeenCalledWith(
        {
          entities: [
            {
              entity: 'feature-control',
              action: 'value-update',
              entityid: payload.name
            }
          ],
          status: 'success',
          details: {
            value: payload.value
          }
        },
        payload.user,
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

    it('should return not found when control exists but has a status of expired', async () => {
      const mockRequest = {
        params: { name: 'EXPIRED_FEATURE' },
        db: mockDb
      }
      // getFeatureControlByName filters by status: 'active', so it returns null for expired ones
      getFeatureControlByName.mockResolvedValue(null)

      const result = await getFeatureControlByNameHandler(mockRequest, mockH)

      expect(getFeatureControlByName).toHaveBeenCalledWith(
        'EXPIRED_FEATURE',
        mockDb
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(result).toBe(mockH)
    })
  })

  describe('getFeatureControlsHandler', () => {
    it('should return paginated results', async () => {
      const query = {
        page: 1,
        pageSize: 10,
        name: 'test',
        displayName: 'Test display name',
        owner: 'test-owner',
        status: 'active'
      }
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
