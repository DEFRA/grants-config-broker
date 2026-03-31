import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { publishMessage, setupClient } from './sns-client.js'
import { metricsCounter } from './metrics.js'

vi.mock('./metrics.js')
vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn(),
  PublishCommand: vi.fn()
}))

const mockLogger = {
  info: vi.fn(),
  error: vi.fn()
}

const topicArn = 'arn:aws:sns:us-east-1:123456789012:MyTopic'

describe('publish', () => {
  it('error thrown if client not set up', async () => {
    const message = {
      key: 'value'
    }

    const send = vi.fn()

    SNSClient.mockReturnValue({
      send
    })

    await expect(publishMessage(message)).rejects.toThrow(
      'SNS client not setup. Call setupClient() before publishing messages.'
    )

    expect(PublishCommand).toHaveBeenCalledTimes(0)

    expect(send).toHaveBeenCalledTimes(0)
  })

  it('publishes a message to a topic', async () => {
    const message = {
      key: 'value'
    }

    const send = vi.fn()

    SNSClient.mockImplementation(function () {
      return { send }
    })

    PublishCommand.mockImplementation(function (params) {
      return params
    })
    setupClient('us-east-1', 'http://localhost:4566', mockLogger, topicArn)

    await publishMessage(message)

    expect(PublishCommand).toHaveBeenCalledWith({
      TopicArn: topicArn,
      Message: '{"key":"value"}',
      MessageAttributes: {}
    })

    expect(send).toHaveBeenCalledWith({
      TopicArn: topicArn,
      Message: '{"key":"value"}',
      MessageAttributes: {}
    })

    expect(metricsCounter).toHaveBeenCalledWith(
      'notification_published-version'
    )
  })

  it('publishes a message including custom message attribute', async () => {
    const message = {
      key: 'value'
    }

    const send = vi.fn()

    SNSClient.mockImplementation(function () {
      return { send }
    })

    PublishCommand.mockImplementation(function (params) {
      return params
    })
    setupClient('us-east-1', 'http://localhost:4566', mockLogger, topicArn)

    await publishMessage(
      message,
      { customAttribute: 'customValue' },
      'specialTopicArn'
    )

    expect(PublishCommand).toHaveBeenCalledWith({
      TopicArn: 'specialTopicArn',
      Message: '{"key":"value"}',
      MessageAttributes: {
        customAttribute: {
          DataType: 'String',
          StringValue: 'customValue'
        }
      }
    })

    expect(send).toHaveBeenCalledWith({
      TopicArn: 'specialTopicArn',
      Message: '{"key":"value"}',
      MessageAttributes: {
        customAttribute: {
          DataType: 'String',
          StringValue: 'customValue'
        }
      }
    })
    expect(metricsCounter).toHaveBeenCalledWith(
      'notification_published-version'
    )
  })
})
