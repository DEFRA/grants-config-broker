import { StatusCodes } from 'http-status-codes'
import {
  findVersion,
  findVersionHistory,
  getAllGrantsAllVersions,
  getAllVersionsWithConstraints,
  getLatestVersionWithConstraints
} from '../../repositories/version-management-repository.js'
import { ACTIVE_STATUS, DRAFT_STATUS } from '../../utils/constants.js'
import { getBucketName } from '../../storage/s3-interactions.js'

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

export const getLatestVersionHandler = async (req, h) => {
  const { grant, draft, constrainMajor, constrainMinor } = req.query

  //Fetch the latest version from the database
  const status = getStatusOption(draft)
  const latestVersion = await getLatestVersionWithConstraints(
    grant,
    status,
    constrainMajor,
    constrainMinor,
    req.db
  )
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

export const getAllVersionsHandler = async (req, h) => {
  const { grant, draft, constrainMajor, constrainMinor } = req.query
  const status = getStatusOption(draft)
  const allVersions = await getAllVersionsWithConstraints(
    grant,
    status,
    constrainMajor,
    constrainMinor,
    req.db
  )
  return h.response(allVersions).code(StatusCodes.OK)
}

export const getAllGrantsHandler = async (req, h) => {
  const { draft } = req.query
  const status = getStatusOption(draft)
  const allVersions = await getAllGrantsAllVersions(status, req.db)

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
