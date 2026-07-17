import crypto from 'node:crypto'
import { serviceAuth } from './service-auth.js'
import { config } from '../config.js'
import { getLogger } from '../common/helpers/logging/logger.js'

vi.mock('@hapi/jwt', async () => {
  const jwt = await vi.importActual('@hapi/jwt')
  return {
    ...jwt,
    default: {
      plugin: {
        name: 'jwt',
        register: vi.fn().mockImplementation(async (server) => {
          server.auth.scheme('jwt', () => ({
            authenticate: vi.fn()
          }))
        })
      }
    }
  }
})

vi.mock('../common/helpers/logging/logger.js', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('../common/helpers/mongodb.js')

const FAKE_ENCRYPTION_KEY = 'fake-encryption-key'
const FAKE_TOKEN = 'fake-auth-token'

describe.skip('service-auth plugin', () => {
  let mockServer
  const mockValues = new Map()

  beforeAll(() => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (mockValues.has(key)) return mockValues.get(key)
      return null
    })
    vi.spyOn(config, 'set').mockImplementation((key, value) => {
      mockValues.set(key, value)
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockValues.clear()
    mockServer = {
      register: vi.fn(),
      auth: {
        scheme: vi.fn(),
        strategy: vi.fn(),
        default: vi.fn()
      }
    }
  })

  test('should have the name service-auth', () => {
    expect(serviceAuth.plugin.name).toBe('service-auth')
  })

  describe('when service-to-service auth is disabled', () => {
    beforeEach(() => {
      config.set('serviceAuth.enabled', false)
    })

    test('should not register strategy or set default when service auth is disabled', async () => {
      await serviceAuth.plugin.register(mockServer)

      expect(mockServer.auth.strategy).not.toHaveBeenCalledWith(
        'service',
        'jwt',
        expect.any(Object)
      )
      expect(mockServer.auth.default).not.toHaveBeenCalledWith('service')
      expect(getLogger().info).toHaveBeenCalledWith(
        'Service-to-service authentication is disabled'
      )
    })
  })

  describe('when service-to-service auth is enabled', () => {
    beforeEach(() => {
      config.set('serviceAuth.enabled', true)
      config.set('serviceAuth.jwksUri', 'https://test-jwks.example.com')
      config.set('serviceAuth.issuer', 'https://test-issuer.example.com')
      config.set('serviceAuth.audience', 'grants-config-broker')
      config.set('serviceAuth.allowedServices', '')
      config.set('auth.token', FAKE_TOKEN)
      config.set('auth.encryptionKey', FAKE_ENCRYPTION_KEY)
    })

    test('should register the JWT plugin', async () => {
      await serviceAuth.plugin.register(mockServer)

      expect(mockServer.register).toHaveBeenCalled()
      const call = mockServer.register.mock.calls[0][0]
      expect(call.plugin.name).toBe('jwt')
    })

    test('should create a service auth strategy with the correct keys', async () => {
      await serviceAuth.plugin.register(mockServer)

      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'service',
        'jwt',
        expect.objectContaining({
          keys: { uri: 'https://test-jwks.example.com' }
        })
      )
    })

    test('should create a service auth strategy with the correct verification options', async () => {
      await serviceAuth.plugin.register(mockServer)

      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'service',
        'jwt',
        expect.objectContaining({
          verify: {
            aud: 'grants-config-broker',
            iss: 'https://test-issuer.example.com',
            sub: false
          }
        })
      )
    })

    test('should set service auth correctly', async () => {
      await serviceAuth.plugin.register(mockServer)

      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'service',
        'jwt',
        expect.any(Object)
      )
      expect(mockServer.auth.default).toHaveBeenCalledWith('service')
      expect(getLogger().info).toHaveBeenCalledWith(
        'Registering service-to-service JWT authentication'
      )
    })

    test('validate should return valid credentials from the JWT payload', async () => {
      await serviceAuth.plugin.register(mockServer)

      const serviceStrategyCall = mockServer.auth.strategy.mock.calls.find(
        (call) => call[0] === 'service'
      )
      const strategyOptions = serviceStrategyCall[2]
      const result = strategyOptions.validate(
        {
          decoded: {
            payload: {
              sub: 'arn:aws:iam::123456789012:role/grants-config-browser'
            }
          }
        },
        { headers: { authorization: 'Bearer new-token' }, path: '' }
      )
      expect(result).toEqual({
        isValid: true,
        credentials: {
          sub: 'arn:aws:iam::123456789012:role/grants-config-browser'
        }
      })
    })

    test('validate should return valid credentials when legacy token used TEMP', async () => {
      await serviceAuth.plugin.register(mockServer)

      const serviceStrategyCall = mockServer.auth.strategy.mock.calls.find(
        (call) => call[0] === 'service'
      )
      const strategyOptions = serviceStrategyCall[2]
      const result = strategyOptions.validate(
        {
          ignored: true
        },
        { headers: { authorization: getFakeAuthHeaderValue() }, path: '' }
      )
      expect(result).toEqual({
        isValid: true
      })
    })

    test('validate callback should reject a token with no sub claim', async () => {
      await serviceAuth.plugin.register(mockServer)

      const serviceStrategyCall = mockServer.auth.strategy.mock.calls.find(
        (call) => call[0] === 'service'
      )
      const strategyOptions = serviceStrategyCall[2]
      const result = strategyOptions.validate(
        {
          decoded: { payload: {} }
        },
        { headers: {}, path: '' }
      )
      expect(result).toEqual({ isValid: false })
    })

    describe('when allowedServices is configured', () => {
      beforeEach(() => {
        config.set(
          'serviceAuth.allowedServices',
          'grants-config-browser,grants-ui-backend'
        )
      })

      test('validate callback should accept a service in the allowed list', async () => {
        await serviceAuth.plugin.register(mockServer)

        const serviceStrategyCall = mockServer.auth.strategy.mock.calls.find(
          (call) => call[0] === 'service'
        )
        const strategyOptions = serviceStrategyCall[2]
        const result = strategyOptions.validate(
          {
            decoded: {
              payload: {
                sub: 'arn:aws:iam::123456789012:role/grants-config-browser'
              }
            }
          },
          { headers: {}, path: '' }
        )
        expect(result).toEqual({
          isValid: true,
          credentials: {
            sub: 'arn:aws:iam::123456789012:role/grants-config-browser'
          }
        })
      })

      test('validate callback should reject a service not in the allowed list', async () => {
        await serviceAuth.plugin.register(mockServer)

        const serviceStrategyCall = mockServer.auth.strategy.mock.calls.find(
          (call) => call[0] === 'service'
        )
        const strategyOptions = serviceStrategyCall[2]
        const result = strategyOptions.validate(
          {
            decoded: {
              payload: {
                sub: 'arn:aws:iam::123456789012:role/some-other-service'
              }
            }
          },
          { headers: {}, path: '' }
        )
        expect(result).toEqual({
          isValid: false,
          credentials: {
            sub: 'arn:aws:iam::123456789012:role/some-other-service'
          }
        })
      })
    })
  })
})

const getFakeAuthHeaderValue = () => {
  const iv = crypto.randomBytes(12)
  const key = crypto.scryptSync(FAKE_ENCRYPTION_KEY, 'salt', 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(FAKE_TOKEN, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()
  const encryptedToken = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`

  return `Bearer ${Buffer.from(encryptedToken).toString('base64')}`
}
