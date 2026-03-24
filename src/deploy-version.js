import { existsSync, readFileSync } from 'node:fs'
import { config } from './config.js'
import { load } from 'js-yaml'
import { getBucketName } from './storage/s3-interactions.js'
import {
  findVersion,
  hasVersionJobAlreadyRun,
  storeVersion
} from './repositories/version-management-repository.js'
import {
  uploadMetaDataToS3,
  uploadVersionFilesToS3
} from './upload-version-files-to-s3.js'
import { isLatestVersion } from './service/latest-version.js'

const RELEASE_FILE = 'config/release.yml'

export const deployNewVersion = async (db, logger) => {
  const serviceVersion = config.get('serviceVersion')
  const versionAlreadyRun = await hasVersionJobAlreadyRun(serviceVersion, db)

  // Prevents the version work from executing in multiple instances, or if app is restarted etc
  // Will want to add safety to this, to undo this transaction if there is a failure etc
  if (versionAlreadyRun) {
    logger.info('Release version job already run, no need to run again')
    return null
  }

  logger.info('Checking if new version is available to deploy')
  const releasePresent = existsSync(RELEASE_FILE)

  if (!releasePresent) {
    logger.info('No release file found, no new version available to deploy')
    return null
  }
  logger.info('Release file found')
  const currentEnv = config.get('cdpEnvironment')

  //if release file found, parse it to see if there is something to consider for current env
  const releaseInfo = load(readFileSync(RELEASE_FILE), 'utf8')
  const envDeployDetail = releaseInfo.environments.find(
    (env) => env.name === currentEnv
  ) ?? { status: 'none' }
  if (envDeployDetail.status === 'none') {
    logger.info(
      `${releaseInfo.name} ${releaseInfo.version} is not applicable to this environment`
    )
    return null
  }

  //at this point we have a version to release, but we need to check if already released on this env
  const existingRecord = await findVersion(
    releaseInfo.version,
    releaseInfo.name,
    db
  )

  if (existingRecord) {
    //if already released, we may need to update the status
    if (existingRecord.status !== envDeployDetail.status) {
      existingRecord.status = envDeployDetail.status
      existingRecord.updatedInBrokerVersion = serviceVersion
      existingRecord.lastUpdated = new Date()

      await uploadMetaDataToS3(releaseInfo, envDeployDetail.status, logger)
      await storeVersion(existingRecord, db)
      return {
        ...createVersionStoreInfo(
          releaseInfo,
          envDeployDetail,
          existingRecord.manifest
        ),
        isLatest: await isLatestVersion(
          releaseInfo.name,
          releaseInfo.version,
          envDeployDetail.status,
          db
        )
      }
    }
    logger.warn('Version already deployed to S3, no status change')
    return null
  } else {
    return deployUnreleasedVersion(
      releaseInfo,
      envDeployDetail,
      serviceVersion,
      db,
      logger
    )
  }
}

const deployUnreleasedVersion = async (
  releaseInfo,
  envDeployDetail,
  serviceVersion,
  db,
  logger
) => {
  logger.info(
    `${releaseInfo.name} ${releaseInfo.version} will be deployed to S3 with status ${envDeployDetail.status}`
  )
  const manifest = await uploadVersionFilesToS3(
    releaseInfo,
    envDeployDetail.status,
    logger
  )

  const versionStoreInfo = createVersionStoreInfo(
    releaseInfo,
    envDeployDetail,
    manifest
  )
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
    return {
      ...versionStoreInfo,
      isLatest: await isLatestVersion(
        releaseInfo.name,
        releaseInfo.version,
        envDeployDetail.status,
        db
      )
    }
  }
  return null
}

const createVersionStoreInfo = (releaseInfo, envDeployDetail, manifest) => {
  const versionSplit = releaseInfo.version.split('.')

  return manifest.length
    ? {
        grant: releaseInfo.name,
        version: releaseInfo.version,
        versionMajor: Number.parseInt(versionSplit[0]),
        versionMinor: Number.parseInt(versionSplit[1]),
        versionPatch: Number.parseInt(versionSplit[2]),
        path: getBucketName(),
        status: envDeployDetail.status,
        manifest
      }
    : null
}
