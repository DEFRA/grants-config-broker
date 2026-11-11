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
  archived === 'include' ? true : undefined

// The DB omits the archived flag for versions that have never been archived.
// Responses always carry it, defaulting to false, so consumers need not guess.
const withArchivedDefault = (version) => ({
  ...version,
  archived: version.archived ?? false
})

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
    const formattedResponse = withArchivedDefault({
      grant: latestVersion[0].grant,
      version: latestVersion[0].version,
      status: latestVersion[0].status,
      path: getBucketName(),
      manifest: latestVersion[0].manifest,
      lastUpdated: latestVersion[0].lastUpdated,
      archived: latestVersion[0].archived
    })
    return h.response(formattedResponse).code(StatusCodes.OK)
  }
  return h
    .response(generateNotFoundResponse(req.query))
    .code(StatusCodes.NOT_FOUND)
    .takeover()
}

const retrieveRecord = async (parameters, db) => {
  const { grant, version, major, minor, patch } = parameters
  //Fetch the specific version from the database
  const versionAsString = version ?? `${major}.${minor}.${patch}`
  const existingRecord = await findVersion(versionAsString, grant, db)
  return { existingRecord, grant, versionAsString }
}

export const getSpecificVersionHandler = async (req, h) => {
  const {
    existingRecord: versionDetails,
    grant,
    versionAsString
  } = await retrieveRecord(req.query, req.db)

  if (versionDetails) {
    const formattedResponse = withArchivedDefault({
      grant: versionDetails.grant,
      version: versionDetails.version,
      status: versionDetails.status,
      path: getBucketName(),
      manifest: versionDetails.manifest,
      lastUpdated: versionDetails.lastUpdated,
      archived: versionDetails.archived
    })
    return h.response(formattedResponse).code(StatusCodes.OK)
  }
  return h
    .response({ error: `Grant ${grant} version ${versionAsString} not found` })
    .code(StatusCodes.NOT_FOUND)
    .takeover()
}

const auditArchivingChanges = async (archiveAction, existingRecord, req) => {
  await metricsCounter(`version-${archiveAction}`)
  const audit = {
    entities: [
      {
        entity: 'configuration',
        action: archiveAction,
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
  const { user } = req.payload
  await publishEvent(audit, user, req.logger)
}

const updateRecord = async (archivingAction, existingRecord, req) => {
  existingRecord.archived = archivingAction === 'archived'
  existingRecord.lastUpdated = new Date()
  await storeVersion(existingRecord, req.db)
  await auditArchivingChanges(archivingAction, existingRecord, req)
}

export const postArchiveVersionHandler = async (req, h) => {
  const { existingRecord, grant, versionAsString } = await retrieveRecord(
    req.payload,
    req.db
  )

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
    await updateRecord('archived', existingRecord, req)
  }

  return h.response({ result: 'archived' }).code(StatusCodes.OK).takeover()
}

export const postUnarchiveVersionHandler = async (req, h) => {
  const { existingRecord } = await retrieveRecord(req.payload, req.db)

  if (!existingRecord) {
    return h.response().code(StatusCodes.NOT_FOUND).takeover()
  }

  if (existingRecord.archived) {
    await updateRecord('unarchived', existingRecord, req)
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
  return h.response(allVersions.map(withArchivedDefault)).code(StatusCodes.OK)
}

export const getAllGrantsHandler = async (req, h) => {
  const { draft, archived } = req.query
  const status = getStatusOption(draft)
  const allGrants = await getAllGrantsAllVersions({
    status,
    archived: getArchivedOption(archived),
    db: req.db
  })

  const withDefaults = allGrants.map((grant) => ({
    ...grant,
    versions: grant.versions.map(withArchivedDefault)
  }))

  return h.response(withDefaults).code(StatusCodes.OK)
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
