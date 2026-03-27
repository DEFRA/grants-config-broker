const APPLIED_VERSION_COLLECTION = 'applied-versions'
const CONFIG_VERSION_COLLECTION = 'config-versions'

export const hasVersionJobAlreadyRun = async (serviceVersion, db) => {
  let hasRun

  try {
    await db.collection(APPLIED_VERSION_COLLECTION).insertOne({
      _id: serviceVersion,
      type: 'startup',
      lockedAt: new Date()
    })

    hasRun = false
  } catch (e) {
    hasRun = true
  }

  return hasRun
}

export const findVersion = async (configVersion, grant, db) => {
  const versionRecords = await db
    .collection(CONFIG_VERSION_COLLECTION)
    .find({
      version: configVersion,
      grant
    })
    .project({ _id: 0 })
    .sort({
      lastUpdated: -1
    })
    .toArray()

  return versionRecords[0]
}

export const findVersionHistory = async (configVersion, grant, db) => {
  return db
    .collection(CONFIG_VERSION_COLLECTION)
    .find({
      version: configVersion,
      grant
    })
    .sort({
      lastUpdated: -1
    })
    .project({ _id: 0, version: 1, status: 1, lastUpdated: 1 })
    .toArray()
}

export const storeVersion = async (data, db) => {
  return db.collection(CONFIG_VERSION_COLLECTION).insertOne(data)
}

export const getLatestVersion = async (grant, status, db) => {
  return getLatestVersionWithConstraints(grant, status, null, null, db)
}

export const getLatestVersionWithConstraints = async (
  grant,
  status,
  major,
  minor,
  db
) => {
  const versionMajor = Number.isInteger(major) ? { $eq: major } : { $gte: 0 }
  const versionMinor = Number.isInteger(minor) ? { $eq: minor } : { $gte: 0 }

  return db
    .collection(CONFIG_VERSION_COLLECTION)
    .find({
      grant,
      ...(status && { status }),
      versionMajor,
      versionMinor
    })
    .sort({ versionMajor: -1, versionMinor: -1, versionPatch: -1 })
    .limit(1)
    .toArray()
}

export const getAllVersionsWithConstraints = async (
  grant,
  status,
  major,
  minor,
  db
) => {
  const versionMajor = Number.isInteger(major) ? { $eq: major } : { $gte: 0 }
  const versionMinor = Number.isInteger(minor) ? { $eq: minor } : { $gte: 0 }

  return db
    .collection(CONFIG_VERSION_COLLECTION)
    .aggregate([
      {
        $match: {
          grant,
          ...(status && { status }),
          versionMajor,
          versionMinor
        }
      },
      {
        $sort: {
          versionMajor: -1,
          versionMinor: -1,
          versionPatch: -1,
          lastUpdated: -1
        }
      },
      {
        $group: {
          _id: '$version',
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' }
      },
      {
        $sort: {
          versionMajor: -1,
          versionMinor: -1,
          versionPatch: -1
        }
      },

      {
        $project: {
          _id: 0,
          version: 1,
          status: 1,
          lastUpdated: 1
        }
      }
    ])
    .toArray()
}

export const getAllGrantsAllVersions = async (status, db) => {
  return db
    .collection(CONFIG_VERSION_COLLECTION)
    .aggregate([
      {
        $match: {
          ...(status && { status })
        }
      },
      {
        $sort: {
          grant: 1,
          version: 1,
          lastUpdated: -1
        }
      },
      {
        $group: {
          _id: {
            grant: '$grant',
            version: '$version'
          },
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' }
      },
      {
        $sort: {
          versionMajor: -1,
          versionMinor: -1,
          versionPatch: -1
        }
      },
      {
        $project: {
          _id: 0,
          grant: 1,
          version: 1,
          status: 1,
          lastUpdated: 1
        }
      },
      {
        $group: {
          _id: '$grant',
          versions: {
            $push: {
              version: '$version',
              status: '$status',
              lastUpdated: '$lastUpdated'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          grant: '$_id',
          versions: 1
        }
      }
    ])
    .toArray()
}
