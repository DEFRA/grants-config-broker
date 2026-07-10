import {
  postAddFeatureControlHandler,
  putUpdateFeatureControlValueHandler
} from './feature-control-handlers.js'
import { StatusCodes } from 'http-status-codes'

vi.mock('../../../repositories/feature-control-repository.js', () => ({
  getFeatureControlByName: vi.fn(),
  storeFeatureControl: vi.fn(),
  updateFeatureControlDefinition: vi.fn(),
  updateFeatureControlValue: vi.fn()
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn().mockReturnValue('dev')
  }
}))

import {
  getFeatureControlByName,
  storeFeatureControl,
  updateFeatureControlDefinition,
  updateFeatureControlValue
} from '../../../repositories/feature-control-repository.js'

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
      expiryDate: '2028-01-01',
      createdBy: 'user1'
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
        value: 'some-value',
        scopes: ['old.scope'],
        description: 'old desc',
        owner: 'old owner',
        expiryDate: '2027-01-01'
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
          existingValue: existing.value
        }),
        mockDb
      )
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(result).toBe(mockH)
    })

    it('should update existing feature control definition if only description changed and return accepted without emitting', async () => {
      const existing = {
        name: payload.name,
        scopes: payload.scopes,
        description: 'old desc',
        owner: payload.owner,
        expiryDate: payload.expiryDate
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

    it('should return conflict if existing feature control definition is unchanged', async () => {
      const existing = {
        name: payload.name,
        scopes: payload.scopes,
        description: payload.description,
        owner: payload.owner,
        expiryDate: payload.expiryDate
      }
      getFeatureControlByName.mockResolvedValue(existing)

      const result = await postAddFeatureControlHandler(mockRequest, mockH)

      expect(updateFeatureControlDefinition).not.toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.CONFLICT)
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
      getFeatureControlByName.mockResolvedValue({ name: payload.name })

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
  })
})
