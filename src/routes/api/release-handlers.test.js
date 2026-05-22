import { postReleaseConfigHandler } from './release-handlers.js'
import { considerRelease } from '../../deploy-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'
import { notifyVersion } from '../../notify-version.js'

vi.mock('../../deploy-version.js')
vi.mock('../../notify-version.js')
vi.mock('../../utils/get-service-version.js')

describe('release-handlers', () => {
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
    getServiceVersion.mockReturnValueOnce('1.0.0')
  })

  describe('postReleaseConfigHandler', () => {
    it('should return no content when version not released', async () => {
      considerRelease.mockResolvedValueOnce(null)
      const mockRequest = {
        payload: {
          grant: 'some-grant',
          status: 'draft',
          version: '1.0.0',
          files: ['some/file.txt']
        },
        logger: mockLogger,
        db: mockDb
      }
      const result = await postReleaseConfigHandler(mockRequest, mockH)
      expect(result).toEqual(mockH)
      expect(considerRelease).toHaveBeenCalledWith(
        mockLogger,
        mockDb,
        { name: 'some-grant', version: '1.0.0' },
        '1.0.0',
        'draft',
        ['some/file.txt']
      )
      expect(mockH.code).toHaveBeenCalledWith(204)
    })

    it('should send notification and return accepted when version is released', async () => {
      const releaseInfo = {
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
      considerRelease.mockResolvedValueOnce(releaseInfo)
      const mockRequest = {
        payload: {
          grant: 'some-grant',
          status: 'draft',
          version: '1.0.0',
          files: ['some/file.txt']
        },
        logger: mockLogger,
        db: mockDb
      }
      const result = await postReleaseConfigHandler(mockRequest, mockH)
      expect(result).toEqual(mockH)
      expect(considerRelease).toHaveBeenCalledWith(
        mockLogger,
        mockDb,
        { name: 'some-grant', version: '1.0.0' },
        '1.0.0',
        'draft',
        ['some/file.txt']
      )
      expect(notifyVersion).toHaveBeenCalledWith(releaseInfo, mockLogger)
      expect(mockH.code).toHaveBeenCalledWith(202)
    })

    it('status defaults to draft if not specified', async () => {
      considerRelease.mockResolvedValueOnce(null)
      const mockRequest = {
        payload: {
          grant: 'some-grant',
          version: '1.0.0',
          files: ['some/file.txt']
        },
        logger: mockLogger,
        db: mockDb
      }
      await postReleaseConfigHandler(mockRequest, mockH)
      expect(considerRelease).toHaveBeenCalledWith(
        mockLogger,
        mockDb,
        { name: 'some-grant', version: '1.0.0' },
        '1.0.0',
        'draft',
        ['some/file.txt']
      )
    })
  })
})
