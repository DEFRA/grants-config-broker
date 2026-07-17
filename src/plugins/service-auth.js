import Jwt from '@hapi/jwt'
import Boom from '@hapi/boom'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { getLogger } from '../common/helpers/logging/logger.js'

const AUTH_HEADER_BEARER_VALUE_PREFIX = 'Bearer '
const logger = getLogger()

export const serviceAuth = {
  plugin: {
    name: 'service-auth',
    register: async (server) => {
      await server.register(Jwt)

      const allowedServices = config
        .get('serviceAuth.allowedServices')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      // JWT strategy
      server.auth.strategy('service-jwt', 'jwt', {
        keys: {
          uri: config.get('serviceAuth.jwksUri')
        },
        verify: {
          aud: config.get('serviceAuth.audience'),
          iss: config.get('serviceAuth.issuer'),
          sub: false
        },
        validate: (artifacts) => {
          const sub = artifacts.decoded.payload.sub

          if (!sub) {
            logger.warn('Service-to-service auth rejected: missing sub claim')
            throw Boom.unauthorized()
          }

          const serviceName = sub.split('/').pop()
          if (
            allowedServices.length > 0 &&
            !allowedServices.includes(serviceName)
          ) {
            logger.warn(
              `Service-to-service auth rejected: service '${serviceName}' is not in allowed list`
            )
            throw Boom.unauthorized()
          }

          return { credentials: { authenticated: true, sub } }
        }
      })

      // Custom scheme
      server.auth.scheme('service-custom', () => ({
        authenticate: async (request, h) => {
          const isLocalEnvironment = config.get('cdpEnvironment') === 'local'
          const isDocumentationPath = request.path.startsWith('/documentation')

          if (isLocalEnvironment || isDocumentationPath) {
            logger.info(
              'Auth not required for local environment or documentation path'
            )
            return h.authenticated({ credentials: { authenticated: true } })
          }

          const authorizationHeader = request.headers.authorization

          if (
            !authorizationHeader?.startsWith(AUTH_HEADER_BEARER_VALUE_PREFIX)
          ) {
            throw Boom.unauthorized()
          }

          if (validateAuthLegacy(authorizationHeader)) {
            return h.authenticated({
              credentials: { authenticated: true, type: 'custom' }
            })
          }

          // Otherwise fall back to JWT validation
          return h.authenticated(await server.auth.test('service-jwt', request))
        }
      }))

      server.auth.strategy('service', 'service-custom')
      server.auth.default('service')
    }
  }
}

// Legacy bearer auth scheme
const validateAuthLegacy = (authorizationHeader) => {
  const encryptedToken = authorizationHeader.slice(
    AUTH_HEADER_BEARER_VALUE_PREFIX.length
  )
  const actualToken = decryptToken(encryptedToken)
  return actualToken === config.get('auth.token')
}
const EXPECTED_TOKEN_PARTS = 3
function decryptToken(encryptedToken) {
  const encryptionKey = config.get('auth.encryptionKey')
  if (!encryptionKey) {
    return null
  }

  try {
    const parts = encryptedToken.split(':')
    if (parts.length !== EXPECTED_TOKEN_PARTS) {
      throw new Error('Malformed encrypted token')
    }

    const [ivB64, authTagB64, encryptedData] = encryptedToken.split(':')
    if (!ivB64 || !authTagB64 || !encryptedData) {
      throw new Error('Invalid encrypted token format')
    }

    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')
    const key = crypto.scryptSync(encryptionKey, 'salt', 32)

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    logger.error(error, 'LEGACY AUTH: token provided is not a valid')
    return null
  }
}
