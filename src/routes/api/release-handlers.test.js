import { postReleaseConfigHandler } from './release-handlers.js'
import { getServiceVersion } from '../../utils/get-service-version.js'

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
    it('should send message via SQS and return accepted', async () => {
      const mockSendMessage = vi
        .fn()
        .mockResolvedValueOnce({ MessageId: '123' })
      const mockRequest = {
        payload: {
          grant: 'some-grant',
          status: 'draft',
          version: '1.0.0',
          files: ['some/file.txt']
        },
        logger: mockLogger,
        db: mockDb,
        server: {
          methods: {
            sendMessage: mockSendMessage
          }
        }
      }
      const result = await postReleaseConfigHandler(mockRequest, mockH)
      expect(result).toEqual(mockH)
      expect(mockSendMessage).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: 'draft',
        version: '1.0.0',
        files: ['some/file.txt']
      })
      expect(mockH.code).toHaveBeenCalledWith(202)
    })
  })
})
