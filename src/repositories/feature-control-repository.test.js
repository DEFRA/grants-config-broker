import {
  storeFeatureControl,
  getFeatureControlByName,
  getFeatureControlDetailedByName,
  getFeatureControls,
  updateFeatureControlValue,
  updateFeatureControlDefinition
} from './feature-control-repository.js'

describe('feature-control-repository', () => {
  const mockDb = {
    collection: vi.fn()
  }
  const mockCollection = {
    insertOne: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    countDocuments: vi.fn(),
    find: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    project: vi.fn().mockReturnThis(),
    toArray: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.collection.mockReturnValue(mockCollection)
  })

  describe('storeFeatureControl', () => {
    it('should insert a feature control into the collection', async () => {
      const data = {
        name: 'TEST_FEATURE',
        displayName: 'Test Feature',
        value: true,
        status: 'active'
      }
      mockCollection.insertOne.mockResolvedValue({ insertedId: '123' })

      const result = await storeFeatureControl(data, mockDb)

      expect(mockDb.collection).toHaveBeenCalledWith('feature-controls')
      expect(mockCollection.insertOne).toHaveBeenCalledWith(data)
      expect(result).toEqual({ insertedId: '123' })
    })
  })

  describe('getFeatureControlByName', () => {
    it('should find a feature control by name', async () => {
      const name = 'TEST_FEATURE'
      const expected = { name, value: true }
      mockCollection.findOne.mockResolvedValue(expected)

      const result = await getFeatureControlByName(name, mockDb)

      expect(mockDb.collection).toHaveBeenCalledWith('feature-controls')
      expect(mockCollection.findOne).toHaveBeenCalledWith(
        { name },
        {
          projection: {
            _id: 0,
            name: 1,
            value: 1,
            type: 1,
            scopes: 1
          }
        }
      )
      expect(result).toEqual(expected)
    })
  })

  describe('getFeatureControlDetailedByName', () => {
    it('should find a detailed feature control by name', async () => {
      const name = 'TEST_FEATURE'
      const expected = { name, value: true, history: [] }
      mockCollection.findOne.mockResolvedValue(expected)

      const result = await getFeatureControlDetailedByName(name, mockDb)

      expect(mockDb.collection).toHaveBeenCalledWith('feature-controls')
      expect(mockCollection.findOne).toHaveBeenCalledWith(
        { name },
        {
          projection: {
            _id: 0
          }
        }
      )
      expect(result).toEqual(expected)
    })
  })

  describe('updateFeatureControlValue', () => {
    it('should update the value and push to history', async () => {
      const params = {
        name: 'TEST_FEATURE',
        user: 'user1',
        value: false,
        note: 'test note',
        changeToValue: 'true ➜ false',
        notificationEmitted: true
      }
      mockCollection.findOneAndUpdate.mockResolvedValue({
        value: { ...params }
      })

      const result = await updateFeatureControlValue(params, mockDb)

      expect(mockDb.collection).toHaveBeenCalledWith('feature-controls')
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { name: params.name },
        expect.objectContaining({
          $set: expect.objectContaining({
            value: params.value,
            lastUpdatedBy: params.user
          }),
          $push: {
            history: expect.objectContaining({
              value: params.value,
              setBy: params.user,
              note: params.note
            })
          }
        }),
        { returnDocument: 'after' }
      )
      expect(result).toBeDefined()
    })
  })

  describe('updateFeatureControlDefinition', () => {
    it('should update the definition and push to history', async () => {
      const data = {
        name: 'TEST_FEATURE',
        displayName: 'Test Feature',
        scopes: ['scope1'],
        description: 'desc',
        owner: 'owner',
        expiryDate: '2025-01-01',
        createdBy: 'user1',
        existingValue: true,
        roleRequired: ['admin'],
        note: 'Definition updated (description)'
      }
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })

      const result = await updateFeatureControlDefinition(data, mockDb)

      expect(mockDb.collection).toHaveBeenCalledWith('feature-controls')
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { name: data.name },
        expect.objectContaining({
          $set: expect.objectContaining({
            displayName: data.displayName,
            scopes: data.scopes,
            description: data.description,
            owner: data.owner,
            expiryDate: data.expiryDate,
            roleRequired: data.roleRequired,
            lastUpdatedBy: data.createdBy
          }),
          $push: {
            history: expect.objectContaining({
              value: data.existingValue,
              setBy: data.createdBy,
              note: data.note
            })
          }
        })
      )
      expect(result).toEqual({ modifiedCount: 1 })
    })
  })

  describe('getFeatureControls', () => {
    it('should return paginated and filtered feature controls', async () => {
      const params = {
        page: 2,
        pageSize: 5,
        name: 'TEST',
        displayName: 'Test',
        owner: 'test-owner',
        scope: 'grant.test',
        type: 'boolean',
        status: 'active'
      }
      const items = [
        { name: 'TEST_FEATURE', type: 'boolean', scopes: ['grant.test'] }
      ]
      const total = 10

      mockCollection.countDocuments.mockResolvedValue(total)
      mockCollection.toArray.mockResolvedValue(items)

      const result = await getFeatureControls(params, mockDb)

      expect(mockDb.collection).toHaveBeenCalledWith('feature-controls')
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        name: { $regex: 'TEST', $options: 'i' },
        displayName: { $regex: 'Test', $options: 'i' },
        owner: { $regex: 'test\\-owner', $options: 'i' },
        scopes: 'grant.test',
        type: 'boolean',
        status: 'active'
      })
      expect(mockCollection.find).toHaveBeenCalledWith({
        name: { $regex: 'TEST', $options: 'i' },
        displayName: { $regex: 'Test', $options: 'i' },
        owner: { $regex: 'test\\-owner', $options: 'i' },
        scopes: 'grant.test',
        type: 'boolean',
        status: 'active'
      })
      expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 })
      expect(mockCollection.skip).toHaveBeenCalledWith(5)
      expect(mockCollection.limit).toHaveBeenCalledWith(5)
      expect(mockCollection.project).toHaveBeenCalledWith({
        _id: 0,
        history: 0
      })
      expect(result).toEqual({
        items,
        total,
        page: 2,
        pageSize: 5,
        totalPages: 2,
        uniqueScopes: ['grant.test']
      })
    })

    it('should escape regex special characters in filters', async () => {
      const params = {
        page: 1,
        pageSize: 10,
        name: 'test.*',
        displayName: 'Test (2)',
        owner: 'user?'
      }
      mockCollection.countDocuments.mockResolvedValue(0)
      mockCollection.toArray.mockResolvedValue([])

      await getFeatureControls(params, mockDb)

      const expectedFilter = {
        name: { $regex: 'test\\.\\*', $options: 'i' },
        displayName: { $regex: 'Test \\(2\\)', $options: 'i' },
        owner: { $regex: 'user\\?', $options: 'i' }
      }

      expect(mockCollection.countDocuments).toHaveBeenCalledWith(expectedFilter)
      expect(mockCollection.find).toHaveBeenCalledWith(expectedFilter)
    })

    it('should work without filters', async () => {
      const params = { page: 1, pageSize: 10 }
      mockCollection.countDocuments.mockResolvedValue(0)
      mockCollection.toArray.mockResolvedValue([])

      await getFeatureControls(params, mockDb)

      expect(mockCollection.countDocuments).toHaveBeenCalledWith({})
      expect(mockCollection.find).toHaveBeenCalledWith({})
    })
  })
})
