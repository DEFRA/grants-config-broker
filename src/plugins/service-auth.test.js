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

  beforeEach(async () => {
    vi.clearAllMocks()
    server = Hapi.server()

    const defaultConfig = (key) => {
      if (key === 'serviceAuth.enabled') return true
      if (key === 'serviceAuth.allowedServices') return ''
      if (key === 'serviceAuth.jwksUri') return 'http://jwks'
      if (key === 'serviceAuth.audience') return 'test-audience'
      if (key === 'serviceAuth.issuer') return 'test-issuer'
      if (key === 'cdpEnvironment') return 'prod'
      if (key === 'auth.token') return 'test-token'
      if (key === 'auth.encryptionKey') return 'test-encryption-key'
      if (key === 'log') {
        return {
          isEnabled: false,
          redact: [],
          level: 'silent',
          format: 'pino-pretty'
        }
      }
      if (key === 'serviceName') return 'test'
      if (key === 'serviceVersion') return '1.0.0'
      return null
    }
    config.get.mockImplementation(defaultConfig)
  })

  afterEach(async () => {
    if (server) await server.stop()
  })

  it('covers plugin registration', async () => {
    await server.register(serviceAuth)
  })

  it('covers cdpEnvironment local bypass', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'local'
      if (key === 'serviceAuth.enabled') return true
      if (key === 'serviceAuth.allowedServices') return ''
      if (key === 'serviceAuth.jwksUri') return 'http://jwks'
      if (key === 'serviceAuth.audience') return 'test-audience'
      if (key === 'serviceAuth.issuer') return 'test-issuer'
      return null
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

  it('covers documentation path bypass', async () => {
    await server.register(serviceAuth)
    server.route({
      method: 'GET',
      path: '/documentation/test',
      handler: () => 'ok',
      options: { auth: 'service' }
    })

    const res = await server.inject({
      method: 'GET',
      url: '/documentation/test'
    })

    expect(res.statusCode).toBe(StatusCodes.OK)
  })

  it('covers legacy token validation', async () => {
    await server.register(serviceAuth)
    server.route({
      method: 'GET',
      path: '/t',
      handler: () => 'ok',
      options: { auth: 'service' }
    })
    const encryptionKey = 'test-encryption-key'
    const token = 'test-token'
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
    const authHeader = `Bearer ${Buffer.from(encrypt(token, encryptionKey)).toString('base64')}`

    const res = await server.inject({
      method: 'GET',
      url: '/t',
      headers: { authorization: authHeader }
    })

    expect(res.statusCode).toBe(StatusCodes.OK)
  })

  it('covers jwt validation logic', async () => {
    let capturedValidate
    const mockServer = {
      register: vi.fn(),
      auth: {
        strategy: vi.fn((name, type, options) => {
          if (name === 'service-jwt') capturedValidate = options.validate
        }),
        scheme: vi.fn(),
        default: vi.fn()
      }
    }
    await serviceAuth.plugin.register(mockServer)

    const res = await capturedValidate({
      decoded: { payload: { sub: 's/test' } }
    })
    expect(res.isValid).toBe(true)

    // Missing sub
    await expect(
      async () => await capturedValidate({ decoded: { payload: {} } })
    ).rejects.toThrow()

    // Disallowed service
    config.get.mockImplementation((key) => {
      if (key === 'serviceAuth.allowedServices') return 'other'
      if (key === 'serviceAuth.enabled') return true
      return null
    })
    const mockServer2 = {
      register: vi.fn(),
      auth: {
        strategy: vi.fn((name, type, options) => {
          if (name === 'service-jwt') capturedValidate = options.validate
        }),
        scheme: vi.fn(),
        default: vi.fn()
      }
    }

    await serviceAuth.plugin.register(mockServer2)

    await expect(
      async () =>
        await capturedValidate({ decoded: { payload: { sub: 's/test' } } })
    ).rejects.toThrow()
  })

  it('covers legacy token error paths and jwt fallback', async () => {
    const s = Hapi.server()
    await s.register(serviceAuth)
    s.route({
      method: 'GET',
      path: '/t',
      handler: () => 'ok',
      options: { auth: 'service' }
    })

    // Malformed (missing parts)
    await s.inject({
      method: 'GET',
      url: '/t',
      headers: {
        authorization: `Bearer ${Buffer.from('a:b').toString('base64')}`
      }
    })

    expect(getLogger().error).toHaveBeenCalled()

    // Invalid base64
    await s.inject({
      method: 'GET',
      url: '/t',
      headers: { authorization: 'Bearer !!!!' }
    })

    // Invalid token (wrong parts - empty data)
    await s.inject({
      method: 'GET',
      url: '/t',
      headers: {
        authorization: `Bearer ${Buffer.from('::').toString('base64')}`
      }
    })

    // Invalid token (wrong parts - missing one part)
    await s.inject({
      method: 'GET',
      url: '/t',
      headers: {
        authorization: `Bearer ${Buffer.from('a:b:').toString('base64')}`
      }
    })

    // Decryption error (invalid data)
    const resFallback = await s.inject({
      method: 'GET',
      url: '/t',
      headers: {
        authorization: `Bearer ${Buffer.from('iv:tag:data').toString('base64')}`
      }
    })
    expect(getLogger().error).toHaveBeenCalled()
    expect(resFallback.statusCode).toBe(StatusCodes.UNAUTHORIZED)

    // JWT disabled
    config.get.mockImplementation((key) => {
      if (key === 'serviceAuth.enabled') return false
      // Return something that doesn't match the valid legacy token
      if (key === 'auth.token') return 'something-else'
      if (key === 'auth.encryptionKey') return 'test-encryption-key'
      return null
    })
    // Use a token that looks valid enough to pass decrypt but won't match auth.token
    const encryptionKey = 'test-encryption-key'
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
    const invalidLegacyHeader = `Bearer ${Buffer.from(encrypt('not-the-token', encryptionKey)).toString('base64')}`

    const resDisabled = await s.inject({
      method: 'GET',
      url: '/t',
      headers: {
        authorization: invalidLegacyHeader
      }
    })

    expect(resDisabled.statusCode).toBe(StatusCodes.UNAUTHORIZED)
  })

  it('should get UNAUTHORIZED when authorization header present but is not bearer token', async () => {
    await server.register(serviceAuth)
    server.route({
      method: 'GET',
      path: '/t',
      handler: () => 'ok',
      options: { auth: 'service' }
    })
    const authHeader = 'NOT_BEARER fake-token'

    const res = await server.inject({
      method: 'GET',
      url: '/t',
      headers: { authorization: authHeader }
    })

    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED)
  })
})
