import {
  getAllGrantsHandler,
  getAllVersionsHandler,
  getLatestVersionHandler,
  getSpecificVersionHandler,
  getVersionHistoryHandler
} from './version-handlers.js'
import Boom from '@hapi/boom'
import Joi from 'joi'

const VERSION_OR_COMPONENTS = 'Specify either version or major, minor and patch'

const getLatestVersionSchema = Joi.object({
  grant: Joi.string().required(),
  draft: Joi.string().lowercase().valid('include', 'only').optional(),
  constrainMajor: Joi.alternatives().conditional('constrainMinor', {
    is: Joi.exist(),
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional()
  }),
  constrainMinor: Joi.number().min(0).optional()
})

const getAllVersionsSchema = Joi.object({
  grant: Joi.string().required(),
  draft: Joi.string().lowercase().valid('include', 'only').optional(),
  constrainMajor: Joi.alternatives().conditional('constrainMinor', {
    is: Joi.exist(),
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional()
  }),
  constrainMinor: Joi.number().min(0).optional()
})

const getAllGrantsSchema = Joi.object({
  draft: Joi.string().lowercase().valid('include', 'only').optional()
})

const getSpecificVersionSchema = Joi.object({
  grant: Joi.string().required(),
  version: Joi.string().optional(),
  major: Joi.alternatives().conditional('version', {
    not: Joi.exist(),
    then: Joi.number()
      .min(0)
      .required()
      .error(new Error(VERSION_OR_COMPONENTS)),
    otherwise: Joi.forbidden().error(new Error(VERSION_OR_COMPONENTS))
  }),
  minor: Joi.alternatives().conditional('version', {
    not: Joi.exist(),
    then: Joi.number()
      .min(0)
      .required()
      .error(new Error(VERSION_OR_COMPONENTS)),
    otherwise: Joi.forbidden().error(new Error(VERSION_OR_COMPONENTS))
  }),
  patch: Joi.alternatives().conditional('version', {
    not: Joi.exist(),
    then: Joi.number()
      .min(0)
      .required()
      .error(new Error(VERSION_OR_COMPONENTS)),
    otherwise: Joi.forbidden().error(new Error(VERSION_OR_COMPONENTS))
  })
})

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
