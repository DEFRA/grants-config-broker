import {
  getAllGrantsHandler,
  getAllVersionsHandler,
  getLatestVersionHandler,
  getSpecificVersionHandler,
  getVersionHistoryHandler,
  postArchiveVersionHandler,
  postUnarchiveVersionHandler
} from './version-handlers.js'
import {
  findVersion,
  findVersionHistory,
  getAllGrantsAllVersions,
  getAllVersionsWithConstraints,
  getLatestVersionWithConstraints,
  storeVersion
} from '../../../repositories/version-management-repository.js'
import { metricsCounter } from '../../../common/helpers/metrics.js'
import { getBucketName } from '../../../utils/release-utils.js'
import { StatusCodes } from 'http-status-codes'
import { publishEvent } from '../../../common/helpers/audit/event-publisher.js'

vi.mock('../../../repositories/version-management-repository.js')
vi.mock('../../../utils/release-utils.js')
vi.mock('../../../common/helpers/metrics.js')
vi.mock('../../../common/helpers/audit/event-publisher.js')

// We need to seed rows oldest-first, so the latest version of a major is the
// last one with that major. We also assume a single grant and ignore status.
const seedRepo = (rows = []) => {
  findVersion.mockImplementation((version, grant) =>
    rows.find((r) => r.version === version && r.grant === grant)
  )

  storeVersion.mockImplementation((doc) => {
    rows.push({ ...doc })
    return { acknowledged: true, insertedId: 'test-id' }
  })

  getLatestVersionWithConstraints.mockImplementation(({ major }) => {
    const inMajor = rows.filter((r) => Number(r.version.split('.')[0]) === major)
    const latest = inMajor[inMajor.length - 1]
    return latest ? [latest] : []
  })

  return rows
}

const responseFake = () => ({
  response(source) {
    return {
      source, // Hapi calls the payload `source`
      statusCode: undefined,
      code(statusCode) {
        this.statusCode = statusCode
        return this
      },
      takeover() {
        this.takenOver = true
        return this
      }
    }
  }
})

