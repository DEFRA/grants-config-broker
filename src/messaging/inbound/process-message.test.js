import { processInputMessage } from './process-message.js'
import { considerRelease } from '../../deploy-version.js'
import { notifyVersion } from '../outbound/notify-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'

vi.mock('../../deploy-version.js')
vi.mock('../../utils/get-service-version.js')
vi.mock('../outbound/notify-version.js')

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
  })

  it('should call considerRelease but no further action when version not released', async () => {
    considerRelease.mockResolvedValueOnce(null)
    await processInputMessage(
      {
        grant: 'some-grant',
        status: 'draft',
        version: '1.0.0',
        files: ['some/file.txt']
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
      ['some/file.txt']
    )
    expect(notifyVersion).not.toHaveBeenCalled()
  })

  it('should send notification when version is released', async () => {
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

    await processInputMessage(
      {
        grant: 'some-grant',
        status: 'draft',
        version: '1.0.0',
        files: ['some/file.txt']
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
      ['some/file.txt']
    )
    expect(notifyVersion).toHaveBeenCalledWith(releaseInfo, mockLogger)
  })

  it('should default status to draft if not specified', async () => {
    considerRelease.mockResolvedValueOnce(null)
    await processInputMessage(
      {
        grant: 'some-grant',
        version: '1.0.0',
        files: ['some/file.txt']
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
      ['some/file.txt']
    )
  })

  it('should catch and log an error if thrown', async () => {
    considerRelease.mockThrowOnce(new Error('Some error'))

    await processInputMessage({}, mockDb, mockLogger)

    expect(considerRelease).toHaveBeenCalled()
    expect(notifyVersion).not.toHaveBeenCalled()
    expect(mockLogger.error).toHaveBeenCalledWith(
      new Error('Some error'),
      'Unable to process Input request:'
    )
  })
})
