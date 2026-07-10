import { StatusCodes } from 'http-status-codes'
import {
  getFeatureControlByName,
  storeFeatureControl,
  updateFeatureControlDefinition,
  updateFeatureControlValue
} from '../../../repositories/feature-control-repository.js'
import { config } from '../../../config.js'

export const postAddFeatureControlHandler = async (req, h) => {
  const {
    payload: {
      name,
      type,
      initialValue,
      scopes,
      description,
      owner,
      expiryDate,
      createdBy
    }
  } = req

  const currentEnv = config.get('cdpEnvironment')
  let emitEvent = false

  const alreadyExistingFeatureControl = await getFeatureControlByName(
    name,
    req.db
  )
  if (alreadyExistingFeatureControl) {
    // We will accept updates to the definition of a feature control
    // but not to the initialValue, name, or type, value must be updated separately
    const { changed, shouldEmit } = definitionUpdated(
      alreadyExistingFeatureControl,
      { scopes, description, owner, expiryDate }
    )
    if (changed) {
      await updateFeatureControlDefinition(
        {
          name,
          scopes,
          description,
          owner,
          expiryDate,
          createdBy,
          existingValue: alreadyExistingFeatureControl.value
        },
        req.db
      )
      emitEvent = shouldEmit
    } else {
      req.logger.info(
        `Not updating feature control ${name} as it already exists, and none of the changeable fields have changed`
      )
      return h.response().code(StatusCodes.CONFLICT)
    }
  } else {
    const createdDate = new Date()
    const value = initialValue[currentEnv] ?? initialValue.default
    const featureControl = {
      name,
      type,
      value,
      scopes,
      description,
      owner,
      createdBy,
      expiryDate,
      created: createdDate,
      lastUpdated: createdDate,
      lastUpdatedBy: createdBy,
      history: [
        {
          value,
          setBy: createdBy,
          dateTime: createdDate,
          note: 'Initial value set'
        }
      ]
    }
    //pass to repository
    await storeFeatureControl(featureControl, req.db)
    emitEvent = true
  }

  //if brand new, always emit the value next
  //if an update, only emit if the scopes have changed
  req.logger.info(
    `${emitEvent ? 'Emitting' : 'Not emitting'} feature control ${name} `
  )

  return h.response().code(StatusCodes.ACCEPTED)
}

const definitionUpdated = (existing, newDefinition) => {
  const scopesA = new Set(existing.scopes)
  const scopesB = new Set(newDefinition.scopes)

  const scopesUnchanged =
    scopesA.size === scopesB.size &&
    [...scopesA].every((value) => scopesB.has(value))

  const hasChanged =
    !scopesUnchanged ||
    existing.description !== newDefinition.description ||
    existing.owner !== newDefinition.owner ||
    existing.expiryDate !== newDefinition.expiryDate

  return {
    changed: hasChanged,
    shouldEmit: !scopesUnchanged
  }
}

export const putUpdateFeatureControlValueHandler = async (req, h) => {
  const {
    payload: { name, value, user, note }
  } = req

  const featureControl = await getFeatureControlByName(name, req.db)
  if (!featureControl) {
    return h.response().code(StatusCodes.NOT_FOUND)
  }

  await updateFeatureControlValue({ name, user, value, note }, req.db)

  return h.response().code(StatusCodes.ACCEPTED)
}
