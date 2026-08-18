import { StatusCodes } from 'http-status-codes'
import { FEATURE_CONTROLS_STATUS } from '../../../utils/constants.js'
import {
  getFeatureControlByName,
  getFeatureControlDetailedByName,
  getFeatureControls,
  updateFeatureControlStatus,
  updateFeatureControlValue
} from '../../../repositories/feature-control-repository.js'
import { config } from '../../../config.js'
import { typeMap } from './feature-control-schemas.js'
import { notifyFeatureControlUpdate } from '../../../messaging/outbound/notify-feature-control.js'
import { deriveChange } from './helpers.js'
import { addOrUpdateFeatureControlDefinition } from '../../../service/feature-control-definition-processor.js'
import { publishEvent } from '../../../common/helpers/audit/event-publisher.js'

export const postAddFeatureControlHandler = async (req, h) => {
  const {
    payload: { roleRequired, environments }
  } = req

  const currentEnv = config.get('cdpEnvironment')

  if (environments && !environments.includes(currentEnv)) {
    return h.response().code(StatusCodes.UNPROCESSABLE_ENTITY)
  }

  const possibleRoleRequired =
    roleRequired?.[currentEnv] ?? roleRequired?.default ?? null

  const processDataResponseCode = await addOrUpdateFeatureControlDefinition(
    { ...req.payload, possibleRoleRequired, currentEnv },
    req.db,
    req.logger
  )

  return h.response().code(processDataResponseCode)
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

  const changeToValue = deriveChange(
    value,
    featureControl.value,
    featureControl.type
  )

  featureControl = await updateFeatureControlValue(
    { name, user, value, note, changeToValue, notificationEmitted: true },
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

  const audit = {
    entities: [
      {
        entity: 'feature-control',
        action: 'value-update',
        entityid: name
      }
    ],
    status: 'success',
    details: {
      value,
      note
    }
  }

  await publishEvent(audit, user, logger)

  return h.response().code(StatusCodes.ACCEPTED)
}

export const putUpdateFeatureControlStatusHandler = async (req, h) => {
  const {
    payload: { name, status, user, note },
    logger
  } = req

  const featureControl = await getFeatureControlDetailedByName(name, req.db)
  if (!featureControl) {
    return h.response().code(StatusCodes.NOT_FOUND)
  }

  if (
    [FEATURE_CONTROLS_STATUS.EXPIRED, FEATURE_CONTROLS_STATUS.REMOVED].includes(
      featureControl.status
    )
  ) {
    return h.response().code(StatusCodes.UNPROCESSABLE_ENTITY)
  }

  await updateFeatureControlStatus(
    {
      name,
      user,
      status,
      note,
      changeToValue: `Status: ${featureControl.status} ➜ ${status}`,
      notificationEmitted: false
    },
    req.db
  )

  const audit = {
    entities: [
      {
        entity: 'feature-control',
        action: 'status-update',
        entityid: name
      }
    ],
    status: 'success',
    details: {
      status,
      note
    }
  }

  await publishEvent(audit, user, logger)

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
  const { page, pageSize, name, displayName, scope, type, owner, status } =
    req.query
  const results = await getFeatureControls(
    { page, pageSize, name, displayName, scope, type, owner, status },
    req.db
  )
  return h.response(results).code(StatusCodes.OK)
}
