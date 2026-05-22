import { considerRelease } from '../../deploy-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'
import { notifyVersion } from '../../notify-version.js'
import { StatusCodes } from 'http-status-codes'

export const postReleaseConfigHandler = async (req, h) => {
  const { grant, version, status, files } = req.payload
  // TODO: Could add some validation here to check the files are in S3 in expected structure, but for now, assume there and OK
  const releaseInfo = await considerRelease(
    req.logger,
    req.db,
    { name: grant, version },
    getServiceVersion(),
    status ?? 'draft',
    files
  )

  if (releaseInfo) {
    await notifyVersion(releaseInfo, req.logger)

    return h.response().code(StatusCodes.ACCEPTED)
  }

  return h.response().code(StatusCodes.NO_CONTENT)
}
