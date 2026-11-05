import { StatusCodes } from 'http-status-codes'
import {
  findVersion,
  findVersionHistory,
  getAllGrantsAllVersions,
  getAllVersionsWithConstraints,
  getLatestVersionWithConstraints,
  storeVersion
} from '../../../repositories/version-management-repository.js'
import { ACTIVE_STATUS, DRAFT_STATUS } from '../../../utils/constants.js'
import { getBucketName } from '../../../utils/release-utils.js'
import { metricsCounter } from '../../../common/helpers/metrics.js'
import { publishEvent } from '../../../common/helpers/audit/event-publisher.js'
import { isLatestVersionInMajor } from '../../../service/latest-version.js'

const generateNotFoundResponse = (params) => {
  const { grant, constrainMajor } = params
  return {
    error: `Grant ${grant}${constrainMajor ? ' with version constraints' : ''} not found`
  }
}

const getStatusOption = (draft) => {
  if (draft === 'only') {
    return DRAFT_STATUS
  } else if (draft === 'include') {
    return null
  } else {
    return ACTIVE_STATUS
  }
}

const getArchivedOption = (archived) =>
  archived === 'included' ? true : undefined

export const getLatestVersionHandler = async (req, h) => {
  const { grant, draft, archived, constrainMajor, constrainMinor } = req.query

  //Fetch the latest version from the database
  const status = getStatusOption(draft)
  const latestVersion = await getLatestVersionWithConstraints({
    grant,
    status,
    major: constrainMajor,
    minor: constrainMinor,
    archived: getArchivedOption(archived),
    db: req.db
  })
  if (latestVersion?.length) {
    const formattedResponse = {
      grant: latestVersion[0].grant,
      version: latestVersion[0].version,
      status: latestVersion[0].status,
      path: getBucketName(),
      manifest: latestVersion[0].manifest,
      lastUpdated: latestVersion[0].lastUpdated
    }
    return h.response(formattedResponse).code(StatusCodes.OK)
  }
  return h
    .response(generateNotFoundResponse(req.query))
    .code(StatusCodes.NOT_FOUND)
    .takeover()
}

export const getSpecificVersionHandler = async (req, h) => {
  const { grant, version, major, minor, patch } = req.query
  //Fetch the specific version from the database
  const versionAsString = version ?? `${major}.${minor}.${patch}`
  const versionDetails = await findVersion(versionAsString, grant, req.db)

  if (versionDetails) {
    const formattedResponse = {
      grant: versionDetails.grant,
      version: versionDetails.version,
      status: versionDetails.status,
      path: getBucketName(),
      manifest: versionDetails.manifest,
      lastUpdated: versionDetails.lastUpdated
    }
    return h.response(formattedResponse).code(StatusCodes.OK)
  }
  return h
    .response({ error: `Grant ${grant} version ${versionAsString} not found` })
    .code(StatusCodes.NOT_FOUND)
    .takeover()
}

export const postArchiveVersionHandler = async (req, h) => {
  const { grant, version, major, minor, patch } = req.body
  //Fetch the specific version from the database
  const versionAsString = version ?? `${major}.${minor}.${patch}`
  const existingRecord = await findVersion(versionAsString, grant, req.db)

  if (!existingRecord) {
    return h.response().code(StatusCodes.NOT_FOUND).takeover()
  }

  if (!existingRecord.archived) {
    const [versionMajor] = versionAsString.split('.').map(Number)
    if (
      await isLatestVersionInMajor(
        grant,
        versionAsString,
        versionMajor,
        null,
        req.db
      )
    ) {
      return h
        .response({ error: 'Cannot archive the latest version' })
        .code(StatusCodes.BAD_REQUEST)
        .takeover()
    }
    existingRecord.archived = true
    existingRecord.lastUpdated = new Date()
    await storeVersion(existingRecord, req.db)
    await metricsCounter('version-archived')
    const audit = {
      entities: [
        {
          entity: 'configuration',
          action: 'archived',
          entityid: `${existingRecord.grant}:${existingRecord.version}`
        }
      ],
      status: 'success',
      details: {
        grant: existingRecord.grant,
        configVersion: existingRecord.version,
        configArchived: existingRecord.archived
      }
    }
    const { user } = req.body
    await publishEvent(audit, user, req.logger)
  }

  return h.response({ result: 'archived' }).code(StatusCodes.OK).takeover()
}

export const postUnarchiveVersionHandler = async (req, h) => {
  const { grant, version, major, minor, patch } = req.body
  //Fetch the specific version from the database
  const versionAsString = version ?? `${major}.${minor}.${patch}`
  const existingRecord = await findVersion(versionAsString, grant, req.db)

  if (!existingRecord) {
    return h.response().code(StatusCodes.NOT_FOUND).takeover()
  }

  if (existingRecord.archived) {
    existingRecord.archived = false
    existingRecord.lastUpdated = new Date()
    await storeVersion(existingRecord, req.db)
    await metricsCounter('version-unarchived')
    const audit = {
      entities: [
        {
          entity: 'configuration',
          action: 'unarchived',
          entityid: `${existingRecord.grant}:${existingRecord.version}`
        }
      ],
      status: 'success',
      details: {
        grant: existingRecord.grant,
        configVersion: existingRecord.version,
        configArchived: existingRecord.archived
      }
    }
    const { user } = req.body
    await publishEvent(audit, user, req.logger)
  }

  return h.response({ result: 'unarchived' }).code(StatusCodes.OK).takeover()
}

export const getAllVersionsHandler = async (req, h) => {
  const { grant, draft, archived, constrainMajor, constrainMinor } = req.query
  const status = getStatusOption(draft)
  const allVersions = await getAllVersionsWithConstraints({
    grant,
    status,
    major: constrainMajor,
    minor: constrainMinor,
    archived: getArchivedOption(archived),
    db: req.db
  })
  return h.response(allVersions).code(StatusCodes.OK)
}

export const getAllGrantsHandler = async (req, h) => {
  const { draft, archived } = req.query
  const status = getStatusOption(draft)
  const allVersions = await getAllGrantsAllVersions({
    status,
    archived: getArchivedOption(archived),
    db: req.db
  })

  return h.response(allVersions).code(StatusCodes.OK)
}

export const getVersionHistoryHandler = async (req, h) => {
  const { grant, version, major, minor, patch } = req.query
  //Fetch the specific version from the database
  const versionAsString = version ?? `${major}.${minor}.${patch}`
  const versionDetails = await findVersionHistory(
    versionAsString,
    grant,
    req.db
  )
  if (versionDetails?.length) {
    return h.response(versionDetails).code(StatusCodes.OK)
  }
  return h
    .response({ error: `Grant ${grant} version ${versionAsString} not found` })
    .code(StatusCodes.NOT_FOUND)
    .takeover()
}
