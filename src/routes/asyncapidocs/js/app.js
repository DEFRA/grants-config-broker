
    const schema = {
  "asyncapi": "3.0.0",
  "info": {
    "title": "Grants Config Broker SNS Notifications",
    "version": "1.0.0",
    "description": "This AsyncAPI document describes the SNS notifications emitted by the Grants Config Broker\nwhen a new version of a grant configuration is released, its status is updated, or when\nfeature controls are added or updated.\n\nThe config update notification contains the manifest (list of file paths in S3) and metadata about the release.\nThe feature control update notification contains the current value and metadata for a feature control.\n"
  },
  "servers": {
    "sns": {
      "host": "sns.{region}.amazonaws.com",
      "protocol": "sns",
      "description": "AWS SNS Server",
      "variables": {
        "region": {
          "default": "eu-west-2",
          "description": "The AWS region where the SNS topic is located."
        }
      }
    }
  },
  "channels": {
    "configUpdateTopic": {
      "address": "arn:aws:sns:{region}:{account-id}:{topic-name}",
      "description": "The SNS topic where configuration update messages are published.",
      "messages": {
        "configUpdateMessage": {
          "name": "ConfigUpdateMessage",
          "title": "Configuration Update Notification",
          "summary": "Message sent when a grant configuration version is created or updated.",
          "payload": {
            "type": "array",
            "description": "A list of S3 file paths that make up the configuration version.",
            "items": {
              "type": "string",
              "example": "example-grant/1.0.0/config.json",
              "x-parser-schema-id": "<anonymous-schema-6>"
            },
            "x-parser-schema-id": "Manifest"
          },
          "headers": {
            "type": "object",
            "description": "SNS Message Attributes (metadata).",
            "properties": {
              "grant": {
                "type": "string",
                "description": "The name of the grant.",
                "example": "example-grant",
                "x-parser-schema-id": "<anonymous-schema-1>"
              },
              "version": {
                "type": "string",
                "description": "The version string of the configuration.",
                "example": "1.0.0",
                "x-parser-schema-id": "<anonymous-schema-2>"
              },
              "status": {
                "type": "string",
                "enum": [
                  "draft",
                  "active"
                ],
                "description": "The status of the configuration version.",
                "example": "active",
                "x-parser-schema-id": "<anonymous-schema-3>"
              },
              "path": {
                "type": "string",
                "description": "The S3 bucket name where the files are stored.",
                "example": "cdp-grants-config-broker-dev",
                "x-parser-schema-id": "<anonymous-schema-4>"
              },
              "isLatest": {
                "type": "string",
                "enum": [
                  "true",
                  "false"
                ],
                "description": "Whether this version is the latest for the given grant and status.",
                "example": "true",
                "x-parser-schema-id": "<anonymous-schema-5>"
              }
            },
            "required": [
              "grant",
              "version",
              "status",
              "path",
              "isLatest"
            ],
            "x-parser-schema-id": "MessageAttributes"
          },
          "x-parser-unique-object-id": "configUpdateMessage"
        }
      },
      "x-parser-unique-object-id": "configUpdateTopic"
    },
    "featureControlUpdateTopic": {
      "address": "arn:aws:sns:{region}:{account-id}:{topic-name}.fifo",
      "description": "The FIFO SNS topic where feature control update messages are published.",
      "messages": {
        "featureControlUpdateMessage": {
          "name": "FeatureControlUpdateMessage",
          "title": "Feature Control Update Notification",
          "summary": "Message sent when a feature control is added or its value is updated.",
          "payload": {
            "oneOf": [
              {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-12>"
              },
              {
                "type": "number",
                "x-parser-schema-id": "<anonymous-schema-13>"
              },
              {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-14>"
              },
              {
                "type": "array",
                "items": {
                  "type": "string",
                  "x-parser-schema-id": "<anonymous-schema-16>"
                },
                "x-parser-schema-id": "<anonymous-schema-15>"
              },
              {
                "type": "array",
                "items": {
                  "type": "number",
                  "x-parser-schema-id": "<anonymous-schema-18>"
                },
                "x-parser-schema-id": "<anonymous-schema-17>"
              }
            ],
            "description": "The current value of the feature control.",
            "example": true,
            "x-parser-schema-id": "FeatureControlValue"
          },
          "headers": {
            "type": "object",
            "description": "SNS Message Attributes for Feature Control (metadata).",
            "properties": {
              "name": {
                "type": "string",
                "description": "The name of the feature control.",
                "example": "ENABLE_NEW_FEATURE",
                "x-parser-schema-id": "<anonymous-schema-7>"
              },
              "scopes": {
                "type": "array",
                "description": "The scopes affected by this feature control.",
                "items": {
                  "type": "string",
                  "x-parser-schema-id": "<anonymous-schema-9>"
                },
                "example": [
                  "grant.woodland",
                  "service.grants-ui",
                  "feature.enablers"
                ],
                "x-parser-schema-id": "<anonymous-schema-8>"
              },
              "valueType": {
                "type": "string",
                "enum": [
                  "string",
                  "number",
                  "boolean",
                  "list-string",
                  "list-number"
                ],
                "description": "The type of the value.",
                "example": "boolean",
                "x-parser-schema-id": "<anonymous-schema-10>"
              },
              "updatedBy": {
                "type": "string",
                "description": "The user who updated the feature control.",
                "example": "aaron.carroll",
                "x-parser-schema-id": "<anonymous-schema-11>"
              }
            },
            "required": [
              "name",
              "scopes",
              "valueType",
              "updatedBy"
            ],
            "x-parser-schema-id": "FeatureControlMessageAttributes"
          },
          "x-parser-unique-object-id": "featureControlUpdateMessage"
        }
      },
      "x-parser-unique-object-id": "featureControlUpdateTopic"
    }
  },
  "operations": {
    "receiveConfigUpdate": {
      "action": "receive",
      "channel": "$ref:$.channels.configUpdateTopic",
      "summary": "Receive notification about a grant configuration update.",
      "messages": [
        "$ref:$.channels.configUpdateTopic.messages.configUpdateMessage"
      ],
      "x-parser-unique-object-id": "receiveConfigUpdate"
    },
    "receiveFeatureControlUpdate": {
      "action": "receive",
      "channel": "$ref:$.channels.featureControlUpdateTopic",
      "summary": "Receive notification about a feature control update.",
      "messages": [
        "$ref:$.channels.featureControlUpdateTopic.messages.featureControlUpdateMessage"
      ],
      "x-parser-unique-object-id": "receiveFeatureControlUpdate"
    }
  },
  "components": {
    "messages": {
      "ConfigUpdateMessage": "$ref:$.channels.configUpdateTopic.messages.configUpdateMessage",
      "FeatureControlUpdateMessage": "$ref:$.channels.featureControlUpdateTopic.messages.featureControlUpdateMessage"
    },
    "schemas": {
      "Manifest": "$ref:$.channels.configUpdateTopic.messages.configUpdateMessage.payload",
      "MessageAttributes": "$ref:$.channels.configUpdateTopic.messages.configUpdateMessage.headers",
      "FeatureControlValue": "$ref:$.channels.featureControlUpdateTopic.messages.featureControlUpdateMessage.payload",
      "FeatureControlMessageAttributes": "$ref:$.channels.featureControlUpdateTopic.messages.featureControlUpdateMessage.headers"
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byDefault"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  