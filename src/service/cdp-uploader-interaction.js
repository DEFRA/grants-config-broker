import { config } from '../config.js'
import { generateMetadataPayload } from '../utils/release-utils.js'
import { Readable } from 'node:stream'

const githubRawPrefix = 'https://raw.githubusercontent.com/DEFRA/'
export const requestCdpUploaderProcess = async (
  grant,
  version,
  repository,
  files,
  status
) => {
  const env = 'dev' //config.get('cdpEnvironment')

  //upload metadata directly to CDP uploader - put this first to trial it, but really probably would do after the other files
  await createMetaDataFileAndUpload(
    grant,
    version,
    repository,
    files,
    env,
    status
  )
  const url = new URL(
    `/initiate`,
    `https://cdp-uploader.${env}.cdp-int.defra.cloud`
  )
  try {
    // create request to upload multiple files using the API download mechanism
    // e.g we ask the CDP uploader to go fetch the list of files from github
    const body = createInitiateBody(
      repository,
      grant,
      version,
      status,
      env,
      files
    )
    console.log(body)
    const response = await fetch(url.href, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.log(response)
    }
    return response.json()
  } catch (err) {
    console.log(err)
  }
}

const createMetaDataFileAndUpload = async (
  grant,
  version,
  repository,
  files,
  env,
  status
) => {
  const payload = generateMetadataPayload(
    { notes: 'created via dev release method' },
    status
  )
  const body = createInitiateBody(repository, grant, version, status, env)
  const url = new URL(
    `/initiate`,
    `https://cdp-uploader.${env}.cdp-int.defra.cloud`
  )
  try {
    // create request to upload single file using the API upload mechanism
    // e.g we tell the CDP uploader to process a file
    console.log(body)
    const response = await fetch(url.href, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.log(response)
    }
    // response should contain e.g
    /*
    {
  "uploadId": "fc730e47-73c6-4219-a3c5-49b6dfce6e71",
  "uploadUrl": "/upload-and-scan/fc730e47-73c6-4219-a3c5-49b6dfce6e71",
  "statusUrl": "https://cdp-uploader.perf-test.cdp-int.defra.cloud/status/fc730e47-73c6-4219-a3c5-49b6dfce6e71"
}
     */
    const bodyJson = await response.json()
    console.log(bodyJson)
    const respBody = bodyJson
    const postUrl = new URL(
      respBody.uploadUrl,
      `https://cdp-uploader.${env}.cdp-int.defra.cloud`
    )

    const rs = Readable.from([payload])

    const uploadResponse = await fetch(postUrl.href, {
      method: 'POST',
      body: rs,
      duplex: 'half',
      headers: {
        'Content-Type': 'application/json',
        'x-filename': `${grant}/${version}/metadata.json`
      }
    })

    console.log(uploadResponse)
  } catch (err) {
    console.log(err)
  }
}

const createInitiateBody = (repository, grant, version, status, env, files) => {
  const verifyUploader = config.get('verifyUploader')
  const body = {
    callback: `https://my-service.${env}.cdp-int.defra.cloud/api/upload-complete/${verifyUploader}`,
    s3Bucket: 'dev-grants-config-c63f2', // config.get('aws.s3.bucketName'),
    metadata: {
      reference: `${grant}/${version}`,
      status
    }
  }

  if (files) {
    body.downloadUrls = files.map(
      (file) => `${githubRawPrefix}${repository}/${version}/${file}`
    )
  } else {
    body.redirect = '/upload-successful'
  }

  return JSON.stringify(body)
}

export const confirmCdpUpload = async (payload, logger) => {
  const {
    uploadStatus,
    metadata: { reference, status },
    form: { files }, // form: { file, files },
    numberOfRejectedFiles
  } = payload
  if (uploadStatus === 'ready' && numberOfRejectedFiles === 0) {
    const numberOfFiles = files ? files.length : 1
    logger.info(
      `Upload complete for ${numberOfFiles} files for ${reference} - ${status}`
    )
    // now call the publish mechanism
  } else {
    logger.warn(`Upload failed for ${reference} - ${status}`)
  }
}
