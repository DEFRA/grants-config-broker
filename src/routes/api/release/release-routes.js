import { postReleaseConfigSchema } from './release-schemas.js'
import { postReleaseConfigHandler } from './release-handlers.js'
import Boom from '@hapi/boom'

export const releaseRoutes = [
  {
    method: 'POST',
    path: '/api/release-config',
    options: {
      description: 'Post release config for a given grant',
      handler: postReleaseConfigHandler,
      plugins: {
        'service-auth': {
          allowedSubjects: ['grants-config-browser']
        }
      },
      validate: {
        payload: postReleaseConfigSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Post release config validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  }
]
