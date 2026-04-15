import { load } from 'js-yaml'
import { readFileSync, existsSync } from 'node:fs'
import { deployNewVersion } from './deploy-version.js'
import { config } from './config.js'
import { getBucketName } from './storage/s3-interactions.js'
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

vi.mock('./repositories/version-management-repository.js')
vi.mock('./service/latest-version.js')
vi.mock('./storage/s3-interactions.js')
vi.mock('./upload-version-files-to-s3.js')
vi.mock('node:fs')
vi.mock('js-yaml')
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

  function mockLoadFileWithStatus(status = 'active') {
    load.mockReturnValueOnce({
      name: 'example-grant-with-auth',
      version: '0.0.1',
      notes: 'Some info about your release',
      environments: [
        {
          name: 'test',
          status
        }
      ]
    })
  }

  describe('deployNewVersion', () => {
    it('should print log message and return if job already run', async () => {
      hasVersionJobAlreadyRun.mockReset()
      hasVersionJobAlreadyRun.mockReturnValueOnce(true)

      await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Release version job already run, no need to run again'
      )
      expect(existsSync).not.toHaveBeenCalled()
    })

    it('should print log message and return if no release file found', async () => {
      existsSync.mockReturnValueOnce(false)

      await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No release file found, no new version available to deploy'
      )
      expect(readFileSync).not.toHaveBeenCalled()
    })

    it('should print messages and return if release file contains no release info for current environment', async () => {
      existsSync.mockReturnValueOnce(true)

      load.mockReturnValueOnce({
        name: 'example-grant-with-auth',
        version: '0.0.1',
        notes: 'Some info about your release',
        environments: []
      })
      await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'example-grant-with-auth 0.0.1 is not applicable to this environment'
      )
      expect(readFileSync).toHaveBeenCalled()
    })

    it('should print messages and return if release file indicates current environment not applicable for release', async () => {
      existsSync.mockReturnValueOnce(true)

      mockLoadFileWithStatus('none')

      await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'example-grant-with-auth 0.0.1 is not applicable to this environment'
      )
      expect(readFileSync).toHaveBeenCalled()
    })

    it('existing version with no status change should trigger no further action', async () => {
      existsSync.mockReturnValueOnce(true)
      mockLoadFileWithStatus()

      findVersion.mockResolvedValueOnce({
        grant: 'example-grant-with-auth',
        version: '0.0.1',
        status: 'active'
      })
      const result = await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'example-grant-with-auth Version 0.0.1 already deployed to S3, no status change'
      )
      expect(uploadMetaDataToS3).not.toHaveBeenCalled()
      expect(storeVersion).not.toHaveBeenCalled()
      expect(uploadVersionFilesToS3).not.toHaveBeenCalled()
      expect(result).to.eql([])
    })

    it('existing version with status change should upload metadata, update store version and return info', async () => {
      existsSync.mockReturnValueOnce(true)
      mockLoadFileWithStatus()

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

      const result = await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(uploadMetaDataToS3).toHaveBeenCalledWith(
        {
          name: 'example-grant-with-auth',
          version: '0.0.1',
          notes: 'Some info about your release',
          environments: [
            {
              name: 'test',
              status: 'active'
            }
          ]
        },
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
      expect(result).to.eql([
        {
          grant: 'example-grant-with-auth',
          manifest: ['some/existing/file.txt'],
          path: 's3://test-bucket',
          status: 'active',
          version: '0.0.1',
          versionMajor: 0,
          versionMinor: 0,
          versionPatch: 1,
          isLatest: false
        }
      ])
    })

    it('non-existing version should call through to upload the files to S3 for the release and return result', async () => {
      existsSync.mockReturnValueOnce(true)
      readFileSync.mockReturnValueOnce('release file content')

      getBucketName.mockReturnValueOnce('s3://test-bucket')
      uploadVersionFilesToS3.mockResolvedValueOnce([
        'some/existing/file.txt',
        'some/other/file.txt'
      ])

      mockLoadFileWithStatus()
      isLatestVersion.mockResolvedValueOnce(true)

      const result = await deployNewVersion(mockDb, mockLogger)

      expect(uploadVersionFilesToS3).toHaveBeenCalledWith(
        {
          name: 'example-grant-with-auth',
          version: '0.0.1',
          notes: 'Some info about your release',
          environments: [
            {
              name: 'test',
              status: 'active'
            }
          ]
        },
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
      expect(result).to.eql([
        {
          grant: 'example-grant-with-auth',
          manifest: ['some/existing/file.txt', 'some/other/file.txt'],
          path: 's3://test-bucket',
          version: '0.0.1',
          status: 'active',
          versionMajor: 0,
          versionMinor: 0,
          versionPatch: 1,
          isLatest: true
        }
      ])
    })

    it('non-existing version should call through to upload the files to S3, but return nothing if upload did not occur', async () => {
      existsSync.mockReturnValueOnce(true)
      readFileSync.mockReturnValueOnce('release file content')

      getBucketName.mockReturnValueOnce('s3://test-bucket')
      uploadVersionFilesToS3.mockResolvedValueOnce([])

      mockLoadFileWithStatus()

      const result = await deployNewVersion(mockDb, mockLogger)

      expect(uploadVersionFilesToS3).toHaveBeenCalledWith(
        {
          name: 'example-grant-with-auth',
          version: '0.0.1',
          notes: 'Some info about your release',
          environments: [
            {
              name: 'test',
              status: 'active'
            }
          ]
        },
        'active',
        mockLogger
      )
      expect(storeVersion).not.toHaveBeenCalled()
      expect(result).to.eql([])
    })
  })
})
