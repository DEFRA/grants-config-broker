import {
  storeFeatureControl,
  getFeatureControlByName,
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
    updateOne: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.collection.mockReturnValue(mockCollection)
  })

  describe('storeFeatureControl', () => {
    it('should insert a feature control into the collection', async () => {
      const data = { name: 'TEST_FEATURE', value: true }
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
      expect(mockCollection.findOne).toHaveBeenCalledWith({ name })
      expect(result).toEqual(expected)
    })
  })

  describe('updateFeatureControlValue', () => {
    it('should update the value and push to history', async () => {
      const params = {
        name: 'TEST_FEATURE',
        user: 'user1',
        value: false,
        note: 'test note'
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
        scopes: ['scope1'],
        description: 'desc',
        owner: 'owner',
        expiryDate: '2025-01-01',
        createdBy: 'user1',
        existingValue: true
      }
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })

      const result = await updateFeatureControlDefinition(data, mockDb)

      expect(mockDb.collection).toHaveBeenCalledWith('feature-controls')
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { name: data.name },
        expect.objectContaining({
          $set: expect.objectContaining({
            scopes: data.scopes,
            description: data.description,
            owner: data.owner,
            expiryDate: data.expiryDate,
            lastUpdatedBy: data.createdBy
          }),
          $push: {
            history: expect.objectContaining({
              value: data.existingValue,
              setBy: data.createdBy,
              note: 'Definition updated'
            })
          }
        })
      )
      expect(result).toEqual({ modifiedCount: 1 })
    })
  })
})
