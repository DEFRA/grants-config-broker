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
            return { isValid: false }
          }

          const serviceName = sub.split('/').pop()
          if (
            allowedServices.length > 0 &&
            !allowedServices.includes(serviceName)
          ) {
            logger.warn(
              `Service-to-service auth rejected: service '${serviceName}' is not in allowed list`
            )
            return { isValid: false, credentials: { sub } }
          }

          return { isValid: true, credentials: { sub } }
        }
      })

      // Custom scheme
      server.auth.scheme('service-custom', () => ({
        authenticate: async (request, h) => {
          const auth = request.headers.authorization

          if (!auth?.startsWith('Bearer ')) {
            throw Boom.unauthorized()
          }

          const actualToken = decryptToken(auth.slice(7))
          if (actualToken === config.get('auth.token')) {
            return validateAuthLegacy(request, h, actualToken)
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
const validateAuthLegacy = (request, h, actualToken) => {
  const authHeader = request.headers.authorization
  const isLocalEnvironment = config.get('cdpEnvironment') === 'local'
  const isDocumentationPath = request.path.startsWith('/documentation')

  const validation =
    isLocalEnvironment || isDocumentationPath
      ? { isValid: true }
      : validateAuthToken(authHeader, actualToken)

  const valid = validation.isValid
  if (valid) {
    logger.info('Call made with valid legacy auth')
    return h.authenticated({ credentials: { type: 'custom' } })
  }
  throw Boom.unauthorized()
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
function validateAuthToken(authHeader, actualToken) {
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      isValid: false,
      error: 'Missing or invalid Authorization header format'
    }
  }

  const expectedToken = config.get('auth.token')
  if (!expectedToken) {
    logger.error('Server auth token not configured')
    return {
      isValid: false,
      error: 'Server authentication token not configured'
    }
  }

  const encryptionKey = config.get('auth.encryptionKey')
  if (!encryptionKey) {
    logger.error(
      'Encryption key not configured - encrypted tokens are required'
    )
    return { isValid: false, error: 'Server encryption not configured' }
  }

  try {
    const tokensMatch = actualToken === expectedToken

    if (!tokensMatch) {
      return { isValid: false, error: 'Invalid bearer token' }
    }
  } catch {
    return { isValid: false, error: 'Invalid encrypted token' }
  }

  return { isValid: true }
}
