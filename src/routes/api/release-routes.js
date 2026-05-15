import {
  postConfirmUploadSchema,
  postReleaseConfigSchema
} from './release-schemas.js'
import {
  postConfirmUploaderHandler,
  postReleaseConfigHandler
} from './release-handlers.js'
import Joi from 'joi'
import Boom from '@hapi/boom'

export const releaseRoutes = [
  {
    method: 'POST',
    path: '/api/release-config',
    options: {
      description: 'Post release config for a given grant',
      handler: postReleaseConfigHandler,
      validate: {
        payload: postReleaseConfigSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Post release config validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/api/upload-complete/{verifyUploader}',
    options: {
      auth: false, // Uploader needs to be able to hit this endpoint
      description: 'Confirm config upload complete',
      handler: postConfirmUploaderHandler,
      validate: {
        params: Joi.object({ verifyUploader: Joi.string().required() }),
        payload: postConfirmUploadSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Post confirm upload validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  }
]
