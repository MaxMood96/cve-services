const mongoose = require('mongoose')
const BaseOrg = require('./baseorg')
const fs = require('fs')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')
const BaseOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/BaseOrg.json'))
const BulkDownloadOrgSchema = JSON.parse(fs.readFileSync('src/middleware/schemas/BulkDownloadOrg.json'))
const ajv = new Ajv({ allErrors: false })
addFormats(ajv)
ajv.addSchema(BaseOrgSchema)

const validate = ajv.compile(BulkDownloadOrgSchema)

const schema = {}

const options = { discriminatorKey: 'kind' }
const BulkDownloadSchema = new mongoose.Schema(schema, options)
BulkDownloadSchema.statics.validateOrg = function (record) {
  const validateObject = {}
  validateObject.isValid = validate(record)

  if (!validateObject.isValid) {
    validateObject.errors = validate.errors
  }
  return validateObject
}
const BulkDownloadOrg = BaseOrg.discriminator('BulkDownloadOrg', BulkDownloadSchema, options)

module.exports = BulkDownloadOrg
