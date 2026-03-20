import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs'
import { config } from './config.js'
import { load } from 'js-yaml'
import { getBucketName, uploadBlob } from './storage/s3-interactions.js'
import { hasVersionJobAlreadyRun } from './repositories/version-management-repository.js'

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

  logger.info(
    `${releaseInfo.name} ${releaseInfo.version} will be deployed to S3 with status ${envDeployDetail.status}`
  )
  const manifest = await uploadToS3(releaseInfo, envDeployDetail.status, logger)

  return manifest.length
    ? {
        grant: releaseInfo.name,
        version: releaseInfo.version,
        path: getBucketName(),
        status: envDeployDetail.status,
        manifest
      }
    : null
}

const uploadToS3 = async (releaseInfo, status, logger) => {
  //using the name of grant, upload all the config items under config/grant-name to s3
  logger.info(`Uploading config for ${releaseInfo.name} to S3`)
  const manifest = []
  if (
    existsSync(`config/${releaseInfo.name}`) &&
    lstatSync(`config/${releaseInfo.name}`).isDirectory()
  ) {
    for (const file of readdirSync(`config/${releaseInfo.name}`, {
      recursive: true
    }).filter(
      (maybeFile) =>
        !lstatSync(`config/${releaseInfo.name}/${maybeFile}`).isDirectory()
    )) {
      logger.info(`Uploading ${file} to version ${releaseInfo.version} in S3`)
      const fullFileName = `${releaseInfo.name}/${releaseInfo.version}/${file}`
      await uploadBlob(
        logger,
        fullFileName,
        readFileSync(`config/${releaseInfo.name}/${file}`, 'utf8')
      )
      manifest.push(fullFileName)
    }

    await uploadBlob(
      logger,
      `${releaseInfo.name}/${releaseInfo.version}/metadata.json`,
      JSON.stringify({ status, releaseNotes: releaseInfo.notes })
    )
    manifest.push(`${releaseInfo.name}/${releaseInfo.version}/metadata.json`)
  } else {
    logger.warn(
      `Config folder for ${releaseInfo.name} not found, so not doing any upload`
    )
  }
  return manifest
}
