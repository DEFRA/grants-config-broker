import { publishMessage, setupClient } from './common/helpers/sns-client.js'
import { notifyVersion } from './notify-version.js'

vi.mock('./common/helpers/sns-client.js')

describe('notify-version', () => {
  const childLogger = {}
  const mockLogger = {
    child: vi.fn().mockReturnValue(childLogger)
  }

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  describe('notifyVersion', () => {
    it('should setup client and send on notification', async () => {
      const manifest = [
        'example-grant-with-auth/0.0.1/grants-ui/file1.txt',
        'example-grant-with-auth/0.0.1/grants-ui/file2.txt',
        'example-grant-with-auth/0.0.1/metadata.json'
      ]
      await notifyVersion(
        {
          grant: 'example-grant-with-auth',
          manifest,
          path: 's3://test-bucket',
          version: '0.0.1',
          status: 'draft'
        },
        mockLogger
      )

      expect(setupClient).toHaveBeenCalledWith(
        'eu-west-2',
        null,
        childLogger,
        expect.any(String)
      )
      expect(publishMessage).toHaveBeenCalledWith(manifest, {
        grant: 'example-grant-with-auth',
        path: 's3://test-bucket',
        version: '0.0.1',
        status: 'draft'
      })
    })
  })
})
