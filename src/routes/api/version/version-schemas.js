import Joi from 'joi'

const VERSION_OR_COMPONENTS = 'Specify either version or major, minor and patch'

export const getLatestVersionSchema = Joi.object({
  grant: Joi.string().required(),
  draft: Joi.string().lowercase().valid('include', 'only').optional(),
  constrainMajor: Joi.alternatives().conditional('constrainMinor', {
    is: Joi.exist(),
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional()
  }),
  constrainMinor: Joi.number().min(0).optional()
})

export const getAllVersionsSchema = Joi.object({
  grant: Joi.string().required(),
  draft: Joi.string().lowercase().valid('include', 'only').optional(),
  constrainMajor: Joi.alternatives().conditional('constrainMinor', {
    is: Joi.exist(),
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional()
  }),
  constrainMinor: Joi.number().min(0).optional()
})

export const getAllGrantsSchema = Joi.object({
  draft: Joi.string().lowercase().valid('include', 'only').optional()
})

export const getSpecificVersionSchema = Joi.object({
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
