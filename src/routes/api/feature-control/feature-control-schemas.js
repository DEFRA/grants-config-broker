import Joi from 'joi'

export const typeMap = {
  'list-string': Joi.array().items(Joi.string()),
  'list-number': Joi.array().items(Joi.number().strict()),
  boolean: Joi.boolean().strict(),
  date: Joi.date(),
  string: Joi.string(),
  number: Joi.number().strict()
}

const allEnvironments = ['dev', 'test', 'perf-test', 'ext-test', 'prod']

const getInitialValueSchema = (valueSchema) =>
  Joi.object({
    default: valueSchema,
    dev: valueSchema,
    test: valueSchema,
    'ext-test': valueSchema,
    'perf-test': valueSchema,
    prod: valueSchema
  })
    .custom((value, helpers) => {
      // short-circuit if default is present
      if (value.default !== undefined) {
        return value
      }

      // check if required envs are present
      const { environments } = helpers.state.ancestors[0]
      const requiredEnvs = environments?.length ? environments : allEnvironments
      const missingEnvValues = requiredEnvs.filter(
        (env) => value[env] === undefined
      )
      if (missingEnvValues.length) {
        return helpers.error('initialValue.defaultOrEnvironments', {
          missing: missingEnvValues.join(', ')
        })
      }

      // required envs are present
      return value
    })
    .messages({
      'initialValue.defaultOrEnvironments':
        '"initialValue" must contain either a "default" value or values for required environments. Missing: {{#missing}}'
    })
    .unknown(false)

export const postAddFeatureControlSchema = Joi.object({
  name: Joi.string().uppercase().required(),
  type: Joi.string()
    .valid(...Object.keys(typeMap))
    .required(),
  initialValue: Joi.any().required(),
  scopes: Joi.array()
    .items(
      Joi.string()
        .lowercase()
        .pattern(/^(grant|service|feature)\.[\w-]+$/)
        .required()
    )
    .min(1)
    .required(),
  description: Joi.string().required(),
  owner: Joi.string().required(),
  expiryDate: Joi.date().required(),
  createdBy: Joi.string().required(),
  roleRequired: Joi.array().items(Joi.string()).min(0).optional(),
  environments: Joi.array()
    .items(Joi.string().valid(...allEnvironments))
    .min(0)
    .optional()
}).when('.type', {
  switch: Object.entries(typeMap).map(([type, schema]) => ({
    is: type,
    then: Joi.object({
      initialValue: getInitialValueSchema(schema)
    })
  }))
})

export const putUpdateFeatureControlValueSchema = Joi.object({
  name: Joi.string().uppercase().required(),
  value: Joi.any().required(),
  user: Joi.string().required(),
  note: Joi.string().allow('').optional()
})

export const getFeatureControlByNameSchema = Joi.object({
  name: Joi.string().uppercase().required()
})

export const getFeatureControlsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  name: Joi.string().optional(),
  owner: Joi.string().optional(),
  scope: Joi.string().optional(),
  type: Joi.string()
    .valid(...Object.keys(typeMap))
    .optional()
})