describe('version-handlers', () => {
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
    getBucketName.mockReturnValueOnce('s3://test-bucket')
  })

  describe('getLatestVersionHandler', () => {
    beforeEach(() => {
      getLatestVersionWithConstraints.mockResolvedValueOnce([
        {
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
      ])
    })
    it('should return formatted response of the latest version when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'include',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: null,
        major: 1,
        minor: 0,
        db: mockDb
      })
      expect(mockH.response).toHaveBeenCalledWith({
        grant: 'some-grant',
        version: '1.0.0',
        status: 'draft',
        manifest: ['some/file.txt'],
        lastUpdated: expect.any(Date),
        path: 's3://test-bucket'
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through status indicator of draft when only draft selected', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'only'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: 'draft',
        db: mockDb
      })
    })

    it('should pass through status indicator of active when draft option not selected', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: 'active',
        db: mockDb
      })
    })

    it('should return not found response if no version present for constraints specified', async () => {
      getLatestVersionWithConstraints.mockReset()
      getLatestVersionWithConstraints.mockResolvedValueOnce([])
      const mockRequest = {
        query: {
          grant: 'some-grant',
          constrainMajor: 1
        },
        logger: mockLogger,
        db: mockDb
      }
      await getLatestVersionHandler(mockRequest, mockH)
      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: 'active',
        major: 1,
        db: mockDb
      })
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Grant some-grant with version constraints not found'
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })

  describe('getSpecificVersionHandler', () => {
    beforeEach(() => {
      findVersion.mockResolvedValueOnce({
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
      })
    })
    it('should return formatted response of the latest version when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getSpecificVersionHandler(mockRequest, mockH)
      expect(findVersion).toHaveBeenCalledWith('1.0.0', 'some-grant', mockDb)
      expect(mockH.response).toHaveBeenCalledWith({
        grant: 'some-grant',
        version: '1.0.0',
        status: 'draft',
        manifest: ['some/file.txt'],
        lastUpdated: expect.any(Date),
        path: 's3://test-bucket'
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through version built from component parts', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          major: 1,
          minor: 2,
          patch: 3
        },
        logger: mockLogger,
        db: mockDb
      }
      await getSpecificVersionHandler(mockRequest, mockH)
      expect(findVersion).toHaveBeenCalledWith('1.2.3', 'some-grant', mockDb)
    })

    it('should return not found response if no version present for constraints specified', async () => {
      findVersion.mockReset()
      findVersion.mockResolvedValueOnce(null)
      const mockRequest = {
        query: {
          grant: 'nonexisting-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getSpecificVersionHandler(mockRequest, mockH)
      expect(findVersion).toHaveBeenCalledWith(
        '1.0.0',
        'nonexisting-grant',
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Grant nonexisting-grant version 1.0.0 not found'
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })

  describe('getAllVersionsHandler', () => {
    beforeEach(() => {
      getAllVersionsWithConstraints.mockResolvedValueOnce([
        {
          grant: 'some-grant',
          version: '1.0.0',
          status: 'draft',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.0'
        },
        {
          grant: 'some-grant',
          version: '1.0.1',
          status: 'active',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.1'
        }
      ])
    })

    it('should return all versions when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(getAllVersionsWithConstraints).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: 'active',
        db: mockDb
      })
      expect(mockH.response).toHaveBeenCalledWith([
        {
          grant: 'some-grant',
          version: '1.0.0',
          status: 'draft',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.0'
        },
        {
          grant: 'some-grant',
          version: '1.0.1',
          status: 'active',
          manifest: ['some/file.txt'],
          updatedInBrokerVersion: '1.0.1'
        }
      ])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through optional draft only constraint', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'only',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(getAllVersionsWithConstraints).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: 'draft',
        major: 1,
        minor: 0,
        db: mockDb
      })
    })

    it('should pass through optional draft included constraint', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'include',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(getAllVersionsWithConstraints).toHaveBeenCalledWith({
        grant: 'some-grant',
        status: null,
        major: 1,
        minor: 0,
        db: mockDb
      })
    })

    it('should return empty array if nothing found', async () => {
      getAllVersionsWithConstraints.mockReset()
      getAllVersionsWithConstraints.mockResolvedValueOnce([])
      const mockRequest = {
        query: {
          grant: 'some-grant',
          draft: 'include',
          constrainMajor: 1,
          constrainMinor: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllVersionsHandler(mockRequest, mockH)
      expect(mockH.response).toHaveBeenCalledWith([])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('getAllGrantsHandler', () => {
    beforeEach(() => {
      getAllGrantsAllVersions.mockResolvedValueOnce([
        {
          grant: 'some-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            },
            {
              version: '1.0.1',
              status: 'active',
              updatedInBrokerVersion: '1.0.1'
            }
          ]
        },
        {
          grant: 'other-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            }
          ]
        }
      ])
    })

    it('should return all grant versions when found', async () => {
      const mockRequest = {
        query: {},
        logger: mockLogger,
        db: mockDb
      }
      await getAllGrantsHandler(mockRequest, mockH)
      expect(getAllGrantsAllVersions).toHaveBeenCalledWith({
        status: 'active',
        db: mockDb
      })
      expect(mockH.response).toHaveBeenCalledWith([
        {
          grant: 'some-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            },
            {
              version: '1.0.1',
              status: 'active',
              updatedInBrokerVersion: '1.0.1'
            }
          ]
        },
        {
          grant: 'other-grant',
          versions: [
            {
              version: '1.0.0',
              status: 'draft',
              updatedInBrokerVersion: '1.0.0'
            }
          ]
        }
      ])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through optional draft only constraint', async () => {
      const mockRequest = {
        query: {
          draft: 'only'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllGrantsHandler(mockRequest, mockH)
      expect(getAllGrantsAllVersions).toHaveBeenCalledWith({
        status: 'draft',
        db: mockDb
      })
    })

    it('should pass through optional draft included constraint', async () => {
      const mockRequest = {
        query: {
          draft: 'include'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getAllGrantsHandler(mockRequest, mockH)
      expect(getAllGrantsAllVersions).toHaveBeenCalledWith({
        status: null,
        db: mockDb
      })
    })
  })

  describe('getVersionHistoryHandler', () => {
    beforeEach(() => {
      findVersionHistory.mockResolvedValueOnce([
        {
          version: '1.0.0',
          status: 'draft'
        },
        {
          version: '1.0.0',
          status: 'active'
        },
        {
          version: '1.0.0',
          status: 'draft'
        }
      ])
    })

    it('should return grant version history for semantic version when found', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getVersionHistoryHandler(mockRequest, mockH)
      expect(findVersionHistory).toHaveBeenCalledWith(
        '1.0.0',
        'some-grant',
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith([
        {
          version: '1.0.0',
          status: 'draft'
        },
        {
          version: '1.0.0',
          status: 'active'
        },
        {
          version: '1.0.0',
          status: 'draft'
        }
      ])
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should pass through version made from component parts', async () => {
      const mockRequest = {
        query: {
          grant: 'some-grant',
          major: 1,
          minor: 0,
          patch: 0
        },
        logger: mockLogger,
        db: mockDb
      }
      await getVersionHistoryHandler(mockRequest, mockH)
      expect(findVersionHistory).toHaveBeenCalledWith(
        '1.0.0',
        'some-grant',
        mockDb
      )
    })

    it('should return not found response if version not present in environment', async () => {
      findVersionHistory.mockReset()
      findVersionHistory.mockResolvedValueOnce([])
      const mockRequest = {
        query: {
          grant: 'nonexisting-grant',
          version: '1.0.0'
        },
        logger: mockLogger,
        db: mockDb
      }
      await getVersionHistoryHandler(mockRequest, mockH)
      expect(findVersionHistory).toHaveBeenCalledWith(
        '1.0.0',
        'nonexisting-grant',
        mockDb
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Grant nonexisting-grant version 1.0.0 not found'
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })

  describe('postArchiveVersionHandler', () => {
    describe('When the version exists', () => {
      describe('when the version is archived', () => {
        let rows
        let response
        beforeEach(async () => {
          rows = seedRepo([
            {
              grant: 'a grant',
              version: '1.0.0',
              archived: true
            }
          ])
          const mockRequest = {
            body: {
              grant: 'a grant',
              version: '1.0.0'
            },
            logger: mockLogger,
            db: mockDb
          }
          response = await postArchiveVersionHandler(
            mockRequest,
            responseFake()
          )
        })

        it('returns a status of OK', async () => {
          expect(response.statusCode).toBe(StatusCodes.OK)
        })

        it('returns the archived result', () => {
          expect(response.source).toEqual({ result: 'archived' })
        })

        it('should not have created a new entry', () => {
          expect(rows).toHaveLength(1)
        })

        it('does not increment the archived metric', () => {
          expect(metricsCounter).not.toHaveBeenCalled()
        })

        it('does not publish an audit event', () => {
          expect(publishEvent).not.toHaveBeenCalled()
        })
      })

      describe('when the version is unarchived', () => {
        let rows
        let response
        beforeEach(async () => {
          rows = seedRepo([
            {
              grant: 'a grant',
              version: '1.0.0'
            },
            {
              grant: 'a grant',
              version: '1.1.0'
            }
          ])
          const mockRequest = {
            body: {
              grant: 'a grant',
              version: '1.0.0',
              user: 'someone'
            },
            logger: mockLogger,
            db: mockDb
          }
          response = await postArchiveVersionHandler(
            mockRequest,
            responseFake()
          )
        })

        it('returns a status of OK', () => {
          expect(response.statusCode).toBe(StatusCodes.OK)
        })

        it('returns the archived result', () => {
          expect(response.source).toEqual({ result: 'archived' })
        })

        it('increments the archived metric', () => {
          expect(metricsCounter).toHaveBeenCalledWith('version-archived')
        })

        it('publishes an archived audit event', () => {
          expect(publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              entities: [
                expect.objectContaining({
                  action: 'archived',
                  entityid: 'a grant:1.0.0'
                })
              ],
              status: 'success'
            }),
            'someone',
            mockLogger
          )
        })

        it('creates a new db entry with the archived field', () => {
          expect(rows).toHaveLength(3)
          expect(rows[2].archived).toBe(true)
        })
      })
    })

    describe('When is the latest version', () => {
      let rows
      let response
      beforeEach(async () => {
        rows = seedRepo([
          {
            grant: 'a grant',
            version: '1.0.0'
          }
        ])
        const mockRequest = {
          body: {
            grant: 'a grant',
            version: '1.0.0',
            user: 'someone'
          },
          logger: mockLogger,
          db: mockDb
        }
        response = await postArchiveVersionHandler(mockRequest, responseFake())
      })

      it('returns a status of bad request', () => {
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST)
      })

      it('should not have created a new entry', () => {
        expect(rows).toHaveLength(1)
      })

      it('returns the error message', () => {
        expect(response.source).toEqual({
          error: 'Cannot archive the latest version'
        })
      })

      it('does not increment the archived metric', () => {
        expect(metricsCounter).not.toHaveBeenCalled()
      })

      it('does not publish an audit event', () => {
        expect(publishEvent).not.toHaveBeenCalled()
      })
    })

    describe('When is the latest version of an older major', () => {
      let rows
      let response
      beforeEach(async () => {
        rows = seedRepo([
          { grant: 'a grant', version: '1.0.0' },
          { grant: 'a grant', version: '1.1.0' },
          { grant: 'a grant', version: '2.0.0' }
        ])
        const mockRequest = {
          body: {
            grant: 'a grant',
            version: '1.1.0',
            user: 'someone'
          },
          logger: mockLogger,
          db: mockDb
        }
        response = await postArchiveVersionHandler(mockRequest, responseFake())
      })

      it('returns a status of bad request', () => {
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST)
      })

      it('should not have created a new entry', () => {
        expect(rows).toHaveLength(3)
      })

      it('returns the error message', () => {
        expect(response.source).toEqual({
          error: 'Cannot archive the latest version'
        })
      })

      it('does not increment the archived metric', () => {
        expect(metricsCounter).not.toHaveBeenCalled()
      })

      it('does not publish an audit event', () => {
        expect(publishEvent).not.toHaveBeenCalled()
      })
    })

    describe('When the version does not exists', () => {
      let rows
      let response
      beforeEach(async () => {
        rows = seedRepo([
          {
            grant: 'a grant',
            version: '1.0.0'
          }
        ])
        const mockRequest = {
          body: {
            grant: 'a grant',
            version: '2.0.0',
            user: 'someone'
          },
          logger: mockLogger,
          db: mockDb
        }
        response = await postArchiveVersionHandler(mockRequest, responseFake())
      })

      it('returns a status of not found', () => {
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND)
      })

      it('should not have created a new entry', () => {
        expect(rows).toHaveLength(1)
      })

      it('does not increment the archived metric', () => {
        expect(metricsCounter).not.toHaveBeenCalled()
      })

      it('does not publish an audit event', () => {
        expect(publishEvent).not.toHaveBeenCalled()
      })
    })
  })

  describe('postUnarchiveVersionHandler', () => {
    describe('When the version exists', () => {
      describe('when the version is unarchived', () => {
        let rows
        let response
        beforeEach(async () => {
          rows = seedRepo([
            {
              grant: 'a grant',
              version: '1.0.0'
            }
          ])
          const mockRequest = {
            body: {
              grant: 'a grant',
              version: '1.0.0'
            },
            logger: mockLogger,
            db: mockDb
          }
          response = await postUnarchiveVersionHandler(
            mockRequest,
            responseFake()
          )
        })

        it('returns a status of OK', () => {
          expect(response.statusCode).toBe(StatusCodes.OK)
        })

        it('returns the unarchived result', () => {
          expect(response.source).toEqual({ result: 'unarchived' })
        })

        it('should not have created a new entry', () => {
          expect(rows).toHaveLength(1)
        })

        it('does not increment the unarchived metric', () => {
          expect(metricsCounter).not.toHaveBeenCalled()
        })

        it('does not publish an audit event', () => {
          expect(publishEvent).not.toHaveBeenCalled()
        })
      })

      describe('when the version is archived', () => {
        let rows
        let response
        beforeEach(async () => {
          rows = seedRepo([
            {
              grant: 'a grant',
              version: '1.0.0',
              archived: true
            }
          ])
          const mockRequest = {
            body: {
              grant: 'a grant',
              version: '1.0.0',
              user: 'someone'
            },
            logger: mockLogger,
            db: mockDb
          }
          response = await postUnarchiveVersionHandler(
            mockRequest,
            responseFake()
          )
        })

        it('returns a status of OK', () => {
          expect(response.statusCode).toBe(StatusCodes.OK)
        })

        it('returns the unarchived result', () => {
          expect(response.source).toEqual({ result: 'unarchived' })
        })

        it('increments the unarchived metric', () => {
          expect(metricsCounter).toHaveBeenCalledWith('version-unarchived')
        })

        it('publishes an unarchived audit event', () => {
          expect(publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              entities: [
                expect.objectContaining({
                  action: 'unarchived',
                  entityid: 'a grant:1.0.0'
                })
              ],
              status: 'success'
            }),
            'someone',
            mockLogger
          )
        })

        it('creates a new db entry with the archived field set to false', () => {
          expect(rows).toHaveLength(2)
          expect(rows[1].archived).toBe(false)
        })
      })
    })

    describe('When the version does not exists', () => {
      let rows
      let response
      beforeEach(async () => {
        rows = seedRepo([
          {
            grant: 'a grant',
            version: '1.0.0',
            archived: true
          }
        ])
        const mockRequest = {
          body: {
            grant: 'a grant',
            version: '2.0.0',
            user: 'someone'
          },
          logger: mockLogger,
          db: mockDb
        }
        response = await postUnarchiveVersionHandler(
          mockRequest,
          responseFake()
        )
      })

      it('returns a status of not found', () => {
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND)
      })

      it('should not have created a new entry', () => {
        expect(rows).toHaveLength(1)
      })

      it('does not increment the unarchived metric', () => {
        expect(metricsCounter).not.toHaveBeenCalled()
      })

      it('does not publish an audit event', () => {
        expect(publishEvent).not.toHaveBeenCalled()
      })
    })
  })
})
