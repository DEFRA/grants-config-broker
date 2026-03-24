import { getLatestVersion } from '../repositories/version-management-repository.js'
import { isLatestVersion } from './latest-version.js'

vi.mock('../repositories/version-management-repository.js')

describe('latest-version', () => {
  const mockDb = {}
  describe('isLatestVersion', () => {
    it('should return true if version checked equals the latest version', async () => {
      getLatestVersion.mockResolvedValue([{ version: '1.0.0' }])

      const result = await isLatestVersion('grant', '1.0.0', 'draft', mockDb)
      expect(result).toBeTruthy()
    })
    it('should return false if version checked does not equal the latest version', async () => {
      getLatestVersion.mockResolvedValue([{ version: '2.0.0' }])

      const result = await isLatestVersion('grant', '1.0.0', 'draft', mockDb)
      expect(result).toBeFalsy()
    })
    it('should return false if no latest version found', async () => {
      getLatestVersion.mockResolvedValue([])

      const result = await isLatestVersion('grant', '1.0.0', 'draft', mockDb)
      expect(result).toBeFalsy()
    })
  })
})
