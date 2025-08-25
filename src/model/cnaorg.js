const mongoose = require('mongoose')
const BaseOrg = require('./baseorg')
const fs = require('fs')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')
const BaseOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/BaseOrg.json'))
const CnaOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/CNAOrg.json'))
const ajv = new Ajv({ allErrors: false })
addFormats(ajv)
ajv.addSchema(BaseOrgSchema)

const validate = ajv.compile(CnaOrgSchema)

const schema = {
  authority: [String],
  oversees: [String],
  hard_quota: Number,
  soft_quota: Number,
  charter_or_scope: String,
  disclosure_policy: String,
  product_list: String
}

const options = { discriminatorKey: 'kind' }
const CNASchema = new mongoose.Schema(schema, options)
CNASchema.statics.validateOrg = function (record) {
  const validateObject = {}
  validateObject.isValid = validate(record)

  if (!validateObject.isValid) {
    validateObject.errors = validate.errors
  }
  return validateObject
}
const CNAOrg = BaseOrg.discriminator('CNAOrg', CNASchema, options)

module.exports = CNAOrg
