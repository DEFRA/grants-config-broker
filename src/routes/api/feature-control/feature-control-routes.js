import {
  getFeatureControlByNameSchema,
  getFeatureControlsSchema,
  postAddFeatureControlSchema,
  putUpdateFeatureControlStatusSchema,
  putUpdateFeatureControlValueSchema
} from './feature-control-schemas.js'
import {
  getFeatureControlByNameHandler,
  getFeatureControlsHandler,
  postAddFeatureControlHandler,
  putUpdateFeatureControlStatusHandler,
  putUpdateFeatureControlValueHandler
} from './feature-control-handlers.js'
import Boom from '@hapi/boom'

export const featureControlRoutes = [
  {
    method: 'GET',
    path: '/api/feature-control/{name}',
    options: {
      description: 'Get a single feature control by name',
      handler: getFeatureControlByNameHandler,
      validate: {
        params: getFeatureControlByNameSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get feature control by name error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/api/feature-control/{name}/detailed',
    options: {
      description: 'Get a detailed view of a single feature control by name',
      handler: (req, h) => getFeatureControlByNameHandler(req, h, true),
      validate: {
        params: getFeatureControlByNameSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get feature control by name error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/api/feature-controls',
    options: {
      description:
        'Get a list of feature controls with pagination and filtering',
      handler: getFeatureControlsHandler,
      validate: {
        query: getFeatureControlsSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get feature controls list error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
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
  },
  {
    method: 'PUT',
    path: '/api/feature-control/status',
    options: {
      description: 'Update a feature control status',
      handler: putUpdateFeatureControlStatusHandler,
      validate: {
        payload: putUpdateFeatureControlStatusSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Put feature control status update error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  }
]
