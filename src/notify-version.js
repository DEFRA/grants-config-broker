import { publishMessage, setupClient } from './common/helpers/sns-client.js'
import { config } from './config.js'

export const notifyVersion = async (notifyDetails, logger) => {
  setupClient(
    config.get('aws.region'),
    config.get('aws.endpointUrl'),
    logger.child({}),
    config.get('aws.sns.configUpdateTopicArn')
  )

  const { manifest, ...rest } = notifyDetails
  await publishMessage(manifest, rest)
}
