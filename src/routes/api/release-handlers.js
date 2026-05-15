import { config } from '../../config.js'
import {
  confirmCdpUpload,
  requestCdpUploaderProcess
} from '../../service/cdp-uploader-interaction.js'

export const postReleaseConfigHandler = async (req, h) => {
  const { grant, version, repository, status, files } = req.payload
  // first check if the version is already in the database
  // delegate to service
  await requestCdpUploaderProcess(
    grant,
    version,
    repository,
    files,
    status ?? 'draft'
  )
}

export const postConfirmUploaderHandler = async (req, h) => {
  const { verifyUploader } = req.params
  if (verifyUploader !== config.get('verifyUploader')) {
    req.logger.warn('Received incorrect verifier signature')
    return h.response('Received incorrect verifier signature').code(400)
  }

  await confirmCdpUpload(req.payload, req.logger)
  return h.response('OK').code(200)
}
