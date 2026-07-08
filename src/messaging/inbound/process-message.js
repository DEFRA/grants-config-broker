import { listFiles } from '@defra/grants-config-utils/s3-interactions'
import { considerRelease } from '../../deploy-version.js'
import { getServiceVersion } from '../../utils/get-service-version.js'
import { notifyVersion } from '../outbound/notify-version.js'
import { inputMessageSchema } from './message-schemas.js'

export const processInputMessage = async (message, db, logger, _attributes) => {
  const { value, error } = inputMessageSchema.validate(message)
  if (error) {
    throw error
  }

  const { grant, version, status, files } = value

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
    await notifyVersion({ ...releaseInfo, user: message.user }, logger)
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
