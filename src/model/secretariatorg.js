const mongoose = require('mongoose')
const BaseOrg = require('./baseorg')
const fs = require('fs')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')
const BaseOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/BaseOrg.json'))
const SecretariatOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/SecretariatOrg.json'))
const ajv = new Ajv({ allErrors: false })
addFormats(ajv)
ajv.addSchema(BaseOrgSchema)

const validate = ajv.compile(SecretariatOrgSchema)

const schema = {
  authority: [String],
  oversees: [String],
  hard_quota: Number,
  soft_quota: Number
}

const options = { discriminatorKey: 'kind' }
const SecretariatSchema = new mongoose.Schema(schema, options)
SecretariatSchema.statics.validateOrg = function (record) {
  const validateObject = {}
  validateObject.isValid = validate(record)

  if (!validateObject.isValid) {
    validateObject.errors = validate.errors
  }
  return validateObject
}
const SecretariatOrg = BaseOrg.discriminator('SecretariatOrg', SecretariatSchema, options)

module.exports = SecretariatOrg
