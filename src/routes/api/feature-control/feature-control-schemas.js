import Joi from 'joi'

export const typeMap = {
  'list-string': Joi.array().items(Joi.string()),
  'list-number': Joi.array().items(Joi.number().strict()),
  boolean: Joi.boolean().strict(),
  date: Joi.date(),
  string: Joi.string(),
  number: Joi.number().strict()
}

const getInitialValueSchema = (valueSchema) =>
  Joi.object({
    default: valueSchema,
    dev: valueSchema,
    test: valueSchema,
    'ext-test': valueSchema,
    'perf-test': valueSchema,
    prod: valueSchema
  })
    .when(Joi.object({ default: Joi.exist() }).unknown(), {
      then: Joi.object(),
      otherwise: Joi.object({
        dev: Joi.required(),
        test: Joi.required(),
        'ext-test': Joi.required(),
        'perf-test': Joi.required(),
        prod: Joi.required()
      })
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
  roleRequired: Joi.array().items(Joi.string()).min(0).optional()
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
