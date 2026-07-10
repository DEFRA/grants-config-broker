import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SNSClient } from '@aws-sdk/client-sns'
import { publishAuditEvent } from '@defra/fcp-audit-publisher'
import { config } from '../../../config.js'

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn()
}))

vi.mock('@defra/fcp-audit-publisher', () => ({
  publishAuditEvent: vi.fn()
}))

vi.mock('../system/get-ip-address.js', () => ({
  getServiceIp: vi.fn(() => '192.168.0.50')
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const mocks = {
        'aws.region': 'eu-west-2',
        'aws.sns.fcpAuditTopicArn': 'arn:aws:sns:eu-west-2:000000000000:my-sns',
        'audit.enabled': true,
        'audit.application': 'my-app',
        serviceName: 'my-service',
        cdpEnvironment: 'local',
        host: '0.0.0.0'
      }
      return mocks[key]
    })
  }
}))

describe('event-publisher', () => {
  let publishEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    // Re-import the module to get a fresh singleton state
    const module = await import('./event-publisher.js')
    publishEvent = module.publishEvent
  })

  it('should publish an audit event with correct parameters', async () => {
    const mockUser = 'system'
    const mockAudit = {
      entities: [{ entity: 'entity', action: 'action', entityid: '123' }]
    }
    const mockLogger = { info: vi.fn() }
    const mockResult = { messageId: 'msg-123' }
    publishAuditEvent.mockResolvedValue(mockResult)

    await publishEvent(mockAudit, mockUser, mockLogger)

    expect(SNSClient).toHaveBeenCalledTimes(1)
    expect(SNSClient).toHaveBeenCalledWith({ region: 'eu-west-2' })
    expect(publishAuditEvent).toHaveBeenCalledWith(
      {
        user: mockUser,
        audit: mockAudit,
        security: null
      },
      expect.objectContaining({
        sns: { topicArn: 'arn:aws:sns:eu-west-2:000000000000:my-sns' },
        version: '1.0.1',
        application: 'my-app',
        component: 'my-service',
        environment: 'local',
        ip: '192.168.0.50',
        generateCorrelationId: true
      })
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event published successfully (messageId: msg-123)'
    )
  })

  it('should reuse the SNSClient instance', async () => {
    const mockUser = 'system'
    const mockAudit = { entities: [] }
    const mockLogger = { info: vi.fn() }
    publishAuditEvent.mockResolvedValue({})

    await publishEvent(mockAudit, mockUser, mockLogger)
    await publishEvent(mockAudit, mockUser, mockLogger)

    expect(SNSClient).toHaveBeenCalledTimes(1)
  })

  it('should not publish if auditing is disabled', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'audit.enabled') return false
      const mocks = {
        'aws.region': 'eu-west-2',
        'aws.sns.fcpAuditTopicArn': 'arn:aws:sns:eu-west-2:000000000000:my-sns',
        'audit.application': 'my-app',
        serviceName: 'my-service',
        cdpEnvironment: 'local',
        host: '0.0.0.0'
      }
      return mocks[key]
    })

    const mockUser = 'system'
    const mockAudit = { entities: [] }
    const mockLogger = { info: vi.fn() }

    await publishEvent(mockAudit, mockUser, mockLogger)

    expect(publishAuditEvent).not.toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith('Auditing not enabled')
  })

  it('should log an error message when publishing fails', async () => {
    config.get.mockReturnValue(true)
    const mockUser = 'system'
    const mockAudit = {
      entities: [{ entity: 'entity', action: 'action', entityid: '123' }]
    }
    const mockLogger = { info: vi.fn(), error: vi.fn() }
    publishAuditEvent.mockRejectedValue(new Error('SNS Error'))

    await publishEvent(mockAudit, mockUser, mockLogger)

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to publish audit event, first entity: {"entity":"entity","action":"action","entityid":"123"}'
    )
  })
})
