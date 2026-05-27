import {
  configureAndStartMessaging,
  stopMessageSubscriber
} from './input-message-queue-subscriber.js'
import { getLogger } from '../../common/helpers/logging/logger.js'
import { SqsSubscriber } from '../../common/helpers/sqs/sqs-subscriber.js'
import { config } from '../../config.js'
import { processInputMessage } from './process-message.js'

vi.mock('../../common/helpers/logging/logger.js')
vi.mock('../../common/helpers/sqs/sqs-subscriber.js')
vi.mock('./process-message.js')

const mockServer = {
  method: vi.fn()
}

describe('MessageRequestQueueSubscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.set(
      'aws.sqs.configInputQueueUrl',
      'http://localhost:4576/queue/config-input-queue'
    )
    config.set('aws.region', 'eu-west-2')
    config.set('aws.endpointUrl', 'http://localhost:4576')
  })

  describe('configureAndStartMessaging', () => {
    it('should configure and start the SQS subscriber', async () => {
      const mockLogger = vi.fn()
      getLogger.mockReturnValueOnce(mockLogger)
      const mockDb = {}

      await configureAndStartMessaging(mockDb, mockServer)

      expect(SqsSubscriber).toHaveBeenCalledTimes(1)
      expect(SqsSubscriber).toHaveBeenCalledWith({
        awsEndpointUrl: 'http://localhost:4576',
        logger: mockLogger,
        region: 'eu-west-2',
        queueUrl: 'http://localhost:4576/queue/config-input-queue',
        onMessage: expect.any(Function)
      })
      expect(SqsSubscriber.mock.instances[0].start).toHaveBeenCalledTimes(1)
      expect(mockServer.method).toHaveBeenCalledTimes(1)
      expect(mockServer.method).toHaveBeenCalledWith({
        name: 'sendMessage',
        method: expect.any(Function)
      })
    })

    it('should pass message on via onmessage function', async () => {
      const mockLogger = { info: vi.fn() }
      getLogger.mockReturnValue(mockLogger)
      processInputMessage.mockResolvedValueOnce()
      const mockDb = {}

      const onMessage = await configureAndStartMessaging(mockDb, mockServer)

      await onMessage({ claimRef: 'ABC123', sbi: '123456789' }, {})

      expect(mockLogger.info).toHaveBeenCalledTimes(1)
      expect(processInputMessage).toHaveBeenCalledTimes(1)
    })
  })

  describe('stopMessageSubscriber', () => {
    it('should stop the SQS subscriber', async () => {
      const mockLogger = vi.fn()
      getLogger.mockReturnValueOnce(mockLogger)
      const mockDb = {}

      await configureAndStartMessaging(mockDb, mockServer)

      await stopMessageSubscriber()

      const subscriberInstance = SqsSubscriber.mock.instances[0]

      expect(subscriberInstance.stop).toHaveBeenCalledTimes(1)
    })

    it('should do nothing if the SQS subscriber is not present', async () => {
      const mockLogger = vi.fn()
      getLogger.mockReturnValueOnce(mockLogger)

      await stopMessageSubscriber()

      const subscriberInstance = SqsSubscriber.mock.instances[0]

      expect(subscriberInstance).toBeUndefined()
    })
  })
})
