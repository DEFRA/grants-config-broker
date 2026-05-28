import { considerRelease } from '../../deploy-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'
import { notifyVersion } from '../outbound/notify-version.js'
import { listFiles } from '../../storage/s3-interactions.js'

export const processInputMessage = async (message, db, logger, _attributes) => {
  try {
    const { grant, version, status, files } = message

    logger.info(
      `Received Config Input request for grant: ${grant}, version: ${version}`
    )
    await validateFilesInS3(grant, version, files, logger)

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

const validateFilesInS3 = async (grant, version, files, logger) => {
  const configFiles = await listFiles(logger, `${grant}/${version}`)
  const missingFiles = files.filter(
    (fileName) => !configFiles.some((file) => file.Key === fileName)
  )
  if (missingFiles.length > 0) {
    throw new Error(
      `Missing files in S3, cannot publish this config version: ${missingFiles.join(', ')}`
    )
  }
}
