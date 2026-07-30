const FEATURE_CONTROL_COLLECTION = 'feature-controls'

export const storeFeatureControl = async (data, db) => {
  // Hardcoded status for now, but will change in the near future
  return db
    .collection(FEATURE_CONTROL_COLLECTION)
    .insertOne({ ...data, status: 'active' })
}

export const getFeatureControlDetailedByName = async (name, db) => {
  return db.collection(FEATURE_CONTROL_COLLECTION).findOne(
    { name },
    {
      projection: {
        _id: 0
      }
    }
  )
}

export const getFeatureControlByName = async (name, db) => {
  return db.collection(FEATURE_CONTROL_COLLECTION).findOne(
    { name },
    {
      projection: {
        _id: 0,
        name: 1,
        value: 1,
        type: 1,
        scopes: 1
      }
    }
  )
}

export const updateFeatureControlValue = async (
  { name, user, value, note },
  db
) => {
  const updateTime = new Date()
  return db.collection(FEATURE_CONTROL_COLLECTION).findOneAndUpdate(
    { name },
    {
      $set: {
        value,
        lastUpdated: updateTime,
        lastUpdatedBy: user
      },
      $push: {
        history: {
          value,
          setBy: user,
          dateTime: updateTime,
          note
        }
      }
    },
    { returnDocument: 'after' }
  )
}

export const updateFeatureControlDefinition = async (data, db) => {
  const {
    name,
    displayName,
    scopes,
    description,
    owner,
    expiryDate,
    createdBy,
    existingValue,
    roleRequired
  } = data
  const updateTime = new Date()
  return db.collection(FEATURE_CONTROL_COLLECTION).updateOne(
    { name },
    {
      $set: {
        displayName,
        scopes,
        description,
        owner,
        expiryDate,
        roleRequired,
        lastUpdatedBy: createdBy,
        lastUpdated: updateTime
      },
      $push: {
        history: {
          value: existingValue,
          setBy: createdBy,
          dateTime: updateTime,
          note: 'Definition updated'
        }
      }
    }
  )
}

export const getFeatureControls = async (
  { page, pageSize, name, scope, type, owner },
  db
) => {
  const filter = {}
  if (name) {
    filter.name = { $regex: name, $options: 'i' }
  }
  if (owner) {
    filter.owner = { $regex: owner, $options: 'i' }
  }
  if (scope) {
    filter.scopes = scope
  }
  if (type) {
    filter.type = type
  }

  const skip = (page - 1) * pageSize

  const total = await db
    .collection(FEATURE_CONTROL_COLLECTION)
    .countDocuments(filter)
  const items = await db
    .collection(FEATURE_CONTROL_COLLECTION)
    .find(filter)
    .sort({ name: 1 })
    .skip(skip)
    .limit(pageSize)
    .project({ _id: 0, history: 0 })
    .toArray()

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}
