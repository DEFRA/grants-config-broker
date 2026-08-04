import Joi from 'joi'

export const postReleaseConfigSchema = Joi.object({
  grant: Joi.string().required(),
  version: Joi.string().required(),
  files: Joi.array().items(Joi.string()).min(1).required(),
  status: Joi.string().lowercase().valid('draft', 'active').optional(),
  user: Joi.string().required()
})
