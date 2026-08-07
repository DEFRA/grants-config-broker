import { StatusCodes } from 'http-status-codes'
import {
  getFeatureControlDetailedByName,
  storeFeatureControl,
  updateFeatureControlDefinition
} from '../repositories/feature-control-repository.js'
import { notifyFeatureControlUpdate } from '../messaging/outbound/notify-feature-control.js'
import { publishEvent } from '../common/helpers/audit/event-publisher.js'

export const addOrUpdateFeatureControlDefinition = async (data, db, logger) => {
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

  const alreadyExistingFeatureControl = await getFeatureControlDetailedByName(
    name,
    db
  )

  let emitEvent = false
  let value = null

  if (alreadyExistingFeatureControl) {
    // We will accept updates to the definition of a feature control
    // but not to the initialValue, name, or type; value must be updated separately
    const { changed, shouldEmit, immutableFieldChanged } =
      definitionUpdatedLegally(alreadyExistingFeatureControl, {
        displayName,
        type,
        scopes,
        description,
        owner,
        expiryDate,
        roleRequired: possibleRoleRequired
      })
    if (immutableFieldChanged) {
      logger.error(
        `Not updating feature control ${name} as request includes update to immutable field`
      )
      return StatusCodes.CONFLICT
    }
    if (changed.length) {
      const updatedFeatureControl = await updateFeatureControlDefinition(
        {
          name,
          displayName,
          scopes,
          description,
          owner,
          expiryDate,
          createdBy,
          roleRequired: possibleRoleRequired,
          existingValue: alreadyExistingFeatureControl.value,
          note: `Definition updated: (${changed.join(', ')})`,
          notificationEmitted: shouldEmit
        },
        db
      )
      emitEvent = shouldEmit
      value = alreadyExistingFeatureControl.value
      await constructAndSendAuditEvent(updatedFeatureControl, logger)
    } else {
      logger.info(
        `Not updating feature control ${name} as it already exists, and none of the changeable fields have changed`
      )
      return StatusCodes.NO_CONTENT
    }
  } else {
    const createdDate = new Date()
    value = initialValue[currentEnv] ?? initialValue.default
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
          changeToValue: value,
          notificationEmitted: true
        }
      ]
    }
    //pass to repository
    await storeFeatureControl(featureControl, db)
    emitEvent = true
    await constructAndSendAuditEvent(featureControl, logger)
  }

  if (emitEvent) {
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
  } else {
    logger.info(`Not emitting feature control ${name} `)
  }

  return StatusCodes.ACCEPTED
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
