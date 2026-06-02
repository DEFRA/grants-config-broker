import { config } from '../../config.js'
import { metricsCounter } from '../../common/helpers/metrics.js'
import {
  isClientSetup,
  publishMessage,
  setupClient
} from '@defra/grants-config-utils/sns-client'

export const notifyVersion = async (notifyDetails, logger) => {
  if (!isClientSetup()) {
    setupClient(logger.child({}), {
      region: config.get('aws.region'),
      endpoint: config.get('aws.endpointUrl'),
      publishToTopic: config.get('aws.sns.configUpdateTopicArn')
    })
  }

  const { manifest, versionMajor, versionMinor, versionPatch, ...rest } =
    notifyDetails
  await publishMessage(manifest, rest)
  await metricsCounter('notification_published-version')
}
