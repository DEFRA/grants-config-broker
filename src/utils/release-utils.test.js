import { generateMetadataPayload } from './release-utils.js'

vi.mock('../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'serviceVersion') return '1.2.3'
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
})
