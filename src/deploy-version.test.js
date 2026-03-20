import { load } from 'js-yaml'
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs'
import { deployNewVersion } from './deploy-version.js'
import { config } from './config.js'
import { uploadBlob, getBucketName } from './storage/s3-interactions.js'
import { hasVersionJobAlreadyRun } from './repositories/version-management-repository.js'

vi.mock('./repositories/version-management-repository.js')
vi.mock('./storage/s3-interactions.js')
vi.mock('node:fs')
vi.mock('js-yaml')

describe('deploy-version', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }

  const mockDb = {}

  beforeEach(() => {
    config.set('cdpEnvironment', 'test')
    hasVersionJobAlreadyRun.mockResolvedValueOnce(false)
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

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
      // readFileSync.mockReturnValueOnce(releaseYaml)
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

      load.mockReturnValueOnce({
        name: 'example-grant-with-auth',
        version: '0.0.1',
        notes: 'Some info about your release',
        environments: [
          {
            name: 'test',
            status: 'none'
          }
        ]
      })
      await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'example-grant-with-auth 0.0.1 is not applicable to this environment'
      )
      expect(readFileSync).toHaveBeenCalled()
    })

    it('should print warning if release file found but grant config not found', async () => {
      existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false)
      load.mockReturnValueOnce({
        name: 'example-grant-with-auth',
        version: '0.0.1',
        notes: 'Some info about your release',
        environments: [
          {
            name: 'test',
            status: 'active'
          }
        ]
      })
      await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Config folder for example-grant-with-auth not found, so not doing any upload'
      )
      expect(uploadBlob).not.toHaveBeenCalled()
    })

    it('should print warning if release file found but grant config not a directory', async () => {
      existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
      lstatSync.mockReturnValueOnce({ isDirectory: () => false })
      load.mockReturnValueOnce({
        name: 'example-grant-with-auth',
        version: '0.0.1',
        notes: 'Some info about your release',
        environments: [
          {
            name: 'test',
            status: 'active'
          }
        ]
      })
      const result = await deployNewVersion(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Config folder for example-grant-with-auth not found, so not doing any upload'
      )
      expect(uploadBlob).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should call through to upload each of the files to S3 for the release', async () => {
      existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
      lstatSync
        .mockReturnValueOnce({ isDirectory: () => true })
        .mockReturnValueOnce({ isDirectory: () => true })
        .mockReturnValueOnce({ isDirectory: () => false })
        .mockReturnValueOnce({ isDirectory: () => false })
      readdirSync.mockReturnValueOnce([
        'grants-ui',
        'grants-ui/file1.txt',
        'grants-ui/file2.txt'
      ])
      readFileSync
        .mockReturnValueOnce('release file content')
        .mockReturnValueOnce('content1')
        .mockReturnValueOnce('content2')

      getBucketName.mockReturnValueOnce('s3://test-bucket')

      load.mockReturnValueOnce({
        name: 'example-grant-with-auth',
        version: '0.0.1',
        notes: 'Some info about your release',
        environments: [
          {
            name: 'test',
            status: 'active'
          }
        ]
      })
      const result = await deployNewVersion(mockDb, mockLogger)

      expect(uploadBlob).toHaveBeenCalledTimes(3)
      expect(uploadBlob).toHaveBeenCalledWith(
        mockLogger,
        'example-grant-with-auth/0.0.1/grants-ui/file1.txt',
        'content1'
      )
      expect(uploadBlob).toHaveBeenCalledWith(
        mockLogger,
        'example-grant-with-auth/0.0.1/grants-ui/file2.txt',
        'content2'
      )
      expect(uploadBlob).toHaveBeenCalledWith(
        mockLogger,
        'example-grant-with-auth/0.0.1/metadata.json',
        '{"status":"active","releaseNotes":"Some info about your release"}'
      )
      expect(result).to.eql({
        grant: 'example-grant-with-auth',
        manifest: [
          'example-grant-with-auth/0.0.1/grants-ui/file1.txt',
          'example-grant-with-auth/0.0.1/grants-ui/file2.txt',
          'example-grant-with-auth/0.0.1/metadata.json'
        ],
        path: 's3://test-bucket',
        version: '0.0.1',
        status: 'active'
      })
    })
  })
})
