import { config } from '../config.js'
import { createS3Client } from '../common/helpers/s3/s3-client.js'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { StatusCodes } from 'http-status-codes'

let s3client

const bucketName = config.get('aws.s3.bucketName')

const initialiseClient = () => {
  if (!s3client) {
    s3client = createS3Client({
      region: config.get('aws.region'),
      endpoint: config.get('aws.endpointUrl'),
      forcePathStyle: config.get('aws.s3.forcePathStyle')
    })
  }
  return s3client
}

export const getBucketName = () => bucketName

export const uploadBlob = async (logger, filename, contents) => {
  const client = initialiseClient()
  const params = {
    Bucket: bucketName,
    Key: filename,
    Body: contents
  }

  const result = await client.send(new PutObjectCommand(params))
  logger.info(`Uploaded document: ${filename}, ETag: ${result.ETag}`)

  return result
}

export const deleteBlob = async (filename, logger) => {
  try {
    const client = initialiseClient()
    const bucketParams = {
      Bucket: bucketName,
      Key: filename
    }

    const response = await client.send(new DeleteObjectCommand(bucketParams))

    if (response.$metadata.httpStatusCode === StatusCodes.NO_CONTENT) {
      logger.info(`Successfully deleted blob: ${filename}`)
    } else {
      logger.warn(`Blob not found or already deleted: ${filename}`)
    }

    return true
  } catch (err) {
    logger.error(
      { err },
      `Unable to delete document: ${bucketName}/${filename}`
    )
    throw err
  }
}
