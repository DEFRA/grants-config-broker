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
  return db
    .collection(CONFIG_VERSION_COLLECTION)
    .find({
      version: configVersion,
      grant
    })
    .sort({
      lastUpdated: -1
    })
    .toArray()[0]
}

export const storeVersion = async (data, db) => {
  return db.collection(CONFIG_VERSION_COLLECTION).insertOne(data)
}

export const getLatestVersion = async (grant, status, db) => {
  return db
    .collection(CONFIG_VERSION_COLLECTION)
    .find({
      grant,
      status
    })
    .sort({ versionMajor: -1, versionMinor: -1, versionPatch: -1 })
    .limit(1)
    .toArray()
}
