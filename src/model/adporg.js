const mongoose = require('mongoose')
const BaseOrg = require('./baseorg')
const fs = require('fs')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')
const BaseOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/BaseOrg.json'))
const AdpOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/ADPOrg.json'))
const ajv = new Ajv({ allErrors: false })
addFormats(ajv)
ajv.addSchema(BaseOrgSchema)

const validate = ajv.compile(AdpOrgSchema)

const schema = {}

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
