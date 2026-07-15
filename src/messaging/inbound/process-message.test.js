import { processInputMessage } from './process-message.js'
import { considerRelease } from '../../deploy-version.js'
import { notifyVersion } from '../outbound/notify-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'
import { listFiles } from '@defra/grants-config-utils/s3-interactions'

vi.mock('../../deploy-version.js')
vi.mock('../../utils/get-service-version.js')
vi.mock('../outbound/notify-version.js')
vi.mock('@defra/grants-config-utils/s3-interactions')

describe('Process Message test', () => {
  const mockDb = {}
  const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
  const mockServer = {
    methods: {
      aliasLookup: vi.fn()
    }
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    getServiceVersion.mockReturnValueOnce('1.0.0')
    listFiles.mockResolvedValue([])
    mockServer.methods.aliasLookup.mockReturnValue([])
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
      mockLogger,
      {},
      mockServer
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
    const user = 'test-user'
    considerRelease.mockResolvedValueOnce(releaseInfo)

    await processInputMessage(
      {
        grant: 'some-grant',
        status: 'draft',
        version: '1.0.0',
        files: ['some-grant/1.0.0/some/file.txt'],
        user
      },
      mockDb,
      mockLogger,
      {},
      mockServer
    )

    expect(considerRelease).toHaveBeenCalledWith(
      mockLogger,
      mockDb,
      { name: 'some-grant', version: '1.0.0' },
      '1.0.0',
      'draft',
      ['some-grant/1.0.0/some/file.txt']
    )
    expect(notifyVersion).toHaveBeenCalledWith(releaseInfo, user, mockLogger)
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
      mockLogger,
      {},
      mockServer
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

  it('if incoming message does not validate via schema an error is thrown', async () => {
    await expect(
      processInputMessage(
        {
          grant: 'some-grant',
          version: '1.0.0'
        },
        mockDb,
        mockLogger,
        {},
        mockServer
      )
    ).rejects.toThrow('"files" is required')

    expect(considerRelease).not.toHaveBeenCalled()
    expect(notifyVersion).not.toHaveBeenCalled()
  })

  it('should throw error if files are missing in S3', async () => {
    listFiles.mockResolvedValueOnce([{ Key: 'some-grant/1.0.0/file1.txt' }])

    await expect(
      processInputMessage(
        {
          grant: 'some-grant',
          version: '1.0.0',
          files: ['some-grant/1.0.0/file1.txt', 'some-grant/1.0.0/file2.txt']
        },
        mockDb,
        mockLogger,
        {},
        mockServer
      )
    ).rejects.toThrow(
      'Missing files in S3, cannot publish this config version: some-grant/1.0.0/file2.txt'
    )

    expect(listFiles).toHaveBeenCalledWith(mockLogger, 'some-grant/1.0.0')
    expect(considerRelease).not.toHaveBeenCalled()
  })

  it('should throw error if no files are found in S3', async () => {
    listFiles.mockResolvedValueOnce([])

    await expect(
      processInputMessage(
        {
          grant: 'some-grant',
          version: '1.0.0',
          files: ['file1.txt']
        },
        mockDb,
        mockLogger,
        {},
        mockServer
      )
    ).rejects.toThrow(
      'Missing files in S3, cannot publish this config version: file1.txt'
    )
  })

  it('should send multiple notifications if aliases are found', async () => {
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
    const user = 'test-user'
    considerRelease.mockResolvedValueOnce(releaseInfo)
    mockServer.methods.aliasLookup.mockReturnValueOnce(['alias-1', 'alias-2'])

    await processInputMessage(
      {
        grant: 'some-grant',
        status: 'draft',
        version: '1.0.0',
        files: ['some-grant/1.0.0/some/file.txt'],
        user
      },
      mockDb,
      mockLogger,
      {},
      mockServer
    )

    expect(notifyVersion).toHaveBeenCalledTimes(3)
    expect(notifyVersion).toHaveBeenCalledWith(releaseInfo, user, mockLogger)
    expect(notifyVersion).toHaveBeenCalledWith(
      { ...releaseInfo, grant: 'alias-1' },
      user,
      mockLogger
    )
    expect(notifyVersion).toHaveBeenCalledWith(
      { ...releaseInfo, grant: 'alias-2' },
      user,
      mockLogger
    )
  })
})
