import { getLatestVersion } from '../repositories/version-management-repository.js'

export const isLatestVersion = async (grant, version, status, db) => {
  const latestVersion = await getLatestVersion(grant, status, db)

  return latestVersion[0]?.version === version
}
