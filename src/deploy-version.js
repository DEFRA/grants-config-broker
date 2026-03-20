import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs'
import { config } from './config.js'
import { load } from 'js-yaml'
import { uploadBlob } from './storage/s3-interactions.js'

const RELEASE_FILE = 'config/release.yml'

export const deployNewVersion = async (db, logger) => {
  logger.info('Checking if new version is available to deploy')
  const releasePresent = existsSync(RELEASE_FILE)

  if (!releasePresent) {
    logger.info('No release file found, no new version available to deploy')
    return
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
    return
  }

  logger.info(
    `${releaseInfo.name} ${releaseInfo.version} will be deployed to S3 with status ${envDeployDetail.status}`
  )
  await uploadToS3(releaseInfo, envDeployDetail.status, logger)
}

const uploadToS3 = async (releaseInfo, status, logger) => {
  //using the name of grant, upload all the config items under config/grant-name to s3
  logger.info(`Uploading config for ${releaseInfo.name} to S3`)
  if (
    existsSync(`config/${releaseInfo.name}`) &&
    lstatSync(`config/${releaseInfo.name}`).isDirectory()
  ) {
    for (const file of readdirSync(`config/${releaseInfo.name}`, {
      recursive: true
    }).filter(
      (file) => !lstatSync(`config/${releaseInfo.name}/${file}`).isDirectory()
    )) {
      logger.info(`Uploading ${file} to version ${releaseInfo.version} in S3`)
      await uploadBlob(
        logger,
        `${releaseInfo.name}/${releaseInfo.version}/${file}`,
        readFileSync(`config/${releaseInfo.name}/${file}`, 'utf8')
      )
    }

    await uploadBlob(
      logger,
      `${releaseInfo.name}/${releaseInfo.version}/metadata.json`,
      JSON.stringify({ status, releaseNotes: releaseInfo.notes })
    )
  } else {
    logger.warn(
      `Config folder for ${releaseInfo.name} not found, so not doing any upload`
    )
  }
}
