import { StatusCodes } from 'http-status-codes'
import {
  getFeatureControlByName,
  getFeatureControlDetailedByName,
  getFeatureControls,
  storeFeatureControl,
  updateFeatureControlDefinition,
  updateFeatureControlValue
} from '../../../repositories/feature-control-repository.js'
import { config } from '../../../config.js'
import { typeMap } from './feature-control-schemas.js'
import { notifyFeatureControlUpdate } from '../../../messaging/outbound/notify-feature-control.js'

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
      createdBy,
      roleRequired,
      environments
    }
  } = req

  const currentEnv = config.get('cdpEnvironment')

  if (environments && !environments.includes(currentEnv)) {
    return h.response().code(StatusCodes.UNPROCESSABLE_ENTITY)
  }

  let emitEvent = false
  let value = null

  const alreadyExistingFeatureControl = await getFeatureControlByName(
    name,
    req.db
  )
  if (alreadyExistingFeatureControl) {
    // We will accept updates to the definition of a feature control
    // but not to the initialValue, name, or type; value must be updated separately
    const { changed, shouldEmit, immutableFieldChanged } =
      definitionUpdatedLegally(alreadyExistingFeatureControl, {
        type,
        scopes,
        description,
        owner,
        expiryDate,
        roleRequired
      })
    if (immutableFieldChanged) {
      req.logger.error(
        `Not updating feature control ${name} as request includes update to immutable field`
      )
      return h.response().code(StatusCodes.CONFLICT)
    }
    if (changed) {
      await updateFeatureControlDefinition(
        {
          name,
          scopes,
          description,
          owner,
          expiryDate,
          createdBy,
          roleRequired,
          existingValue: alreadyExistingFeatureControl.value
        },
        req.db
      )
      emitEvent = shouldEmit
      value = alreadyExistingFeatureControl.value
    } else {
      req.logger.info(
        `Not updating feature control ${name} as it already exists, and none of the changeable fields have changed`
      )
      return h.response().code(StatusCodes.NO_CONTENT)
    }
  } else {
    const createdDate = new Date()
    value = initialValue[currentEnv] ?? initialValue.default
    const featureControl = {
      name,
      type,
      value,
      scopes,
      description,
      owner,
      createdBy,
      expiryDate,
      roleRequired,
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
  if (emitEvent) {
    await notifyFeatureControlUpdate(
      {
        name,
        scopes,
        value,
        valueType: type,
        updatedBy: createdBy
      },
      req.logger
    )
  } else {
    req.logger.info(`Not emitting feature control ${name} `)
  }

  return h.response().code(StatusCodes.ACCEPTED)
}

const definitionUpdatedLegally = (existing, newDefinition) => {
  const scopesA = new Set(existing.scopes)
  const scopesB = new Set(newDefinition.scopes)

  const scopesUnchanged =
    scopesA.size === scopesB.size &&
    [...scopesA].every((value) => scopesB.has(value))

  const rolesA = new Set(existing.roleRequired)
  const rolesB = new Set(newDefinition.roleRequired)

  const rolesUnchanged =
    rolesA.size === rolesB.size &&
    [...rolesA].every((value) => rolesB.has(value))

  const immutableFieldChanged = existing.type !== newDefinition.type

  const hasChanged =
    !scopesUnchanged ||
    !rolesUnchanged ||
    existing.description !== newDefinition.description ||
    existing.owner !== newDefinition.owner ||
    existing.expiryDate.getTime() !== newDefinition.expiryDate.getTime()

  return {
    immutableFieldChanged,
    changed: hasChanged,
    shouldEmit: !scopesUnchanged
  }
}

export const putUpdateFeatureControlValueHandler = async (req, h) => {
  const {
    payload: { name, value, user, note },
    logger
  } = req

  let featureControl = await getFeatureControlByName(name, req.db)
  if (!featureControl) {
    return h.response().code(StatusCodes.NOT_FOUND)
  }

  //validate incoming value against the type using joi schema
  const schema = typeMap[featureControl.type]
  const { error } = schema.validate(value)
  if (error) {
    logger.error(`Invalid value for feature control ${name}: ${error.message}`)
    return h.response().code(StatusCodes.BAD_REQUEST)
  }

  featureControl = await updateFeatureControlValue(
    { name, user, value, note },
    req.db
  )
  await notifyFeatureControlUpdate(
    {
      name,
      scopes: featureControl.scopes,
      value,
      valueType: featureControl.type,
      updatedBy: user
    },
    req.logger
  )

  return h.response().code(StatusCodes.ACCEPTED)
}

export const getFeatureControlByNameHandler = async (
  req,
  h,
  detailed = false
) => {
  const { name } = req.params
  const featureControl = detailed
    ? await getFeatureControlDetailedByName(name, req.db)
    : await getFeatureControlByName(name, req.db)
  if (!featureControl) {
    return h.response().code(StatusCodes.NOT_FOUND)
  }
  return h.response(featureControl).code(StatusCodes.OK)
}

export const getFeatureControlsHandler = async (req, h) => {
  const { page, pageSize, name, scope, type, owner } = req.query
  const results = await getFeatureControls(
    { page, pageSize, name, scope, type, owner },
    req.db
  )
  return h.response(results).code(StatusCodes.OK)
}
