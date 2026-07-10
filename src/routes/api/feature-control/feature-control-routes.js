import {
  postAddFeatureControlSchema,
  putUpdateFeatureControlValueSchema
} from './feature-control-schemas.js'
import {
  postAddFeatureControlHandler,
  putUpdateFeatureControlValueHandler
} from './feature-control-handlers.js'
import Boom from '@hapi/boom'

export const featureControlRoutes = [
  {
    method: 'POST',
    path: '/api/feature-control',
    options: {
      description: 'Add a new feature control',
      handler: postAddFeatureControlHandler,
      validate: {
        payload: postAddFeatureControlSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Post add feature control validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'PUT',
    path: '/api/feature-control/value',
    options: {
      description: 'Update a feature control value',
      handler: putUpdateFeatureControlValueHandler,
      validate: {
        payload: putUpdateFeatureControlValueSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Put feature control value update error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  }
  // We will add GET handlers to retrieve individual feature controls and history plus list of all feature controls in GRAN-64
]
