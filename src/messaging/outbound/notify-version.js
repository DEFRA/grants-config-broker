import { config } from '../../config.js'
import { metricsCounter } from '../../common/helpers/metrics.js'
import { publishEvent } from '../../common/helpers/audit/event-publisher.js'
import {
  isClientSetup,
  publishMessage,
  setupClient
} from '@defra/grants-config-utils/sns-client'

export const notifyVersion = async (notifyDetails, user, logger) => {
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

  const audit = {
    entities: [
      {
        entity: 'configuration',
        action: 'released',
        entityid: `${notifyDetails.grant}:${notifyDetails.version}`
      }
    ],
    status: 'success',
    details: {
      grant: notifyDetails.grant,
      configVersion: notifyDetails.version,
      configStatus: notifyDetails.status
    }
  }
  await publishEvent(audit, user, logger)
}
