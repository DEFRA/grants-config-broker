import {
  findVersion,
  getAllGrantsAllVersions,
  getAllVersionsWithConstraints,
  getLatestVersion,
  getLatestVersionWithConstraints,
  hasVersionJobAlreadyRun,
  storeVersion
} from './version-management-repository.js'

describe('version-management-repository', () => {
  describe('hasVersionJobAlreadyRun', () => {
    it('should return true if version job has already run', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          insertOne: vi.fn().mockRejectedValue(new Error('Duplicate key error'))
        })
      }
      const serviceVersion = '1.0.0'
      const result = await hasVersionJobAlreadyRun(serviceVersion, db)
      expect(result).toBe(true)
      expect(db.collection).toHaveBeenCalledWith('applied-versions')
    })

    it('should return false if version job has not run', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          insertOne: vi.fn().mockResolvedValue({})
        })
      }
      const serviceVersion = '1.0.0'
      const result = await hasVersionJobAlreadyRun(serviceVersion, db)
      expect(result).toBe(false)
      expect(db.collection).toHaveBeenCalledWith('applied-versions')
    })
  })

  describe('findVersion', () => {
    it('should return version if found', async () => {
      const toArray = vi.fn().mockReturnValue([{ version: '1.0.0' }])
      const sort = vi.fn().mockReturnValue({ toArray })
      const project = vi.fn().mockReturnValue({ sort })
      const find = vi.fn().mockReturnValue({ project })
      const db = {
        collection: vi.fn().mockReturnValue({
          find
        })
      }
      const configVersion = '1.0.0'
      const grant = 'test-grant'
      const result = await findVersion(configVersion, grant, db)
      expect(result).toEqual({ version: '1.0.0' })
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(find).toHaveBeenCalledWith({ version: '1.0.0', grant })
      expect(project).toHaveBeenCalledWith({ _id: 0 })
      expect(sort).toHaveBeenCalledWith({ lastUpdated: -1 })
      expect(toArray).toHaveBeenCalled()
    })
  })

  describe('storeVersion', () => {
    it('should store version in database', async () => {
      const insertOne = vi.fn().mockResolvedValue({ added: 1 })
      const db = {
        collection: vi.fn().mockReturnValue({
          insertOne
        })
      }
      const data = { version: '1.0.0' }
      const result = await storeVersion(data, db)
      expect(result).toEqual({ added: 1 })
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(insertOne).toHaveBeenCalledWith(data)
    })
  })

  describe('getLatestVersion', () => {
    it('should return version if found', async () => {
      const toArray = vi.fn().mockReturnValue([{ version: '1.0.0' }])
      const limit = vi.fn().mockReturnValue({ toArray })
      const sort = vi.fn().mockReturnValue({ limit })
      const find = vi.fn().mockReturnValue({ sort })
      const db = {
        collection: vi.fn().mockReturnValue({
          find
        })
      }

      const grant = 'test-grant'
      const status = 'active'
      const result = await getLatestVersion(grant, status, db)
      expect(result).toEqual([{ version: '1.0.0' }])
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(find).toHaveBeenCalledWith({
        grant,
        status,
        versionMajor: { $gte: 0 },
        versionMinor: { $gte: 0 }
      })
      expect(sort).toHaveBeenCalledWith({
        versionMajor: -1,
        versionMinor: -1,
        versionPatch: -1
      })
      expect(limit).toHaveBeenCalledWith(1)
      expect(toArray).toHaveBeenCalled()
    })
  })

  describe('getLatestVersionWithConstraints', () => {
    const toArray = vi.fn().mockReturnValue([{ version: '1.1.0' }])
    const limit = vi.fn().mockReturnValue({ toArray })
    const sort = vi.fn().mockReturnValue({ limit })
    const find = vi.fn().mockReturnValue({ sort })
    it('should pass constraints to query and return version if found', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          find
        })
      }

      const grant = 'test-grant'
      const status = 'active'
      const major = 1
      const minor = 1
      const result = await getLatestVersionWithConstraints(
        grant,
        status,
        major,
        minor,
        db
      )
      expect(result).toEqual([{ version: '1.1.0' }])
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(find).toHaveBeenCalledWith({
        grant,
        status,
        versionMajor: { $eq: 1 },
        versionMinor: { $eq: 1 }
      })
      expect(sort).toHaveBeenCalledWith({
        versionMajor: -1,
        versionMinor: -1,
        versionPatch: -1
      })
      expect(limit).toHaveBeenCalledWith(1)
      expect(toArray).toHaveBeenCalled()
    })

    it('should pass default query when no constraints and return version if found', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          find
        })
      }

      const grant = 'test-grant'
      const result = await getLatestVersionWithConstraints(
        grant,
        null,
        null,
        null,
        db
      )
      expect(result).toEqual([{ version: '1.1.0' }])
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(find).toHaveBeenCalledWith({
        grant,
        versionMajor: { $gte: 0 },
        versionMinor: { $gte: 0 }
      })
      expect(sort).toHaveBeenCalledWith({
        versionMajor: -1,
        versionMinor: -1,
        versionPatch: -1
      })
      expect(limit).toHaveBeenCalledWith(1)
      expect(toArray).toHaveBeenCalled()
    })
  })

  describe('getAllVersionsWithConstraints', () => {
    const toArray = vi.fn().mockReturnValue([{ version: '1.1.0' }])
    const aggregate = vi.fn().mockReturnValue({ toArray })
    it('should pass constraints to query and return versions', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          aggregate
        })
      }

      const grant = 'test-grant'
      const status = 'active'
      const major = 1
      const minor = 1
      const result = await getAllVersionsWithConstraints(
        grant,
        status,
        major,
        minor,
        db
      )
      expect(result).toEqual([{ version: '1.1.0' }])
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(aggregate).toHaveBeenCalledWith([
        {
          $match: {
            grant,
            status,
            versionMajor: { $eq: 1 },
            versionMinor: { $eq: 1 }
          }
        },
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      ])

      expect(toArray).toHaveBeenCalled()
    })

    it('should pass default query when no constraints and return versions', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          aggregate
        })
      }

      const grant = 'test-grant'
      const result = await getAllVersionsWithConstraints(
        grant,
        null,
        null,
        null,
        db
      )
      expect(result).toEqual([{ version: '1.1.0' }])
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(aggregate).toHaveBeenCalledWith([
        {
          $match: {
            grant,
            versionMajor: { $gte: 0 },
            versionMinor: { $gte: 0 }
          }
        },
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      ])

      expect(toArray).toHaveBeenCalled()
    })
  })

  describe('getAllGrantsAllVersions', () => {
    const toArray = vi
      .fn()
      .mockReturnValue([
        { grant: 'some-grant', versions: [{ version: '1.1.0' }] }
      ])
    const aggregate = vi.fn().mockReturnValue({ toArray })
    it('should pass constraints to query and return versions', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          aggregate
        })
      }

      const status = 'active'
      const result = await getAllGrantsAllVersions(status, db)
      expect(result).toEqual([
        { grant: 'some-grant', versions: [{ version: '1.1.0' }] }
      ])
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(aggregate).toHaveBeenCalledWith([
        {
          $match: {
            status
          }
        },
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      ])

      expect(toArray).toHaveBeenCalled()
    })

    it('should pass default query when no constraints and return versions', async () => {
      const db = {
        collection: vi.fn().mockReturnValue({
          aggregate
        })
      }

      const result = await getAllGrantsAllVersions(null, db)
      expect(result).toEqual([
        { grant: 'some-grant', versions: [{ version: '1.1.0' }] }
      ])
      expect(db.collection).toHaveBeenCalledWith('config-versions')
      expect(aggregate).toHaveBeenCalledWith([
        {
          $match: {}
        },
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      ])

      expect(toArray).toHaveBeenCalled()
    })
  })
})
