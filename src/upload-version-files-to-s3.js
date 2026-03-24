import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs'
import { config } from './config.js'
import { uploadBlob } from './storage/s3-interactions.js'

export const uploadVersionFilesToS3 = async (releaseInfo, status, logger) => {
  //using the name of grant, upload all the config items under config/grant-name to s3
  const { name: grantName, version } = releaseInfo
  const configDirectory = `config/${grantName}`
  logger.info(`Uploading config for ${grantName} to S3`)
  const manifest = []
  if (existsSync(configDirectory) && lstatSync(configDirectory).isDirectory()) {
    for (const file of readdirSync(configDirectory, {
      recursive: true
    }).filter(
      (maybeFile) => !lstatSync(`${configDirectory}/${maybeFile}`).isDirectory()
    )) {
      logger.info(`Uploading ${file} to version ${version} in S3`)
      const fullFileName = `${grantName}/${version}/${file}`
      await uploadBlob(
        logger,
        fullFileName,
        readFileSync(`${configDirectory}/${file}`, 'utf8')
      )
      manifest.push(fullFileName)
    }

    await uploadMetaDataToS3(releaseInfo, status, logger)
    manifest.push(`${grantName}/${version}/metadata.json`)
  } else {
    logger.warn(
      `Config folder for ${grantName} not found, so not doing any upload`
    )
  }
  return manifest
}

export const uploadMetaDataToS3 = async (releaseInfo, status, logger) => {
  await uploadBlob(
    logger,
    `${releaseInfo.name}/${releaseInfo.version}/metadata.json`,
    JSON.stringify({
      status,
      releaseNotes: releaseInfo.notes,
      updatedInBrokerVersion: config.get('serviceVersion')
    })
  )
}
