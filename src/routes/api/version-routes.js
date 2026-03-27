import {
  getAllGrantsHandler,
  getAllVersionsHandler,
  getLatestVersionHandler,
  getSpecificVersionHandler,
  getVersionHistoryHandler
} from './version-handlers.js'
import Boom from '@hapi/boom'
import {
  getAllGrantsSchema,
  getAllVersionsSchema,
  getLatestVersionSchema,
  getSpecificVersionSchema
} from './version-schemas.js'

export const versionRoutes = [
  {
    method: 'GET',
    path: '/api/latestVersion',
    options: {
      description: 'Get latest version of config for a given grant',
      handler: getLatestVersionHandler,
      validate: {
        query: getLatestVersionSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get latest version validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/api/version',
    options: {
      description: 'Get specific version of config for a given grant',
      handler: getSpecificVersionHandler,
      validate: {
        query: getSpecificVersionSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get latest version validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/api/allVersions',
    options: {
      description: 'Get info on all versions of config for a given grant',
      handler: getAllVersionsHandler,
      validate: {
        query: getAllVersionsSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get all versions validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/api/allGrants',
    options: {
      description: 'Get info on all versions of all grants',
      handler: getAllGrantsHandler,
      validate: {
        query: getAllGrantsSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get all grants versions validation error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/api/versionHistory',
    options: {
      description: 'Get version history for a version of a grant',
      handler: getVersionHistoryHandler,
      validate: {
        query: getSpecificVersionSchema,
        failAction(request, _h, err) {
          request.logger.error(err, 'Get version history error')
          throw Boom.badRequest(err.message)
        }
      }
    }
  }
]
