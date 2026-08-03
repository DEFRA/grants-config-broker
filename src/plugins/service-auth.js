import Jwt from '@hapi/jwt'
import Boom from '@hapi/boom'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { getLogger } from '../common/helpers/logging/logger.js'

const logger = getLogger()

export const serviceAuth = {
  plugin: {
    name: 'service-auth',
    register: async (server) => {
      await server.register(Jwt)

      if (config.get('serviceAuth.enabled')) {
        const allowedServices = config
          .get('serviceAuth.allowedServices')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)

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
            logger.info('Falling back to JWT auth')
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

            return { isValid: true, credentials: { sub } }
          }
        })
      }

      server.auth.scheme('service-custom', () => ({
        authenticate: async (request, h) => {
          const isLocalEnvironment = config.get('cdpEnvironment') === 'local'

          if (isLocalEnvironment) {
            logger.info('Auth not required for local environment')
            return h.authenticated({ credentials: { authenticated: true } })
          }

          const authorizationHeader = request.headers.authorization

          if (!authorizationHeader?.startsWith('Bearer ')) {
            throw Boom.unauthorized()
          }

          if (validLegacyToken(authorizationHeader)) {
            return h.authenticated({
              credentials: { authenticated: true, type: 'custom' }
            })
          }

          if (!config.get('serviceAuth.enabled')) {
            logger.info('jwt auth not enabled')
            throw Boom.unauthorized()
          }

          await server.auth.test('service-jwt', request)
          return h.authenticated({
            credentials: { authenticated: true, type: 'jwt' }
          })
        }
      }))
      server.auth.strategy('service', 'service-custom')
      server.auth.default('service')
    }
  }
}

const validLegacyToken = (authorizationHeader) => {
  const encryptedToken = Buffer.from(
    authorizationHeader.split(' ').pop(),
    'base64'
  ).toString('utf-8')
  const actualToken = decryptLegacyToken(encryptedToken)
  return actualToken === config.get('auth.token')
}
function decryptLegacyToken(encryptedToken) {
  const encryptionKey = config.get('auth.encryptionKey')
  if (!encryptionKey) {
    return null
  }

  try {
    const EXPECTED_TOKEN_PARTS = 3

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
    logger.error(
      error,
      'LEGACY AUTH: token provided is not valid - will fall back to service auth if available'
    )
    return null
  }
}
