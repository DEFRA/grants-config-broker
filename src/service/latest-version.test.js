import {
  getLatestVersion,
  getLatestVersionWithConstraints
} from '../repositories/version-management-repository.js'
import { isLatestVersion, isLatestVersionInMajor } from './latest-version.js'

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

  describe('isLatestVersionInMajor', () => {
    it('should return true if version checked equals the latest version of the major', async () => {
      getLatestVersionWithConstraints.mockResolvedValue([{ version: '1.1.0' }])

      const result = await isLatestVersionInMajor(
        'grant',
        '1.1.0',
        1,
        'draft',
        mockDb
      )
      expect(result).toBeTruthy()
    })

    it('should return false if version checked does not equal the latest version of the major', async () => {
      getLatestVersionWithConstraints.mockResolvedValue([{ version: '1.1.0' }])

      const result = await isLatestVersionInMajor(
        'grant',
        '1.0.0',
        1,
        'draft',
        mockDb
      )
      expect(result).toBeFalsy()
    })

    it('should return false if no latest version found for the major', async () => {
      getLatestVersionWithConstraints.mockResolvedValue([])

      const result = await isLatestVersionInMajor(
        'grant',
        '1.0.0',
        1,
        'draft',
        mockDb
      )
      expect(result).toBeFalsy()
    })

    it('should constrain the lookup to the requested major', async () => {
      getLatestVersionWithConstraints.mockResolvedValue([{ version: '1.1.0' }])

      await isLatestVersionInMajor('grant', '1.1.0', 1, 'draft', mockDb)

      expect(getLatestVersionWithConstraints).toHaveBeenCalledWith({
        grant: 'grant',
        status: 'draft',
        major: 1,
        db: mockDb
      })
    })
  })
})
