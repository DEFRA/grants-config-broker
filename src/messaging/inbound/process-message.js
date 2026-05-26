import { considerRelease } from '../../deploy-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'
import { notifyVersion } from '../outbound/notify-version.js'

export const processInputMessage = async (message, db, logger, _attributes) => {
  try {
    const { grant, version, status, files } = message
    // TODO: Could add some validation here to check the files are in S3 in expected structure, but for now, assume there and OK
    const releaseInfo = await considerRelease(
      logger,
      db,
      { name: grant, version },
      getServiceVersion(),
      status ?? 'draft',
      files
    )

    if (releaseInfo) {
      logger.info('New version released successfully, sending notification')
      await notifyVersion(releaseInfo, logger)
    }
  } catch (err) {
    logger.error(err, 'Unable to process Input request:')
  }
}
