import { SNSClient } from '@aws-sdk/client-sns'
import { publishAuditEvent } from '@defra/fcp-audit-publisher'
import { config } from '../../../config.js'

const application = config.get('audit.application')
const region = config.get('aws.region')
const topicArn = config.get('aws.sns.fcpAuditTopicArn')
const component = config.get('serviceName')
const environment = config.get('cdpEnvironment')
const ip = config.get('host')
const user = ''

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
 * @param logger - The logger instance.
 * @returns {Promise<Object>} The result of the publication.
 */
export const publishEvent = async (audit, logger) => {
  if (!config.get('audit.enabled')) {
    logger?.info('Auditing not enabled')
    return
  }

  const client = getSnsClient()

  return publishAuditEvent(
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
}
