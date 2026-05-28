import { processInputMessage } from './process-message.js'
import { listFiles } from '../../storage/s3-interactions.js'
import { considerRelease } from '../../deploy-version.js'
import { notifyVersion } from '../outbound/notify-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'

vi.mock('../../deploy-version.js')
vi.mock('../../utils/get-service-version.js')
vi.mock('../outbound/notify-version.js')
vi.mock('../../storage/s3-interactions.js')

describe('Process Message test', () => {
  const mockDb = {}
  const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    getServiceVersion.mockReturnValueOnce('1.0.0')
    listFiles.mockResolvedValue([])
  })

  it('should call considerRelease but no further action when version not released', async () => {
    listFiles.mockResolvedValueOnce([{ Key: 'some-grant/1.0.0/some/file.txt' }])
    considerRelease.mockResolvedValueOnce(null)
    await processInputMessage(
      {
        grant: 'some-grant',
        status: 'draft',
        version: '1.0.0',
        files: ['some-grant/1.0.0/some/file.txt']
      },
      mockDb,
      mockLogger
    )

    expect(considerRelease).toHaveBeenCalledWith(
      mockLogger,
      mockDb,
      { name: 'some-grant', version: '1.0.0' },
      '1.0.0',
      'draft',
      ['some-grant/1.0.0/some/file.txt']
    )
    expect(notifyVersion).not.toHaveBeenCalled()
  })

  it('should send notification when version is released', async () => {
    listFiles.mockResolvedValueOnce([{ Key: 'some-grant/1.0.0/some/file.txt' }])
    const releaseInfo = {
      grant: 'some-grant',
      version: '1.0.0',
      status: 'draft',
      manifest: ['some-grant/1.0.0/some/file.txt'],
      updatedInBrokerVersion: '1.0.0',
      createdInBrokerVersion: '1.0.0',
      lastUpdated: new Date(),
      versionMajor: 1,
      versionMinor: 0,
      versionPatch: 0
    }
    considerRelease.mockResolvedValueOnce(releaseInfo)

    await processInputMessage(
      {
        grant: 'some-grant',
        status: 'draft',
        version: '1.0.0',
        files: ['some-grant/1.0.0/some/file.txt']
      },
      mockDb,
      mockLogger
    )

    expect(considerRelease).toHaveBeenCalledWith(
      mockLogger,
      mockDb,
      { name: 'some-grant', version: '1.0.0' },
      '1.0.0',
      'draft',
      ['some-grant/1.0.0/some/file.txt']
    )
    expect(notifyVersion).toHaveBeenCalledWith(releaseInfo, mockLogger)
  })

  it('should default status to draft if not specified', async () => {
    listFiles.mockResolvedValueOnce([{ Key: 'some-grant/1.0.0/some/file.txt' }])
    considerRelease.mockResolvedValueOnce(null)
    await processInputMessage(
      {
        grant: 'some-grant',
        version: '1.0.0',
        files: ['some-grant/1.0.0/some/file.txt']
      },
      mockDb,
      mockLogger
    )
    expect(considerRelease).toHaveBeenCalledWith(
      mockLogger,
      mockDb,
      { name: 'some-grant', version: '1.0.0' },
      '1.0.0',
      'draft',
      ['some-grant/1.0.0/some/file.txt']
    )
  })

  it('should catch and log an error if thrown', async () => {
    listFiles.mockResolvedValueOnce([{ Key: 'some-grant/1.0.0/some/file.txt' }])
    considerRelease.mockRejectedValueOnce(new Error('Some error'))

    await processInputMessage(
      {
        grant: 'some-grant',
        version: '1.0.0',
        files: ['some-grant/1.0.0/some/file.txt']
      },
      mockDb,
      mockLogger
    )

    expect(considerRelease).toHaveBeenCalled()
    expect(notifyVersion).not.toHaveBeenCalled()
    expect(mockLogger.error).toHaveBeenCalledWith(
      new Error('Some error'),
      'Unable to process Input request:'
    )
  })

  it('should throw error and log it if files are missing in S3', async () => {
    listFiles.mockResolvedValueOnce([{ Key: 'some-grant/1.0.0/file1.txt' }])

    await processInputMessage(
      {
        grant: 'some-grant',
        version: '1.0.0',
        files: ['some-grant/1.0.0/file1.txt', 'some-grant/1.0.0/file2.txt']
      },
      mockDb,
      mockLogger
    )

    expect(listFiles).toHaveBeenCalledWith(mockLogger, 'some-grant/1.0.0')
    expect(considerRelease).not.toHaveBeenCalled()
    expect(mockLogger.error).toHaveBeenCalledWith(
      new Error(
        'Missing files in S3, cannot publish this config version: some-grant/1.0.0/file2.txt'
      ),
      'Unable to process Input request:'
    )
  })

  it('should throw error and log it if no files are found in S3', async () => {
    listFiles.mockResolvedValueOnce([])

    await processInputMessage(
      {
        grant: 'some-grant',
        version: '1.0.0',
        files: ['file1.txt']
      },
      mockDb,
      mockLogger
    )

    expect(mockLogger.error).toHaveBeenCalledWith(
      new Error(
        'Missing files in S3, cannot publish this config version: file1.txt'
      ),
      'Unable to process Input request:'
    )
  })
})
