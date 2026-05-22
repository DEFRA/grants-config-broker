const schema = {
  asyncapi: '3.0.0',
  info: {
    title: 'Grants Config Broker SNS Notifications',
    version: '1.0.0',
    description:
      'This AsyncAPI document describes the SNS notifications emitted by the Grants Config Broker\nwhen a new version of a grant configuration is released or its status is updated.\n\nThe notification contains the manifest (list of file paths in S3) and metadata about the release.\n'
  },
  servers: {
    sns: {
      host: 'sns.{region}.amazonaws.com',
      protocol: 'sns',
      description: 'AWS SNS Server',
      variables: {
        region: {
          default: 'eu-west-2',
          description: 'The AWS region where the SNS topic is located.'
        }
      }
    }
  },
  channels: {
    configUpdateTopic: {
      address: 'arn:aws:sns:{region}:{account-id}:{topic-name}',
      description:
        'The SNS topic where configuration update messages are published.',
      messages: {
        configUpdateMessage: {
          name: 'ConfigUpdateMessage',
          title: 'Configuration Update Notification',
          summary:
            'Message sent when a grant configuration version is created or updated.',
          payload: {
            type: 'array',
            description:
              'A list of S3 file paths that make up the configuration version.',
            items: {
              type: 'string',
              example: 'example-grant/1.0.0/config.json',
              'x-parser-schema-id': '<anonymous-schema-6>'
            },
            'x-parser-schema-id': 'Manifest'
          },
          headers: {
            type: 'object',
            description: 'SNS Message Attributes (metadata).',
            properties: {
              grant: {
                type: 'string',
                description: 'The name of the grant.',
                example: 'example-grant',
                'x-parser-schema-id': '<anonymous-schema-1>'
              },
              version: {
                type: 'string',
                description: 'The version string of the configuration.',
                example: '1.0.0',
                'x-parser-schema-id': '<anonymous-schema-2>'
              },
              status: {
                type: 'string',
                enum: ['draft', 'active'],
                description: 'The status of the configuration version.',
                example: 'active',
                'x-parser-schema-id': '<anonymous-schema-3>'
              },
              path: {
                type: 'string',
                description: 'The S3 bucket name where the files are stored.',
                example: 'cdp-grants-config-broker-dev',
                'x-parser-schema-id': '<anonymous-schema-4>'
              },
              isLatest: {
                type: 'string',
                enum: ['true', 'false'],
                description:
                  'Whether this version is the latest for the given grant and status.',
                example: 'true',
                'x-parser-schema-id': '<anonymous-schema-5>'
              }
            },
            required: ['grant', 'version', 'status', 'path', 'isLatest'],
            'x-parser-schema-id': 'MessageAttributes'
          },
          'x-parser-unique-object-id': 'configUpdateMessage'
        }
      },
      'x-parser-unique-object-id': 'configUpdateTopic'
    }
  },
  operations: {
    receiveConfigUpdate: {
      action: 'receive',
      channel: '$ref:$.channels.configUpdateTopic',
      summary: 'Receive notification about a grant configuration update.',
      messages: [
        '$ref:$.channels.configUpdateTopic.messages.configUpdateMessage'
      ],
      'x-parser-unique-object-id': 'receiveConfigUpdate'
    }
  },
  components: {
    messages: {
      ConfigUpdateMessage:
        '$ref:$.channels.configUpdateTopic.messages.configUpdateMessage'
    },
    schemas: {
      Manifest:
        '$ref:$.channels.configUpdateTopic.messages.configUpdateMessage.payload',
      MessageAttributes:
        '$ref:$.channels.configUpdateTopic.messages.configUpdateMessage.headers'
    }
  },
  'x-parser-spec-parsed': true,
  'x-parser-api-version': 3,
  'x-parser-spec-stringified': true
}
const config = {
  show: { sidebar: true },
  sidebar: { showOperations: 'byDefault' }
}
const appRoot = document.getElementById('root')
AsyncApiStandalone.render({ schema, config }, appRoot)
