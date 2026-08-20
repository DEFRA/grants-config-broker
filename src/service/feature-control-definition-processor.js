import { StatusCodes } from 'http-status-codes'
import {
  getFeatureControlDetailedByName,
  storeFeatureControl,
  updateFeatureControlDefinition
} from '../repositories/feature-control-repository.js'
import { notifyFeatureControlUpdate } from '../messaging/outbound/notify-feature-control.js'
import { deriveChangeUpdatedDefinition } from '../routes/api/feature-control/helpers.js'
import { publishEvent } from '../common/helpers/audit/event-publisher.js'

export const addOrUpdateFeatureControlDefinition = async (data, db, logger) => {
  const alreadyExistingFeatureControl = await getFeatureControlDetailedByName(
    data.name,
    db
  )

  if (alreadyExistingFeatureControl) {
    return handleExistingFeatureControl(
      alreadyExistingFeatureControl,
      data,
      db,
      logger
    )
  }

  return handleNewFeatureControl(data, db, logger)
}

const handleExistingFeatureControl = async (existing, data, db, logger) => {
  const {
    name,
    displayName,
    type,
    scopes,
    description,
    owner,
    expiryDate,
    createdBy,
    possibleRoleRequired
  } = data

  const newDefinition = {
    name,
    displayName,
    type,
    scopes,
    description,
    owner,
    expiryDate,
    roleRequired: possibleRoleRequired
  }

  const { changed, shouldEmit, immutableFieldChanged } =
    definitionUpdatedLegally(existing, newDefinition)

  if (immutableFieldChanged) {
    logger.error(
      `Not updating feature control ${name} as request includes update to immutable field`
    )
    return StatusCodes.CONFLICT
  }

  if (!changed.length) {
    logger.info(
      `Not updating feature control ${name} as it already exists, and none of the changeable fields have changed`
    )
    return StatusCodes.NO_CONTENT
  }

  const changeToValue = deriveChangeUpdatedDefinition(
    existing,
    newDefinition,
    changed
  )
  const updatedFeatureControl = await updateFeatureControlDefinition(
    {
      ...newDefinition,
      createdBy,
      existingValue: existing.value,
      note: 'Definition updated',
      changeToValue,
      notificationEmitted: shouldEmit
    },
    db
  )

  await constructAndSendAuditEvent(updatedFeatureControl, logger)

  if (shouldEmit) {
    await emitNotification(data, existing.value, logger)
  } else {
    logger.info(`Not emitting feature control ${name} `)
  }

  return StatusCodes.ACCEPTED
}

const handleNewFeatureControl = async (data, db, logger) => {
  const {
    name,
    displayName,
    type,
    initialValue,
    scopes,
    description,
    owner,
    expiryDate,
    createdBy,
    possibleRoleRequired,
    currentEnv
  } = data

  const createdDate = new Date()
  const value = initialValue[currentEnv] ?? initialValue.default

  const featureControl = {
    name,
    displayName,
    type,
    value,
    scopes,
    description,
    owner,
    createdBy,
    expiryDate,
    roleRequired: possibleRoleRequired,
    created: createdDate,
    lastUpdated: createdDate,
    lastUpdatedBy: createdBy,
    history: [
      {
        value,
        setBy: createdBy,
        dateTime: createdDate,
        note: 'Initial value set',
        changeToValue: `Value: ${value}`,
        notificationEmitted: true
      }
    ]
  }

  await storeFeatureControl(featureControl, db)
  await constructAndSendAuditEvent(featureControl, logger)
  await emitNotification(data, value, logger)

  return StatusCodes.ACCEPTED
}

const emitNotification = async (data, value, logger) => {
  const { name, scopes, type, createdBy } = data
  await notifyFeatureControlUpdate(
    {
      name,
      scopes,
      value,
      valueType: type,
      updatedBy: createdBy
    },
    logger
  )
}

const constructAndSendAuditEvent = async (data, logger) => {
  const { history, ...details } = data
  const audit = {
    entities: [
      {
        entity: 'feature-control',
        action: 'definition-update',
        entityid: data.name
      }
    ],
    status: 'success',
    details
  }
  await publishEvent(audit, data.lastUpdatedBy, logger)
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

  const hasChanged = [
    scopesUnchanged ? null : 'scopes',
    rolesUnchanged ? null : 'roles',
    existing.displayName !== newDefinition.displayName ? 'displayName' : null,
    existing.description !== newDefinition.description ? 'description' : null,
    existing.owner !== newDefinition.owner ? 'owner' : null,
    existing.expiryDate.getTime() !== newDefinition.expiryDate.getTime()
      ? 'expiryDate'
      : null
  ]
    .filter((value) => !!value)
    .sort((a, b) => a.localeCompare(b))

  return {
    immutableFieldChanged,
    changed: hasChanged,
    shouldEmit: !scopesUnchanged
  }
}
