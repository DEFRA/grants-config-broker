import Hapi from '@hapi/hapi'

import { secureContext } from '@defra/hapi-secure-context'

import { config } from './config.js'
import { router } from './plugins/router.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { mongoDb } from './common/helpers/mongodb.js'
import { failAction } from './common/helpers/fail-action.js'
import { pulse } from './common/helpers/pulse.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { metrics } from '@defra/cdp-metrics'
import { getLogger } from './common/helpers/logging/logger.js'
import { notifyVersion } from './messaging/outbound/notify-version.js'
import { serviceAuth } from './plugins/service-auth.js'
import Inert from '@hapi/inert'
import Scalar from 'hapi-scalar'
import yaml from 'js-yaml'
import fs from 'node:fs'
import path from 'node:path'
import { checkReleaseFileForVersionDeployment } from './check-file-based-releases.js'
import {
  configureAndStartMessaging,
  stopMessageSubscriber
} from './messaging/inbound/input-message-queue-subscriber.js'
import { createAliasesLookup } from './check-aliases.js'

async function createServer() {
  setupProxy()
  const opts = {
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  }
  if (config.get('cdpEnvironment') === 'local') {
    opts.routes.cors = {
      origin: ['http://localhost:3000'],
      additionalHeaders: ['authorization', 'x-api-key', 'content-type']
    }
  }
  const server = Hapi.server(opts)

  await server.register([
    Inert,
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse,
    {
      plugin: mongoDb,
      options: config.get('mongo')
    },
    serviceAuth,
    router
  ])

  await registerApiDocsPlugin(server)

  registerAsyncApiDocsRoute(server)

  server.events.on('start', async () => {
    const { db } = server
    const logger = getLogger()

    const aliasLookup = await createAliasesLookup(logger)
    server.method({
      name: 'aliasLookup',
      method: aliasLookup
    })

    const releaseVersionDetails = await checkReleaseFileForVersionDeployment(
      db,
      logger
    )
    if (releaseVersionDetails?.length) {
      for (const releasedVersion of releaseVersionDetails) {
        logger.info(
          `Deployed version ${releasedVersion.grant} @ ${releasedVersion.version} successfully, notifying clients`
        )
        await notifyVersion(releasedVersion, 'system', logger)
        for (const alias of aliasLookup(releasedVersion.grant)) {
          await notifyVersion(
            { ...releasedVersion, grant: alias },
            'system',
            logger
          )
        }
      }
    }
    await configureAndStartMessaging(db, server)
  })

  server.events.on('stop', async () => {
    await stopMessageSubscriber()
  })

  return server
}

const registerApiDocsPlugin = async (server) => {
  // hapi-scalar   - serves API documentation using Scalar
  // inert         - serves static files (required by scalar)
  const swaggerPath = path.resolve(process.cwd(), 'src/docs/swagger.yaml')
  const swaggerFile = fs.readFileSync(swaggerPath, 'utf8')
  const swaggerDocument = yaml.load(swaggerFile, {})

  await server.register([
    {
      plugin: Scalar,
      options: {
        scalarConfig: {
          content: swaggerDocument
        },
        routePrefix: '/documentation',
        routeConfig: {
          auth: false
        }
      }
    }
  ])
}

const registerAsyncApiDocsRoute = (server) => {
  server.route({
    method: 'GET',
    path: '/async-documentation/{param*}',
    handler: {
      directory: {
        path: 'src/routes/asyncapidocs',
        index: ['index.html']
      }
    }
  })
}

export { createServer }
