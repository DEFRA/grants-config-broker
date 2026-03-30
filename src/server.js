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
import { deployNewVersion } from './deploy-version.js'
import { notifyVersion } from './notify-version.js'
import { auth } from './plugins/auth.js'
import Inert from '@hapi/inert'
import Scalar from 'hapi-scalar'
import yaml from 'js-yaml'
import fs from 'node:fs'
import path from 'node:path'

async function createServer() {
  setupProxy()
  const server = Hapi.server({
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
  })

  // hapi-scalar   - serves API documentation using Scalar
  // inert         - serves static files (required by scalar)
  const swaggerPath = path.resolve(process.cwd(), 'src/routes/api/swagger.yaml')
  const swaggerFile = fs.readFileSync(swaggerPath, 'utf8')
  const swaggerDocument = yaml.load(swaggerFile)

  await server.register([
    Inert,
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
    },
    auth,
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse,
    {
      plugin: mongoDb,
      options: config.get('mongo')
    },
    router
  ])

  server.events.on('start', async () => {
    const { db } = server
    const logger = getLogger()

    const releaseVersionDetails = await deployNewVersion(db, logger)
    if (releaseVersionDetails) {
      logger.info(
        `Deployed version ${releaseVersionDetails.version} successfully, notifying clients`
      )
      await notifyVersion(releaseVersionDetails, logger)
    }
  })

  return server
}

export { createServer }
