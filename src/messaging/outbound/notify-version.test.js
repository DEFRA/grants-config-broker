import { notifyVersion } from './notify-version.js'
import { metricsCounter } from '../../common/helpers/metrics.js'
import { publishEvent } from '../../common/helpers/audit/event-publisher.js'
import {
  isClientSetup,
  publishMessage,
  setupClient
} from '@defra/grants-config-utils/sns-client'

vi.mock('@defra/grants-config-utils/sns-client')
vi.mock('../../common/helpers/metrics.js')
vi.mock('../../common/helpers/audit/event-publisher.js')

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
    const manifest = [
      'example-grant-with-auth/0.0.1/grants-ui/file1.txt',
      'example-grant-with-auth/0.0.1/grants-ui/file2.txt',
      'example-grant-with-auth/0.0.1/metadata.json'
    ]
    const notifyDetails = {
      grant: 'example-grant-with-auth',
      manifest,
      path: 's3://test-bucket',
      version: '0.0.1',
      versionMajor: 0,
      versionMinor: 0,
      versionPatch: 1,
      status: 'draft'
    }
    const user = 'test-user'

    it('should setup client and send on notification', async () => {
      await notifyVersion(notifyDetails, user, mockLogger)

      expect(setupClient).toHaveBeenCalledWith(childLogger, {
        region: 'eu-west-2',
        endpoint: null,
        publishToTopic: expect.any(String)
      })
      expect(publishMessage).toHaveBeenCalledWith(
        manifest,
        {
          grant: 'example-grant-with-auth',
          path: 's3://test-bucket',
          version: '0.0.1',
          status: 'draft'
        },
        expect.any(String)
      )
      expect(metricsCounter).toHaveBeenCalledWith(
        'notification_published-version'
      )
      expect(publishEvent).toHaveBeenCalledWith(
        {
          entities: [
            {
              entity: 'configuration',
              action: 'released',
              entityid: 'example-grant-with-auth:0.0.1'
            }
          ],
          status: 'success',
          details: {
            grant: 'example-grant-with-auth',
            configVersion: '0.0.1',
            configStatus: 'draft'
          }
        },
        user,
        mockLogger
      )
    })

    it('should skip setup client and send on notification if client already setup', async () => {
      isClientSetup.mockReturnValueOnce(true)

      await notifyVersion(notifyDetails, user, mockLogger)

      expect(setupClient).not.toHaveBeenCalled()
      expect(publishMessage).toHaveBeenCalled()
      expect(metricsCounter).toHaveBeenCalled()
      expect(publishEvent).toHaveBeenCalled()
    })
  })
})
