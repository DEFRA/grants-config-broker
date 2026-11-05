import {
  getLatestVersion,
  getLatestVersionWithConstraints
} from '../repositories/version-management-repository.js'

export const isLatestVersion = async (grant, version, status, db) => {
  const latestVersion = await getLatestVersion(grant, status, db)

  return latestVersion[0]?.version === version
}

export const isLatestVersionInMajor = async (
  grant,
  version,
  major,
  status,
  db
) => {
  const latestVersion = await getLatestVersionWithConstraints({
    grant,
    status,
    major,
    db
  })

  return latestVersion[0]?.version === version
}
