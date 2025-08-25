const mongoose = require('mongoose')
const aggregatePaginate = require('mongoose-aggregate-paginate-v2')
const MongoPaging = require('mongo-cursor-pagination')

const toUndefined = value => (value === '' ? undefined : value)

const schema = {
  _id: false,
  UUID: String,
  long_name: String,
  short_name: String,
  aliases: [String],
  authority: [String],
  root_or_tlr: Boolean,
  reports_to: String,
  users: { type: [String], set: toUndefined },
  admins: [String],
  contact_info: {
    additional_contact_users: [String],
    poc: String,
    poc_email: String,
    poc_phone: String,
    org_email: String,
    website: String
  },
  in_use: Boolean,
  created: Date,
  last_updated: Date
}

const options = { discriminatorKey: 'kind' }
const BaseOrgSchema = new mongoose.Schema(schema, { collection: 'BaseOrg', timestamps: { createdAt: 'created', updatedAt: 'last_updated' } }, options)
BaseOrgSchema.plugin(aggregatePaginate)

// Cursor pagination
BaseOrgSchema.plugin(MongoPaging.mongoosePlugin)
const BaseOrg = mongoose.model('BaseOrg', BaseOrgSchema)
module.exports = BaseOrg
