import { config } from '../../config.js'
import { processInputMessage } from './process-message.js'
import { getLogger } from '../../common/helpers/logging/logger.js'
import { SqsSubscriber } from '../../common/helpers/sqs/sqs-subscriber.js'

let inputMessageSubscriber

export async function configureAndStartMessaging(db, server) {
  const onMessage = async (message, attributes) => {
    getLogger().info(attributes, 'Received incoming message')
    await processInputMessage(message, db, getLogger(), attributes)
  }
  inputMessageSubscriber = new SqsSubscriber({
    queueUrl: config.get('aws.sqs.configInputQueueUrl'),
    logger: getLogger(),
    region: config.get('aws.region'),
    awsEndpointUrl: config.get('aws.endpointUrl'),
    onMessage
  })
  server.method({
    name: 'sendMessage',
    method: async (message) => await inputMessageSubscriber.sendMessage(message)
  })
  await inputMessageSubscriber.start()
  return onMessage
}

export async function stopMessageSubscriber() {
  if (inputMessageSubscriber) {
    await inputMessageSubscriber.stop()
  }
}
