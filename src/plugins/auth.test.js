import {
  TEST_AUTH_TOKEN,
  TEST_ENCRYPTION_KEY
} from '../../test/test-helpers/auth-constants.js'
import {
  HTTP_GET,
  VERSION_URL,
  CONTENT_TYPE_HEADER,
  CONTENT_TYPE_JSON,
  AUTH_HEADER,
  HTTP_401_UNAUTHORIZED
} from '../../test/test-helpers/http-header-constants.js'
import crypto from 'node:crypto'
import { createServer } from '../server.js'
import { config } from '../config.js'

describe('Auth Integration Tests', () => {
  const INVALID_AUTH_MESSAGE = 'Invalid authentication credentials'
  const BASIC_PARAM = 'grant=test-grant&version=1.1.1'

  const createBearerAuthCredentials = (token) =>
    Buffer.from(`${token}`).toString('base64')
  const createBearerAuthHeader = (token) =>
    `Bearer ${createBearerAuthCredentials(token)}`

  const encryptToken = (token, encryptionKey) => {
    const iv = crypto.randomBytes(12)
    const key = crypto.scryptSync(encryptionKey, 'salt', 32)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

    let encrypted = cipher.update(token, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
  }

  const createEncryptedAuthHeader = (token, encryptionKey) => {
    const encryptedToken = encryptToken(token, encryptionKey)
    const credentials = Buffer.from(`${encryptedToken}`).toString('base64')
    return `Bearer ${credentials}`
  }

  const originalValueMap = new Map()
  const removeAndPreserveConfigValue = (envVarName) => {
    originalValueMap.set(envVarName, config.get(envVarName))
    config.set(envVarName, null)
  }

  const restoreConfigValue = (envVarName) => {
    if (originalValueMap.has(envVarName)) {
      config.set(envVarName, originalValueMap.get(envVarName))
    }
  }

  let server

  beforeAll(async () => {
    process.env.GRANTS_CONFIG_BROKER_AUTH_TOKEN = TEST_AUTH_TOKEN
    process.env.GRANTS_CONFIG_BROKER_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY

    config.load({})
    config.set('cdpEnvironment', 'test')

    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
  })

  const getBasicRequestWithHeaders = (headers) => ({
    method: HTTP_GET,
    url: `${VERSION_URL}?${BASIC_PARAM}`,
    headers
  })

  describe('Valid Authentication', () => {
    it('should authenticate with correct encrypted bearer token', async () => {
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: createEncryptedAuthHeader(
            TEST_AUTH_TOKEN,
            TEST_ENCRYPTION_KEY
          )
        })
      )

      expect(response.statusCode).not.toBe(HTTP_401_UNAUTHORIZED)
    })

    it('should authenticate automatically for local environment', async () => {
      removeAndPreserveConfigValue('cdpEnvironment')
      config.set('cdpEnvironment', 'local')
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON
        })
      )

      expect(response.statusCode).not.toBe(HTTP_401_UNAUTHORIZED)
      restoreConfigValue('cdpEnvironment')
    })
  })

  describe('Invalid Authentication', () => {
    const WRONG_TOKEN = 'wrong-token'
    const BEARER_PREFIX = 'Bearer'
    const MALFORMED_BASE64 = '@#$%^&*()'
    const EMPTY_STRING = ''
    const MULTI_COLON_TOKEN = 'token:with:extra:colons'
    it('should reject request without authorization header', async () => {
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should reject request with wrong token', async () => {
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: createBearerAuthHeader(WRONG_TOKEN)
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should reject request with malformed base64', async () => {
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: `${BEARER_PREFIX} ${MALFORMED_BASE64}`
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should reject request with empty token', async () => {
      const credentials = createBearerAuthCredentials(EMPTY_STRING)

      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: `${BEARER_PREFIX} ${credentials}`
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should reject request with only "Bearer" prefix', async () => {
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: BEARER_PREFIX
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should reject request with empty authorization header', async () => {
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: EMPTY_STRING
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should reject request with credentials containing multiple colons', async () => {
      const credentials = Buffer.from(MULTI_COLON_TOKEN).toString('base64')

      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: `${BEARER_PREFIX} ${credentials}`
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should reject unencrypted token when encryption key is configured', async () => {
      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: createBearerAuthHeader(TEST_AUTH_TOKEN) // Unencrypted token
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })
  })

  describe('Configuration Edge Cases', () => {
    it('should handle auth token not configured scenario by testing with empty environment', async () => {
      removeAndPreserveConfigValue('auth.token')
      try {
        const testServer = await createServer()
        await testServer.initialize()

        const response = await testServer.inject(
          getBasicRequestWithHeaders({
            [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
            [AUTH_HEADER]: createBearerAuthHeader('any-token')
          })
        )

        expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
        expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)

        await testServer.stop()
      } finally {
        restoreConfigValue('auth.token')
      }
    })
  })

  describe('Base64 Decoding Edge Cases', () => {
    const BEARER_PREFIX = 'Bearer'

    it('should handle base64 decode errors and log them', async () => {
      const invalidBase64 = '====invalid====base64===='

      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: `${BEARER_PREFIX} ${invalidBase64}`
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
    })

    it('should handle base64 decoding exceptions and log the error', async () => {
      const originalBufferFrom = Buffer.from
      const mockError = new Error('Mocked base64 decoding error')
      Buffer.from = vi.fn().mockImplementation((input, encoding) => {
        if (encoding === 'base64' && input === 'force-error-token') {
          throw mockError
        }
        return originalBufferFrom(input, encoding)
      })

      const response = await server.inject(
        getBasicRequestWithHeaders({
          [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
          [AUTH_HEADER]: `${BEARER_PREFIX} force-error-token`
        })
      )

      expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)

      Buffer.from = originalBufferFrom
    })
  })

  describe('Encrypted Token Authentication', () => {
    it('should reject invalid encrypted token', async () => {
      let testServer
      try {
        testServer = await createServer()
        await testServer.initialize()

        const response = await testServer.inject(
          getBasicRequestWithHeaders({
            [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
            [AUTH_HEADER]: createEncryptedAuthHeader(
              'wrong-token',
              TEST_ENCRYPTION_KEY
            )
          })
        )

        expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
      } finally {
        if (testServer) await testServer.stop()
      }
    })

    it('should handle malformed encrypted token gracefully', async () => {
      let testServer
      try {
        testServer = await createServer()
        await testServer.initialize()

        const malformedEncryptedToken = 'invalid:encrypted:token:format'
        const credentials = Buffer.from(`:${malformedEncryptedToken}`).toString(
          'base64'
        )

        const response = await testServer.inject(
          getBasicRequestWithHeaders({
            [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
            [AUTH_HEADER]: `Bearer ${credentials}`
          })
        )

        expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
        expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
      } finally {
        if (testServer) await testServer.stop()
      }
    })

    it('should reject encrypted token when encryption key is not configured', async () => {
      removeAndPreserveConfigValue('auth.encryptionKey')

      let testServer
      try {
        testServer = await createServer()
        await testServer.initialize()

        const encryptedToken = 'iv:authTag:encryptedData'
        const credentials = Buffer.from(`:${encryptedToken}`).toString('base64')

        const response = await testServer.inject(
          getBasicRequestWithHeaders({
            [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
            [AUTH_HEADER]: `Bearer ${credentials}`
          })
        )

        expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
        expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
      } finally {
        if (testServer) await testServer.stop()
        restoreConfigValue('auth.encryptionKey')
      }
    })

    it('should reject encrypted token with invalid format (missing parts)', async () => {
      let testServer
      try {
        testServer = await createServer()
        await testServer.initialize()

        const invalidFormatToken = 'missing:parts'
        const credentials = Buffer.from(`:${invalidFormatToken}`).toString(
          'base64'
        )

        const response = await testServer.inject(
          getBasicRequestWithHeaders({
            [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
            [AUTH_HEADER]: `Bearer ${credentials}`
          })
        )

        expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
        expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)
      } finally {
        if (testServer) await testServer.stop()
      }
    })

    it('should handle encryption key becoming null during decryption', async () => {
      let testServer
      try {
        const originalConfigGet = config.get
        let callCount = 0

        config.get = vi.fn().mockImplementation((key) => {
          if (key === 'auth.encryptionKey') {
            callCount++
            if (callCount === 1) {
              return TEST_ENCRYPTION_KEY
            } else {
              return null
            }
          }
          return originalConfigGet.call(config, key)
        })

        testServer = await createServer()
        await testServer.initialize()

        const encryptedToken = 'iv:authTag:encryptedData'
        const credentials = Buffer.from(`:${encryptedToken}`).toString('base64')

        const response = await testServer.inject(
          getBasicRequestWithHeaders({
            [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
            [AUTH_HEADER]: `Bearer ${credentials}`
          })
        )

        expect(response.statusCode).toBe(HTTP_401_UNAUTHORIZED)
        expect(response.result.message).toBe(INVALID_AUTH_MESSAGE)

        config.get = originalConfigGet
      } finally {
        if (testServer) await testServer.stop()
      }
    })
  })
})
