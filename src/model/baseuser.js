const mongoose = require('mongoose')
const fs = require('fs')
const aggregatePaginate = require('mongoose-aggregate-paginate-v2')
const MongoPaging = require('mongo-cursor-pagination')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')

// Load BaseUser JSON schema
const BaseUserSchemaJSON = JSON.parse(fs.readFileSync('src/middleware/schemas/BaseUser.json'))

// Initialize AJV
const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

// Compile validation function
const validate = ajv.compile(BaseUserSchemaJSON)

// Define Mongoose schema based on BaseUser
const schema = {
  UUID: String,
  username: { type: String, required: true },
  secret: { type: String, required: true },
  role: { type: String, required: false },
  name: {
    first: String,
    middle: String,
    last: String,
    suffix: String
  },
  status: { type: String, enum: ['active', 'inactive'] }
}

// Export BaseUser model
const BaseUserMongooseSchema = new mongoose.Schema(schema, {
  collection: 'BaseUser',
  timestamps: { createdAt: 'created', updatedAt: 'last_updated' }
})

// Add validation static
BaseUserMongooseSchema.statics.validateUser = function (record) {
  const result = { isValid: validate(record) }
  if (!result.isValid) result.errors = validate.errors
  return result
}

BaseUserMongooseSchema.plugin(aggregatePaginate)

// Cursor pagination
BaseUserMongooseSchema.plugin(MongoPaging.mongoosePlugin)
const BaseUser = mongoose.model('BaseUser', BaseUserMongooseSchema)
module.exports = BaseUser
