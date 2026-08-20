import {
  getFeatureControlDetailedByName,
  storeFeatureControl,
  updateFeatureControlDefinition
} from '../repositories/feature-control-repository.js'
import { addOrUpdateFeatureControlDefinition } from './feature-control-definition-processor.js'
import { notifyFeatureControlUpdate } from '../messaging/outbound/notify-feature-control.js'
import { StatusCodes } from 'http-status-codes'
import { publishEvent } from '../common/helpers/audit/event-publisher.js'

vi.mock('../repositories/feature-control-repository.js', () => ({
  getFeatureControlDetailedByName: vi.fn(),
  storeFeatureControl: vi.fn(),
  updateFeatureControlDefinition: vi.fn()
}))

vi.mock('../messaging/outbound/notify-feature-control.js', () => ({
  notifyFeatureControlUpdate: vi.fn()
}))

vi.mock('../common/helpers/audit/event-publisher.js', () => ({
  publishEvent: vi.fn()
}))

describe('Feature Control Definition Processor', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    setBindings: vi.fn()
  }
  const mockDb = {}

  describe('addOrUpdateFeatureControlDefinition', () => {
    const payload = {
      name: 'ALLOW_LIST_WOODLANDS',
      type: 'list-number',
      displayName: 'Allow list for woodland grant',
      initialValue: {
        default: [123],
        dev: [456]
      },
      scopes: ['grant.woodland'],
      description: 'Allow list for woodland grant',
      owner: 'Woodland team',
      expiryDate: new Date('2028-01-01'),
      createdBy: 'user1'
    }

    it('should store new feature control, emit notification and audit event, and return accepted', async () => {
      getFeatureControlDetailedByName.mockResolvedValue(null)

      const result = await addOrUpdateFeatureControlDefinition(
        { ...payload, currentEnv: 'dev', possibleRoleRequired: ['grant.view'] },
        mockDb,
        mockLogger
      )

      expect(getFeatureControlDetailedByName).toHaveBeenCalledWith(
        payload.name,
        mockDb
      )

      expect(storeFeatureControl).toHaveBeenCalledWith(
        expect.objectContaining({
          name: payload.name,
          type: payload.type,
          value: [456], // Uses 'dev' from mocked config
          scopes: payload.scopes,
          description: payload.description,
          owner: payload.owner,
          createdBy: payload.createdBy,
          roleRequired: ['grant.view']
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

      expect(publishEvent).toHaveBeenCalledWith(
        {
          entities: [
            {
              entity: 'feature-control',
              action: 'definition-update',
              entityid: payload.name
            }
          ],
          status: 'success',
          details: expect.objectContaining({
            name: payload.name,
            type: payload.type,
            value: [456],
            scopes: payload.scopes
          })
        },
        payload.createdBy,
        mockLogger
      )
      expect(result).toBe(StatusCodes.ACCEPTED)
    })

    it('should use default initial value if current environment is not present', async () => {
      const payloadNoDev = {
        ...payload,
        initialValue: {
          default: [123]
        }
      }

      getFeatureControlDetailedByName.mockResolvedValue(null)

      const result = await addOrUpdateFeatureControlDefinition(
        {
          ...payloadNoDev,
          currentEnv: 'dev',
          possibleRoleRequired: ['grant.view']
        },
        mockDb,
        mockLogger
      )

      expect(getFeatureControlDetailedByName).toHaveBeenCalledWith(
        payload.name,
        mockDb
      )

      expect(storeFeatureControl).toHaveBeenCalledWith(
        expect.objectContaining({
          value: [123]
        }),
        mockDb
      )

      expect(publishEvent).toHaveBeenCalled()

      expect(result).toBe(StatusCodes.ACCEPTED)
    })

    it('should update existing feature control definition if changed and return accepted', async () => {
      const existing = {
        name: payload.name,
        type: payload.type,
        displayName: payload.displayName,
        value: 'some-value',
        scopes: ['grant.old-scope'],
        description: 'old desc',
        owner: 'old owner',
        expiryDate: new Date('2027-01-01'),
        roleRequired: ['old.role'],
        history: []
      }
      getFeatureControlDetailedByName.mockResolvedValue(existing)
      const expectedUpdatedDefinition = {
        ...existing,
        scopes: payload.scopes,
        description: payload.description,
        owner: payload.owner,
        expiryDate: payload.expiryDate,
        roleRequired: ['grant.view'],
        lastUpdatedBy: payload.createdBy
      }

      updateFeatureControlDefinition.mockResolvedValue(
        expectedUpdatedDefinition
      )

      const result = await addOrUpdateFeatureControlDefinition(
        {
          ...payload,
          currentEnv: 'dev',
          possibleRoleRequired: ['grant.view']
        },
        mockDb,
        mockLogger
      )

      expect(updateFeatureControlDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          name: payload.name,
          scopes: payload.scopes,
          description: payload.description,
          owner: payload.owner,
          expiryDate: payload.expiryDate,
          createdBy: payload.createdBy,
          roleRequired: ['grant.view'],
          existingValue: existing.value,
          note: 'Definition updated',
          notificationEmitted: true
        }),
        mockDb
      )
      const call = updateFeatureControlDefinition.mock.calls[0][0]
      expect(call.changeToValue).toContain('Definition:')
      expect(call.changeToValue).toContain(
        'scopes: grant.old-scope ➜ grant.woodland'
      )
      expect(call.changeToValue).toContain(
        'roles: added: grant.view, removed: old.role'
      )
      expect(call.changeToValue).toContain(
        'description: old desc ➜ Allow list for woodland grant'
      )
      expect(call.changeToValue).toContain('owner: old owner ➜ Woodland team')
      expect(call.changeToValue).toContain('expiryDate:')
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

      const { history, ...expectedDetails } = expectedUpdatedDefinition // Exclude history for comparison

      expect(publishEvent).toHaveBeenCalledWith(
        {
          entities: [
            {
              entity: 'feature-control',
              action: 'definition-update',
              entityid: payload.name
            }
          ],
          status: 'success',
          details: expectedDetails
        },
        payload.createdBy,
        mockLogger
      )

      expect(result).toBe(StatusCodes.ACCEPTED)
    })

    it('should update existing feature control definition if only description changed and return accepted without emitting', async () => {
      const existing = {
        name: payload.name,
        type: payload.type,
        displayName: payload.displayName,
        scopes: payload.scopes,
        description: 'old desc',
        owner: payload.owner,
        expiryDate: payload.expiryDate,
        roleRequired: ['grant.view'],
        history: []
      }
      getFeatureControlDetailedByName.mockResolvedValue(existing)

      const expectedUpdatedDefinition = {
        ...existing,
        description: payload.description,
        lastUpdatedBy: payload.createdBy
      }

      updateFeatureControlDefinition.mockResolvedValue(
        expectedUpdatedDefinition
      )

      const result = await addOrUpdateFeatureControlDefinition(
        {
          ...payload,
          possibleRoleRequired: ['grant.view'],
          currentEnv: 'dev'
        },
        mockDb,
        mockLogger
      )

      expect(updateFeatureControlDefinition).toHaveBeenCalled()
      expect(publishEvent).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Not emitting')
      )

      expect(result).toBe(StatusCodes.ACCEPTED)
    })

    it('should return no content if existing feature control definition is unchanged', async () => {
      const existing = {
        name: payload.name,
        type: payload.type,
        displayName: payload.displayName,
        scopes: payload.scopes,
        description: payload.description,
        owner: payload.owner,
        expiryDate: payload.expiryDate,
        roleRequired: ['grant.view'],
        history: []
      }
      getFeatureControlDetailedByName.mockResolvedValue(existing)

      const result = await addOrUpdateFeatureControlDefinition(
        {
          ...payload,
          possibleRoleRequired: ['grant.view'],
          currentEnv: 'dev'
        },
        mockDb,
        mockLogger
      )

      expect(updateFeatureControlDefinition).not.toHaveBeenCalled()
      expect(publishEvent).not.toHaveBeenCalled()
      expect(result).toBe(StatusCodes.NO_CONTENT)
    })

    it('should return conflict if immutable field (type) is changed', async () => {
      const existing = {
        name: payload.name,
        type: 'different-type',
        displayName: payload.displayName,
        scopes: payload.scopes,
        description: payload.description,
        owner: payload.owner,
        expiryDate: payload.expiryDate,
        roleRequired: ['grant.view']
      }
      getFeatureControlDetailedByName.mockResolvedValue(existing)

      const result = await addOrUpdateFeatureControlDefinition(
        {
          ...payload,
          possibleRoleRequired: ['grant.view'],
          currentEnv: 'dev'
        },
        mockDb,
        mockLogger
      )

      expect(updateFeatureControlDefinition).not.toHaveBeenCalled()
      expect(publishEvent).not.toHaveBeenCalled()
      expect(result).toBe(StatusCodes.CONFLICT)
    })
  })
})
