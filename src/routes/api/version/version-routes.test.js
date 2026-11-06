import { versionRoutes } from './version-routes.js'
import Boom from '@hapi/boom'

describe('versionRoutes', () => {
  const getRoute = (method, path) =>
    versionRoutes.find((r) => r.method === method && r.path === path)

  const mockError = new Error('Validation failed')
  const mockLogger = { error: vi.fn() }
  const mockRequest = { logger: mockLogger }

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/latestVersion', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        getRoute('GET', '/api/latestVersion').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Get latest version validation error'
      )
    })
  })

  describe('GET /api/version', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        getRoute('GET', '/api/version').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Get latest version validation error'
      )
    })
  })

  describe('GET /api/allVersions', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        getRoute('GET', '/api/allVersions').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Get all versions validation error'
      )
    })
  })

  describe('GET /api/allGrants', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        getRoute('GET', '/api/allGrants').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Get all grants versions validation error'
      )
    })
  })

  describe('POST /api/version/archive', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        getRoute('POST', '/api/version/archive').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Post archive version validation error'
      )
    })
  })

  describe('POST /api/version/unarchive', () => {
    it('should return 400 and log the error when validation fails', () => {
      expect(() =>
        getRoute('POST', '/api/version/unarchive').options.validate.failAction(
          mockRequest,
          null,
          mockError
        )
      ).toThrow(Boom.badRequest(mockError))
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Post unarchive version validation error'
      )
    })
  })
})
