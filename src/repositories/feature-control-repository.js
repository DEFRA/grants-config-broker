const FEATURE_CONTROL_COLLECTION = 'feature-controls'

export const storeFeatureControl = async (data, db) => {
  return db.collection(FEATURE_CONTROL_COLLECTION).insertOne(data)
}

export const getFeatureControlByName = async (name, db) => {
  return db.collection(FEATURE_CONTROL_COLLECTION).findOne({ name })
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
    scopes,
    description,
    owner,
    expiryDate,
    createdBy,
    existingValue
  } = data
  const updateTime = new Date()
  return db.collection(FEATURE_CONTROL_COLLECTION).updateOne(
    { name },
    {
      $set: {
        scopes,
        description,
        owner,
        expiryDate,
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
