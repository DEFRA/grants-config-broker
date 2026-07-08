import { SNSClient } from '@aws-sdk/client-sns'
import { publishAuditEvent } from '@defra/fcp-audit-publisher'
import { config } from '../../../config.js'

const application = config.get('audit.application')
const region = config.get('aws.region')
const topicArn = config.get('aws.sns.fcpAuditTopicArn')
const component = config.get('serviceName')
const environment = config.get('cdpEnvironment')
const ip = config.get('host')

let snsClient

const getSnsClient = () => {
  if (!snsClient) {
    snsClient = new SNSClient({ region })
  }
  return snsClient
}

/**
 * Publishes an audit event to FCP audit service.
 * @param {Object} audit - The audit event details.
 * @param {String} user - The user who triggered the event.
 * @param {Logger} logger - The logger instance.
 */
export const publishEvent = async (audit, user, logger) => {
  if (!config.get('audit.enabled')) {
    logger.info('Auditing not enabled')
    return
  }

  const client = getSnsClient()

  const { messageId } = await publishAuditEvent(
    {
      audit,
      security: null
    },
    {
      snsClient: client,
      sns: { topicArn },
      application,
      component,
      environment,
      ip,
      user,
      generateCorrelationId: true
    }
  )
  logger.info(`Audit event published successfully (messageId: ${messageId})`)
}
