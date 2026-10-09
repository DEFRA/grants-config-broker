import { generateMetadataPayload, getBucketName } from './release-utils.js'

vi.mock('../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'serviceVersion') return '1.2.3'
      if (key === 'aws.s3.bucketName') return 'test-bucket'
      return null
    })
  }
}))

describe('release-utils', () => {
  describe('generateMetadataPayload', () => {
    it('should generate the correct payload', () => {
      const releaseInfo = {
        notes: 'Release notes here'
      }
      const status = 'active'

      const result = generateMetadataPayload(releaseInfo, status)

      expect(JSON.parse(result)).toEqual({
        status: 'active',
        releaseNotes: 'Release notes here',
        updatedInBrokerVersion: '1.2.3'
      })
    })
  })

  describe('getBucketName', () => {
    it('should return the bucket name from config', () => {
      const result = getBucketName()

      expect(result).toBe('test-bucket')
    })
  })
})
