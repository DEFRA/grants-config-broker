import { randomUUID } from 'node:crypto'
import { config } from '../../config.js'
import { metricsCounter } from '../../common/helpers/metrics.js'
import {
  isClientSetup,
  publishFIFOMessage,
  setupClient
} from '@defra/grants-config-utils/sns-client'

const featureControlTopicArn = config.get(
  'aws.sns.featureControlUpdateTopicArn'
)

export const notifyFeatureControlUpdate = async (notifyDetails, logger) => {
  if (!isClientSetup()) {
    setupClient(logger.child({}), {
      region: config.get('aws.region'),
      endpoint: config.get('aws.endpointUrl'),
      publishToTopic: featureControlTopicArn
    })
  }
  const { value, ...rest } = notifyDetails

  await publishFIFOMessage(
    value,
    notifyDetails.name,
    randomUUID(),
    rest,
    featureControlTopicArn
  )

  await metricsCounter('notification_feature-control')

  //TODO: Add the audit event publishing here. GRAN-72. (user is in the notifyDetails object)
}
