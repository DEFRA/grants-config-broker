import {
  findVersion,
  storeVersion
} from './repositories/version-management-repository.js'
import {
  uploadMetaDataToS3,
  uploadVersionFilesToS3
} from './upload-version-files-to-s3.js'
import { isLatestVersion } from './service/latest-version.js'
import { trackEvent } from './common/helpers/logging/logger.js'
import { getBucketName } from '@defra/grants-config-utils/s3-interactions'

export const considerRelease = async (
  logger,
  db,
  releaseInfo,
  serviceVersion,
  status,
  manifest
) => {
  //at this point we have a version to release, but we need to check if already released on this env
  const existingRecord = await findVersion(
    releaseInfo.version,
    releaseInfo.name,
    db
  )

  if (existingRecord) {
    //if already released, we may need to update the status
    if (existingRecord.status !== status) {
      existingRecord.status = status
      existingRecord.updatedInBrokerVersion = serviceVersion
      existingRecord.lastUpdated = new Date()

      await uploadMetaDataToS3(releaseInfo, status, logger)
      await storeVersion(existingRecord, db)

      trackEvent(logger, 'version-update', 'status-change', {
        reference: `grant: ${releaseInfo.name}, version: ${releaseInfo.version}, brokerVersion: ${serviceVersion}`,
        kind: status
      })

      return {
        ...createVersionStoreInfo(releaseInfo, status, existingRecord.manifest),
        isLatest: await isLatestVersion(
          releaseInfo.name,
          releaseInfo.version,
          status,
          db
        )
      }
    }
    logger.warn(
      `${releaseInfo.name} Version ${releaseInfo.version} already deployed to S3, and no status change. Nothing happened!`
    )
    return null
  } else {
    return deployUnreleasedVersion(
      releaseInfo,
      status,
      serviceVersion,
      manifest,
      db,
      logger
    )
  }
}

const deployUnreleasedVersion = async (
  releaseInfo,
  status,
  serviceVersion,
  manifest,
  db,
  logger
) => {
  if (manifest) {
    logger.info(
      `${releaseInfo.name} ${releaseInfo.version} (${status}) already in S3, will update metadata only`
    )
    await uploadMetaDataToS3(releaseInfo, status, logger)
    const { name, version } = releaseInfo
    manifest.push(`${name}/${version}/metadata.json`)
  } else {
    logger.info(
      `${releaseInfo.name} ${releaseInfo.version} will be deployed to S3 with status ${status}`
    )

    manifest = await uploadVersionFilesToS3(releaseInfo, status, logger)
  }

  const versionStoreInfo = createVersionStoreInfo(releaseInfo, status, manifest)
  if (versionStoreInfo) {
    const { path, ...rest } = versionStoreInfo
    await storeVersion(
      {
        ...rest,
        lastUpdated: new Date(),
        createdInBrokerVersion: serviceVersion,
        updatedInBrokerVersion: serviceVersion
      },
      db
    )

    trackEvent(logger, 'version-update', 'new-version', {
      reference: `grant: ${releaseInfo.name}, version: ${releaseInfo.version}, brokerVersion: ${serviceVersion}`,
      kind: status
    })

    return {
      ...versionStoreInfo,
      isLatest: await isLatestVersion(
        releaseInfo.name,
        releaseInfo.version,
        status,
        db
      )
    }
  }
  return null
}

const createVersionStoreInfo = (releaseInfo, status, manifest) => {
  const versionSplit = releaseInfo.version.split('.')

  return manifest.length
    ? {
        grant: releaseInfo.name,
        version: releaseInfo.version,
        versionMajor: Number.parseInt(versionSplit[0]),
        versionMinor: Number.parseInt(versionSplit[1]),
        versionPatch: Number.parseInt(versionSplit[2]),
        path: getBucketName(),
        status,
        manifest
      }
    : null
}
