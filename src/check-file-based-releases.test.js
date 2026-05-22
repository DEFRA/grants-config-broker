import { load } from 'js-yaml'
import { readFileSync, existsSync } from 'node:fs'
import { checkReleaseFileForVersionDeployment } from './check-file-based-releases.js'
import { config } from './config.js'
import { hasVersionJobAlreadyRun } from './repositories/version-management-repository.js'
import { considerRelease } from './deploy-version.js'

vi.mock('./repositories/version-management-repository.js')
vi.mock('./service/latest-version.js')
vi.mock('./upload-version-files-to-s3.js')
vi.mock('node:fs')
vi.mock('js-yaml')
vi.mock('./common/helpers/logging/logger.js')
vi.mock('./deploy-version.js')

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

  describe('checkReleaseFileForVersionDeployment', () => {
    it('should print log message and return if job already run', async () => {
      hasVersionJobAlreadyRun.mockReset()
      hasVersionJobAlreadyRun.mockReturnValueOnce(true)

      await checkReleaseFileForVersionDeployment(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Release version job already run, no need to run again'
      )
      expect(existsSync).not.toHaveBeenCalled()
    })

    it('should print log message and return if no release file found', async () => {
      existsSync.mockReturnValueOnce(false)

      await checkReleaseFileForVersionDeployment(mockDb, mockLogger)

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
      await checkReleaseFileForVersionDeployment(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'example-grant-with-auth 0.0.1 is not applicable to this environment'
      )
      expect(readFileSync).toHaveBeenCalled()
    })

    it('should print messages and return if release file indicates current environment not applicable for release', async () => {
      existsSync.mockReturnValueOnce(true)

      mockLoadFileWithStatus('none')

      await checkReleaseFileForVersionDeployment(mockDb, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'example-grant-with-auth 0.0.1 is not applicable to this environment'
      )
      expect(readFileSync).toHaveBeenCalled()
    })

    it('should call through to considerRelease, and return releaseVersionInfo if status found and relevant for environment', async () => {
      existsSync.mockReturnValueOnce(true)
      mockLoadFileWithStatus()
      considerRelease.mockResolvedValueOnce({ grant: 'example-grant' })

      const result = await checkReleaseFileForVersionDeployment(
        mockDb,
        mockLogger
      )

      expect(result).to.eql([{ grant: 'example-grant' }])
      expect(mockLogger.info).toHaveBeenCalledWith('Release file found')
      expect(considerRelease).toHaveBeenCalled()
    })
  })
})
