import { considerRelease } from './deploy-version.js'
import { config } from './config.js'
import {
  findVersion,
  hasVersionJobAlreadyRun,
  storeVersion
} from './repositories/version-management-repository.js'
import {
  uploadMetaDataToS3,
  uploadVersionFilesToS3
} from './upload-version-files-to-s3.js'
import { isLatestVersion } from './service/latest-version.js'
import { trackEvent } from './common/helpers/logging/logger.js'
import { getBucketName } from '@defra/grants-config-utils/s3-interactions'

vi.mock('./repositories/version-management-repository.js')
vi.mock('./service/latest-version.js')
vi.mock('@defra/grants-config-utils/s3-interactions')
vi.mock('./upload-version-files-to-s3.js')
vi.mock('./common/helpers/logging/logger.js')

describe('deploy-version', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }

  const mockDb = {}

  beforeEach(() => {
    config.set('cdpEnvironment', 'test')
    config.set('serviceVersion', '1.0.0')
    hasVersionJobAlreadyRun.mockResolvedValueOnce(false)
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  function getReleaseInfo(status = 'active') {
    return {
      name: 'example-grant-with-auth',
      version: '0.0.1',
      notes: 'Some info about your release',
      environments: [
        {
          name: 'test',
          status
        }
      ]
    }
  }

  describe('deployNewVersion', () => {
    it('existing version with no status change should trigger no further action', async () => {
      findVersion.mockResolvedValueOnce({
        grant: 'example-grant-with-auth',
        version: '0.0.1',
        status: 'active'
      })
      const result = await considerRelease(
        mockLogger,
        mockDb,
        getReleaseInfo(),
        '1.0.0',
        'active'
      )

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'example-grant-with-auth Version 0.0.1 already deployed to S3, and no status change. Nothing happened!'
      )
      expect(uploadMetaDataToS3).not.toHaveBeenCalled()
      expect(storeVersion).not.toHaveBeenCalled()
      expect(uploadVersionFilesToS3).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('existing version with status change should upload metadata, update store version and return info', async () => {
      findVersion.mockResolvedValueOnce({
        grant: 'example-grant-with-auth',
        version: '0.0.1',
        status: 'draft',
        updatedInBrokerVersion: '0.0.5',
        createdInBrokerVersion: '0.0.5',
        manifest: ['some/existing/file.txt']
      })
      getBucketName.mockReturnValueOnce('s3://test-bucket')
      isLatestVersion.mockResolvedValueOnce(false)

      const releaseInfo = getReleaseInfo()

      const result = await considerRelease(
        mockLogger,
        mockDb,
        releaseInfo,
        '1.0.0',
        'active'
      )

      expect(uploadMetaDataToS3).toHaveBeenCalledWith(
        releaseInfo,
        'active',
        mockLogger
      )
      expect(storeVersion).toHaveBeenCalledWith(
        {
          grant: 'example-grant-with-auth',
          version: '0.0.1',
          status: 'active',
          updatedInBrokerVersion: '1.0.0',
          createdInBrokerVersion: '0.0.5',
          lastUpdated: expect.any(Date),
          manifest: ['some/existing/file.txt']
        },
        mockDb
      )
      expect(uploadVersionFilesToS3).not.toHaveBeenCalled()
      expect(trackEvent).toHaveBeenCalledWith(
        mockLogger,
        'version-update',
        'status-change',
        {
          kind: 'active',
          reference:
            'grant: example-grant-with-auth, version: 0.0.1, brokerVersion: 1.0.0'
        }
      )
      expect(result).to.eql({
        grant: 'example-grant-with-auth',
        manifest: ['some/existing/file.txt'],
        path: 's3://test-bucket',
        status: 'active',
        version: '0.0.1',
        versionMajor: 0,
        versionMinor: 0,
        versionPatch: 1,
        isLatest: false
      })
    })

    it('non-existing version should call through to upload the files to S3 for the release and return result', async () => {
      getBucketName.mockReturnValueOnce('s3://test-bucket')
      uploadVersionFilesToS3.mockResolvedValueOnce([
        'some/existing/file.txt',
        'some/other/file.txt'
      ])

      isLatestVersion.mockResolvedValueOnce(true)
      const releaseInfo = getReleaseInfo()
      const result = await considerRelease(
        mockLogger,
        mockDb,
        releaseInfo,
        '1.0.0',
        'active'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'example-grant-with-auth 0.0.1 will be deployed to S3 with status active'
      )
      expect(uploadVersionFilesToS3).toHaveBeenCalledWith(
        releaseInfo,
        'active',
        mockLogger
      )
      expect(storeVersion).toHaveBeenCalledWith(
        {
          grant: 'example-grant-with-auth',
          version: '0.0.1',
          versionMajor: 0,
          versionMinor: 0,
          versionPatch: 1,
          status: 'active',
          updatedInBrokerVersion: '1.0.0',
          createdInBrokerVersion: '1.0.0',
          lastUpdated: expect.any(Date),
          manifest: ['some/existing/file.txt', 'some/other/file.txt']
        },
        mockDb
      )
      expect(trackEvent).toHaveBeenCalledWith(
        mockLogger,
        'version-update',
        'new-version',
        {
          kind: 'active',
          reference:
            'grant: example-grant-with-auth, version: 0.0.1, brokerVersion: 1.0.0'
        }
      )
      expect(result).to.eql({
        grant: 'example-grant-with-auth',
        manifest: ['some/existing/file.txt', 'some/other/file.txt'],
        path: 's3://test-bucket',
        version: '0.0.1',
        status: 'active',
        versionMajor: 0,
        versionMinor: 0,
        versionPatch: 1,
        isLatest: true
      })
    })

    it('non-existing version should call through to upload the files to S3, but return nothing if upload did not occur', async () => {
      getBucketName.mockReturnValueOnce('s3://test-bucket')
      uploadVersionFilesToS3.mockResolvedValueOnce([])

      const releaseInfo = getReleaseInfo()

      const result = await considerRelease(
        mockLogger,
        mockDb,
        releaseInfo,
        '1.0.0',
        'active'
      )

      expect(uploadVersionFilesToS3).toHaveBeenCalledWith(
        releaseInfo,
        'active',
        mockLogger
      )
      expect(storeVersion).not.toHaveBeenCalled()
      expect(result).to.eql(null)
    })

    it('non-existing version with external manifest should call through to upload metadata only to S3 return result', async () => {
      getBucketName.mockReturnValueOnce('s3://test-bucket')

      isLatestVersion.mockResolvedValueOnce(true)
      const releaseInfo = getReleaseInfo()
      const result = await considerRelease(
        mockLogger,
        mockDb,
        releaseInfo,
        '1.0.0',
        'active',
        [
          'example-grant-with-auth/0.0.1/some/existing/file.txt',
          'example-grant-with-auth/0.0.1/some/other/file.txt'
        ]
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'example-grant-with-auth 0.0.1 (active) already in S3, will update metadata only'
      )
      expect(uploadVersionFilesToS3).not.toHaveBeenCalled()
      expect(storeVersion).toHaveBeenCalledWith(
        {
          grant: 'example-grant-with-auth',
          version: '0.0.1',
          versionMajor: 0,
          versionMinor: 0,
          versionPatch: 1,
          status: 'active',
          updatedInBrokerVersion: '1.0.0',
          createdInBrokerVersion: '1.0.0',
          lastUpdated: expect.any(Date),
          manifest: [
            'example-grant-with-auth/0.0.1/some/existing/file.txt',
            'example-grant-with-auth/0.0.1/some/other/file.txt',
            'example-grant-with-auth/0.0.1/metadata.json'
          ]
        },
        mockDb
      )
      expect(trackEvent).toHaveBeenCalledWith(
        mockLogger,
        'version-update',
        'new-version',
        {
          kind: 'active',
          reference:
            'grant: example-grant-with-auth, version: 0.0.1, brokerVersion: 1.0.0'
        }
      )
      expect(result).to.eql({
        grant: 'example-grant-with-auth',
        manifest: [
          'example-grant-with-auth/0.0.1/some/existing/file.txt',
          'example-grant-with-auth/0.0.1/some/other/file.txt',
          'example-grant-with-auth/0.0.1/metadata.json'
        ],
        path: 's3://test-bucket',
        version: '0.0.1',
        status: 'active',
        versionMajor: 0,
        versionMinor: 0,
        versionPatch: 1,
        isLatest: true
      })
    })
  })
})
