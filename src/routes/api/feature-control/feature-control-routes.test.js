import Boom from '@hapi/boom'
import { featureControlRoutes } from './feature-control-routes.js'

describe('featureControlRoutes', () => {
  const postRoute = (method, path) =>
    featureControlRoutes.find((r) => r.method === method && r.path === path)

  const mockError = new Error('Validation failed')
  const mockLogger = { error: vi.fn() }
  const mockRequest = { logger: mockLogger }

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/feature-control', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        postRoute('POST', '/api/feature-control').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Post add feature control validation error'
      )
    })
  })

  describe('PUT /api/feature-control/value', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        postRoute(
          'PUT',
          '/api/feature-control/value'
        ).options.validate.failAction(mockRequest, null, mockError)
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Put feature control value update error'
      )
    })
  })
})
