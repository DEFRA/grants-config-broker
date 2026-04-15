import hapi from '@hapi/hapi'

const mockLogger = {
  info: vi.fn(),
  error: vi.fn()
}

describe('#startServer', () => {
  let createServerSpy
  let hapiServerSpy
  let deployNewVersionSpy
  let loggerSpy
  let notifySpy
  let startServerImport
  let createServerImport
  let deployNewVersionImport
  let loggerImport
  let notifyImport
  let server

  beforeAll(async () => {
    vi.stubEnv('PORT', '3098')
    createServerImport = await import('../../server.js')
    startServerImport = await import('./start-server.js')
    deployNewVersionImport = await import('../../deploy-version.js')
    loggerImport = await import('./logging/logger.js')
    notifyImport = await import('../../notify-version.js')

    createServerSpy = vi.spyOn(createServerImport, 'createServer')
    hapiServerSpy = vi.spyOn(hapi, 'server')
    deployNewVersionSpy = vi.spyOn(deployNewVersionImport, 'deployNewVersion')
    loggerSpy = vi.spyOn(loggerImport, 'getLogger')
    notifySpy = vi.spyOn(notifyImport, 'notifyVersion')
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('When server starts', () => {
    test('Should start up server as expected', async () => {
      server = await startServerImport.startServer()

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()
    })

    test('Should send out notifications if version deployed', async () => {
      deployNewVersionSpy.mockResolvedValue([
        { grant: 'example-grant', version: '0.0.1' }
      ])
      loggerSpy.mockReturnValue(mockLogger)
      notifySpy.mockResolvedValue(true)

      await startServerImport.startServer()

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()
      expect(notifySpy).toHaveBeenCalledWith(
        {
          grant: 'example-grant',
          version: '0.0.1'
        },
        mockLogger
      )
    })
  })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Server failed to start'
      )
    })
  })
})
