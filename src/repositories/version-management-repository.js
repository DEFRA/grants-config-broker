const APPLIED_VERSION_COLLECTION = 'applied-versions'

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
