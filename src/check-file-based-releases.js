import { existsSync, readFileSync } from 'node:fs'
import { config } from './config.js'
import { load } from 'js-yaml'
import { hasVersionJobAlreadyRun } from './repositories/version-management-repository.js'
import { getServiceVersion } from './utils/get-service-version.js'
import { considerRelease } from './deploy-version.js'

const RELEASE_FILE = 'config/release.yml'

export const checkReleaseFileForVersionDeployment = async (db, logger) => {
  const serviceVersion = getServiceVersion()
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

  const allReleasesToConsider = Array.isArray(releaseInfo.releases)
    ? releaseInfo.releases
    : [releaseInfo]
  const returnInfo = []
  for (const versionToConsider of allReleasesToConsider) {
    const { status } = deriveEnvironmentStatus(
      versionToConsider,
      currentEnv,
      logger
    )
    if (status !== 'none') {
      const releaseVersionInfo = await considerRelease(
        logger,
        db,
        versionToConsider,
        serviceVersion,
        status
      )
      if (releaseVersionInfo) {
        returnInfo.push(releaseVersionInfo)
      }
    }
  }
  return returnInfo
}

const deriveEnvironmentStatus = (releaseInfo, currentEnv, logger) => {
  const envDeployDetail = releaseInfo.environments.find(
    (env) => env.name === currentEnv
  ) ?? { status: 'none' }
  if (envDeployDetail.status === 'none') {
    logger.info(
      `${releaseInfo.name} ${releaseInfo.version} is not applicable to this environment`
    )
    return { status: 'none' }
  }

  return envDeployDetail
}
