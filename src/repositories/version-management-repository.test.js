import {
  findVersion,
  getLatestVersion,
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
      const find = vi.fn().mockReturnValue({ sort })
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
      expect(find).toHaveBeenCalledWith({ grant, status })
      expect(sort).toHaveBeenCalledWith({
        versionMajor: -1,
        versionMinor: -1,
        versionPatch: -1
      })
      expect(limit).toHaveBeenCalledWith(1)
      expect(toArray).toHaveBeenCalled()
    })
  })
})
