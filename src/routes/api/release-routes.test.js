import Boom from '@hapi/boom'
import { releaseRoutes } from './release-routes.js'

describe('releaseRoutes', () => {
  const postRoute = (method, path) =>
    releaseRoutes.find((r) => r.method === method && r.path === path)

  const mockError = new Error('Validation failed')
  const mockLogger = { error: vi.fn() }
  const mockRequest = { logger: mockLogger }

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/release-config', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        postRoute('POST', '/api/release-config').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Post release config validation error'
      )
    })
  })
})
