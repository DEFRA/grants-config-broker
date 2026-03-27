import {
  getAllGrantsHandler,
  getAllVersionsHandler,
  getLatestVersionHandler,
  getSpecificVersionHandler,
  getVersionHistoryHandler
} from './version-handlers.js'
import {
  findVersion,
  findVersionHistory,
  getAllGrantsAllVersions,
  getAllVersionsWithConstraints,
  getLatestVersionWithConstraints
} from '../../repositories/version-management-repository.js'
import { getBucketName } from '../../storage/s3-interactions.js'

vi.mock('../../repositories/version-management-repository.js')
vi.mock('../../storage/s3-interactions.js')

describe('version-handlers', () => {
  const mockLogger = {
    error: vi.fn(),
    setBindings: vi.fn()
  }
  const mockDb = {}
  const mockH = {
    response: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis(),
    takeover: vi.fn().mockReturnThis()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getBucketName.mockReturnValueOnce('s3://test-bucket')
  })

  describe('getLatestVersionHandler', () => {
    beforeEach(() => {
      getLatestVersionWithConstraints.mockResolvedValueOnce([
        {
          grant: 'some-grant',
          version: '1.0.0',
          status: 'draft',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.0',
          createdInBrokerVersion: '1.0.0',
          lastUpdated: new Date(),
          versionMajor: 1,
          versionMinor: 0,
          versionPatch: 0
        }
      ])
    })
    it('should return formatted response of the latest version when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'include',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith(
        'some-grant',
        null,
        1,
        0,
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith({
        grant: 'some-grant',
        version: '1.0.0',
        status: 'draft',
        manifest: ['some/file.txt'],
        lastUpdated: expect.any(Date),
        path: 's3://test-bucket'
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through status indicator of draft when only draft selected', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'only'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith(
        'some-grant',
        'draft',
        undefined,
        undefined,
        mockDb
      )
    })

    it('should pass through status indicator of active when draft option not selected', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith(
        'some-grant',
        'active',
        undefined,
        undefined,
        mockDb
      )
    })

    it('should return not found response if no version present for constraints specified', async () => {
      getLatestVersionWithConstraints.mockReset()
      getLatestVersionWithConstraints.mockResolvedValueOnce([])
      const mockRequest = {
        query: {
          grant: 'some-grant',
          constrainMajor: 1
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith(
        'some-grant',
        'active',
        1,
        undefined,
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Grant some-grant with version constraints not found'
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })

  describe('getSpecificVersionHandler', () => {
    beforeEach(() => {
      findVersion.mockResolvedValueOnce({
        grant: 'some-grant',
        version: '1.0.0',
        status: 'draft',
        manifest: ['some/file.txt'],
        updatedInBrokerVersion: '1.0.0',
        createdInBrokerVersion: '1.0.0',
        lastUpdated: new Date(),
        versionMajor: 1,
        versionMinor: 0,
        versionPatch: 0
      })
    })
    it('should return formatted response of the latest version when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getSpecificVersionHandler(mockRequest, mockH)
      expect(findVersion).toHaveBeenCalledWith('1.0.0', 'some-grant', mockDb)
      expect(mockH.response).toHaveBeenCalledWith({
        grant: 'some-grant',
        version: '1.0.0',
        status: 'draft',
        manifest: ['some/file.txt'],
        lastUpdated: expect.any(Date),
        path: 's3://test-bucket'
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through version built from component parts', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          major: 1,
          minor: 2,
          patch: 3
        },
        logger: mockLogger,
        db: mockDb
      }
      await getSpecificVersionHandler(mockRequest, mockH)
      expect(findVersion).toHaveBeenCalledWith('1.2.3', 'some-grant', mockDb)
    })

    it('should return not found response if no version present for constraints specified', async () => {
      findVersion.mockReset()
      findVersion.mockResolvedValueOnce(null)
      const mockRequest = {
        query: {
          grant: 'nonexisting-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getSpecificVersionHandler(mockRequest, mockH)
      expect(findVersion).toHaveBeenCalledWith(
        '1.0.0',
        'nonexisting-grant',
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Grant nonexisting-grant version 1.0.0 not found'
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })

  describe('getAllVersionsHandler', () => {
    beforeEach(() => {
      getAllVersionsWithConstraints.mockResolvedValueOnce([
        {
          grant: 'some-grant',
          version: '1.0.0',
          status: 'draft',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.0'
        },
        {
          grant: 'some-grant',
          version: '1.0.1',
          status: 'active',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.1'
        }
      ])
    })

    it('should return all versions when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(getAllVersionsWithConstraints).toHaveBeenCalledWith(
        'some-grant',
        'active',
        undefined,
        undefined,
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith([
        {
          grant: 'some-grant',
          version: '1.0.0',
          status: 'draft',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.0'
        },
        {
          grant: 'some-grant',
          version: '1.0.1',
          status: 'active',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.1'
        }
      ])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through optional draft only constraint', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'only',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(getAllVersionsWithConstraints).toHaveBeenCalledWith(
        'some-grant',
        'draft',
        1,
        0,
        mockDb
      )
    })

    it('should pass through optional draft included constraint', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'include',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(getAllVersionsWithConstraints).toHaveBeenCalledWith(
        'some-grant',
        null,
        1,
        0,
        mockDb
      )
    })

    it('should return empty array if nothing found', async () => {
      getAllVersionsWithConstraints.mockReset()
      getAllVersionsWithConstraints.mockResolvedValueOnce([])
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'include',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(mockH.response).toHaveBeenCalledWith([])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('getAllGrantsHandler', () => {
    beforeEach(() => {
      getAllGrantsAllVersions.mockResolvedValueOnce([
        {
          grant: 'some-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            },
            {
              version: '1.0.1',
              status: 'active',
              updatedInBrokerVersion: '1.0.1'
            }
          ]
        },
        {
          grant: 'other-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            }
          ]
        }
      ])
    })

    it('should return all grant versions when found', async () => {
      const mockRequest = {
        query: {},
        logger: mockLogger,
        db: mockDb
      }
      await getAllGrantsHandler(mockRequest, mockH)
      expect(getAllGrantsAllVersions).toHaveBeenCalledWith('active', mockDb)
      expect(mockH.response).toHaveBeenCalledWith([
        {
          grant: 'some-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            },
            {
              version: '1.0.1',
              status: 'active',
              updatedInBrokerVersion: '1.0.1'
            }
          ]
        },
        {
          grant: 'other-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            }
          ]
        }
      ])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through optional draft only constraint', async () => {
      const mockRequest = {
        query: {
          draft: 'only'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllGrantsHandler(mockRequest, mockH)
      expect(getAllGrantsAllVersions).toHaveBeenCalledWith('draft', mockDb)
    })

    it('should pass through optional draft included constraint', async () => {
      const mockRequest = {
        query: {
          draft: 'include'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllGrantsHandler(mockRequest, mockH)
      expect(getAllGrantsAllVersions).toHaveBeenCalledWith(null, mockDb)
    })
  })

  describe('getVersionHistoryHandler', () => {
    beforeEach(() => {
      findVersionHistory.mockResolvedValueOnce([
        {
          version: '1.0.0',
          status: 'draft'
        },
        {
          version: '1.0.0',
          status: 'active'
        },
        {
          version: '1.0.0',
          status: 'draft'
        }
      ])
    })

    it('should return grant version history for semantic version when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getVersionHistoryHandler(mockRequest, mockH)
      expect(findVersionHistory).toHaveBeenCalledWith(
        '1.0.0',
        'some-grant',
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith([
        {
          version: '1.0.0',
          status: 'draft'
        },
        {
          version: '1.0.0',
          status: 'active'
        },
        {
          version: '1.0.0',
          status: 'draft'
        }
      ])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through version made from component parts', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          major: 1,
          minor: 0,
          patch: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getVersionHistoryHandler(mockRequest, mockH)
      expect(findVersionHistory).toHaveBeenCalledWith(
        '1.0.0',
        'some-grant',
        mockDb
      )
    })

    it('should return not found response if version not present in environment', async () => {
      findVersionHistory.mockReset()
      findVersionHistory.mockResolvedValueOnce([])
      const mockRequest = {
        query: {
          grant: 'nonexisting-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getVersionHistoryHandler(mockRequest, mockH)
      expect(findVersionHistory).toHaveBeenCalledWith(
        '1.0.0',
        'nonexisting-grant',
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Grant nonexisting-grant version 1.0.0 not found'
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })
})
