const mongoose = require('mongoose')
const BaseOrg = require('./baseorg')
const fs = require('fs')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')
const BaseOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/BaseOrg.json'))
const AdpOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/ADPOrg.json'))
const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
ajv.addSchema(BaseOrgSchema)

const validate = ajv.compile(AdpOrgSchema)

// Hard and soft quotas should be retained if something was a cna, then became an adp, then back to cna
// In general, this should never happen, but we have a test case for it, so I want to make sure it works as expected.
const schema = {
  hard_quota: Number,
  soft_quota: Number
}

const options = { discriminatorKey: 'kind' }
const ADPSchema = new mongoose.Schema(schema, options)
ADPSchema.statics.validateOrg = function (record) {
  const validateObject = {}
  validateObject.isValid = validate(record)

  if (!validateObject.isValid) {
    validateObject.errors = validate.errors
  }
  return validateObject
}
const ADPOrg = BaseOrg.discriminator('ADPOrg', ADPSchema, options)

module.exports = ADPOrg
