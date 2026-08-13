import Hapi from '@hapi/hapi'
import crypto from 'node:crypto'
import { StatusCodes } from 'http-status-codes'
import { serviceAuth } from './service-auth.js'
import { getLogger } from '../common/helpers/logging/logger.js'
import { config } from '../config.js'

vi.mock('../config.js')

vi.mock('../common/helpers/logging/logger.js', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  return {
    getLogger: vi.fn(() => logger)
  }
})

describe('serviceAuth plugin', () => {
  let server
  const defaultConfigValues = {
    'serviceAuth.enabled': true,
    'serviceAuth.allowedServices': '',
    'serviceAuth.jwksUri': 'http://jwks',
    'serviceAuth.audience': 'test-audience',
    'serviceAuth.issuer': 'test-issuer',
    cdpEnvironment: 'prod',
    'auth.token': 'test-token',
    'auth.encryptionKey': 'test-encryption-key',
    log: {
      isEnabled: false,
      redact: [],
      level: 'silent',
      format: 'pino-pretty'
    },
    serviceName: 'test',
    serviceVersion: '1.0.0'
  }

  const encrypt = (text, key) => {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      crypto.scryptSync(key, 'salt', 32),
      iv
    )
    let encrypted = cipher.update(text, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted}`
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    server = Hapi.server()
    config.get.mockImplementation((key) => defaultConfigValues[key] ?? null)
  })

  afterEach(async () => {
    if (server) await server.stop()
  })

  describe('plugin registration', () => {
    it('should register successfully', async () => {
      await server.register(serviceAuth)
    })
  })

  describe('auth bypasses', () => {
    it('should bypass auth in local environment', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cdpEnvironment') return 'local'
        return defaultConfigValues[key] ?? null
      })

      await server.register(serviceAuth)
      server.route({
        method: 'GET',
        path: '/t',
        handler: () => 'ok',
        options: { auth: 'service' }
      })

      const res = await server.inject({ method: 'GET', url: '/t' })
      expect(res.statusCode).toBe(StatusCodes.OK)
    })
  })

  describe('legacy auth', () => {
    beforeEach(async () => {
      await server.register(serviceAuth)
      server.route({
        method: 'GET',
        path: '/t',
        handler: () => 'ok',
        options: { auth: 'service' }
      })
    })

    it('should authenticate with a valid legacy token', async () => {
      const encryptionKey = defaultConfigValues['auth.encryptionKey']
      const token = defaultConfigValues['auth.token']
      const authHeader = `Bearer ${Buffer.from(encrypt(token, encryptionKey)).toString('base64')}`

      const res = await server.inject({
        method: 'GET',
        url: '/t',
        headers: { authorization: authHeader }
      })

      expect(res.statusCode).toBe(StatusCodes.OK)
    })

    it('should fail with missing bearer prefix', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/t',
        headers: { authorization: 'NOT_BEARER token' }
      })

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED)
    })

    it('should log error for malformed token (missing parts)', async () => {
      await server.inject({
        method: 'GET',
        url: '/t',
        headers: {
          authorization: `Bearer ${Buffer.from('a:b').toString('base64')}`
        }
      })

      expect(getLogger().error).toHaveBeenCalled()
    })

    it('should log error for invalid base64 encoding', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/t',
        headers: { authorization: 'Bearer !!!!' }
      })
      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED)
    })

    it('should log error for invalid token parts format', async () => {
      await server.inject({
        method: 'GET',
        url: '/t',
        headers: {
          authorization: `Bearer ${Buffer.from('a:b:').toString('base64')}`
        }
      })
      expect(getLogger().error).toHaveBeenCalled()
    })

    it('should log error and fallback to JWT on decryption failure', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/t',
        headers: {
          authorization: `Bearer ${Buffer.from('iv:tag:data').toString('base64')}`
        }
      })
      expect(getLogger().error).toHaveBeenCalled()
      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED)
    })

    it('should fail when JWT fallback is disabled', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'serviceAuth.enabled') return false
        return defaultConfigValues[key] ?? null
      })

      const invalidLegacyHeader = `Bearer ${Buffer.from(encrypt('not-the-token', defaultConfigValues['auth.encryptionKey'])).toString('base64')}`

      const res = await server.inject({
        method: 'GET',
        url: '/t',
        headers: { authorization: invalidLegacyHeader }
      })

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED)
    })

    it('should fail with encryption key missing', async () => {
      const encryptionKey = defaultConfigValues['auth.encryptionKey']
      const token = defaultConfigValues['auth.token']
      const authHeader = `Bearer ${Buffer.from(encrypt(token, encryptionKey)).toString('base64')}`
      config.get.mockImplementation((key) => {
        if (key === 'auth.encryptionKey') return ''
        if (key === 'serviceAuth.enabled') return false
        return defaultConfigValues[key] ?? null
      })

      const res = await server.inject({
        method: 'GET',
        url: '/t',
        headers: { authorization: authHeader }
      })

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED)
    })
  })

  describe('jwt auth validate', () => {
    let capturedValidate

    const setupMockServer = async () => {
      const mockServer = {
        register: vi.fn(),
        ext: vi.fn(),
        auth: {
          strategy: vi.fn((name, type, options) => {
            if (name === 'service-jwt') capturedValidate = options.validate
          }),
          scheme: vi.fn(),
          default: vi.fn()
        }
      }
      await serviceAuth.plugin.register(mockServer)
      return mockServer
    }

    it('should validate a correct token', async () => {
      await setupMockServer()

      const res = await capturedValidate({
        decoded: { payload: { sub: 's/test' } }
      })

      expect(res.isValid).toBe(true)
      expect(res.credentials).toEqual({ sub: 's/test', serviceName: 'test' })
    })

    it('should reject tokens missing the sub claim', async () => {
      await setupMockServer()
      await expect(
        async () => await capturedValidate({ decoded: { payload: {} } })
      ).rejects.toThrow()
    })

    it('should reject services not in the allowed list', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'serviceAuth.allowedServices') return 'other'
        return defaultConfigValues[key] ?? null
      })

      await setupMockServer()
      await expect(
        async () =>
          await capturedValidate({ decoded: { payload: { sub: 's/test' } } })
      ).rejects.toThrow()
    })
  })

  describe('subject-based access control', () => {
    beforeEach(async () => {
      await server.register(serviceAuth)
    })

    it('should allow access if serviceName is in allowedSubjects', async () => {
      server.route({
        method: 'GET',
        path: '/restricted',
        handler: () => 'ok',
        options: {
          auth: 'service',
          plugins: {
            'service-auth': {
              allowedSubjects: ['grants-config-browser']
            }
          }
        }
      })

      const encryptionKey = defaultConfigValues['auth.encryptionKey']
      const token = defaultConfigValues['auth.token']
      const authHeader = `Bearer ${Buffer.from(encrypt(token, encryptionKey)).toString('base64')}`

      config.get.mockImplementation((key) => {
        if (key === 'auth.defaultSubject') return 'grants-config-browser'
        return defaultConfigValues[key] ?? null
      })

      const res = await server.inject({
        method: 'GET',
        url: '/restricted',
        headers: { authorization: authHeader }
      })

      expect(res.statusCode).toBe(StatusCodes.OK)
    })

    it('should deny access if serviceName is not in allowedSubjects', async () => {
      server.route({
        method: 'GET',
        path: '/restricted',
        handler: () => 'ok',
        options: {
          auth: 'service',
          plugins: {
            'service-auth': {
              allowedSubjects: ['grants-config-browser']
            }
          }
        }
      })

      const encryptionKey = defaultConfigValues['auth.encryptionKey']
      const token = defaultConfigValues['auth.token']
      const authHeader = `Bearer ${Buffer.from(encrypt(token, encryptionKey)).toString('base64')}`

      config.get.mockImplementation((key) => {
        if (key === 'auth.defaultSubject') return 'wrong-service'
        return defaultConfigValues[key] ?? null
      })

      const res = await server.inject({
        method: 'GET',
        url: '/restricted',
        headers: { authorization: authHeader }
      })

      expect(res.statusCode).toBe(StatusCodes.FORBIDDEN)
    })

    it('should pick up default local subject and allow request through for local call ', async () => {
      server.route({
        method: 'GET',
        path: '/restricted',
        handler: () => 'ok',
        options: {
          auth: 'service',
          plugins: {
            'service-auth': {
              allowedSubjects: ['grants-config-browser']
            }
          }
        }
      })

      config.get.mockImplementation((key) => {
        if (key === 'cdpEnvironment') return 'local'
        return defaultConfigValues[key] ?? null
      })

      const res = await server.inject({
        method: 'GET',
        url: '/restricted',
        headers: {}
      })

      expect(res.statusCode).toBe(StatusCodes.OK)
    })
  })
})
