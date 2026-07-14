import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyFeatureControlUpdate } from './notify-feature-control.js'
import {
  isClientSetup,
  publishFIFOMessage,
  setupClient
} from '@defra/grants-config-utils/sns-client'
import { metricsCounter } from '../../common/helpers/metrics.js'

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid')
}))

vi.mock('@defra/grants-config-utils/sns-client', () => ({
  isClientSetup: vi.fn(),
  publishFIFOMessage: vi.fn(),
  setupClient: vi.fn()
}))

vi.mock('../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'aws.sns.featureControlUpdateTopicArn') {
        return 'arn:test:topic.fifo'
      }
      if (key === 'aws.region') return 'eu-west-2'
      if (key === 'aws.endpointUrl') return 'http://localhost:4566'
      return null
    })
  }
}))

vi.mock('../../common/helpers/metrics.js', () => ({
  metricsCounter: vi.fn()
}))

describe('notify-feature-control', () => {
  const mockLogger = {
    child: vi.fn().mockReturnThis()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should setup client if not already setup', async () => {
    isClientSetup.mockReturnValue(false)
    const notifyDetails = { name: 'TEST', value: true, other: 'attr' }

    await notifyFeatureControlUpdate(notifyDetails, mockLogger)

    expect(setupClient).toHaveBeenCalledWith(expect.any(Object), {
      region: 'eu-west-2',
      endpoint: 'http://localhost:4566',
      publishToTopic: 'arn:test:topic.fifo'
    })
  })

  it('should not setup client if already setup', async () => {
    isClientSetup.mockReturnValue(true)
    const notifyDetails = { name: 'TEST', value: true }

    await notifyFeatureControlUpdate(notifyDetails, mockLogger)

    expect(setupClient).not.toHaveBeenCalled()
  })

  it('should publish FIFO message with value and attributes', async () => {
    isClientSetup.mockReturnValue(true)
    const notifyDetails = {
      name: 'TEST_FEATURE',
      value: 'some-value',
      scopes: ['s1'],
      updatedBy: 'user1'
    }

    await notifyFeatureControlUpdate(notifyDetails, mockLogger)

    expect(publishFIFOMessage).toHaveBeenCalledWith(
      'some-value',
      'TEST_FEATURE',
      'test-uuid',
      {
        name: 'TEST_FEATURE',
        scopes: ['s1'],
        updatedBy: 'user1'
      },
      'arn:test:topic.fifo'
    )
    expect(metricsCounter).toHaveBeenCalledWith('notification_feature-control')
  })
})
