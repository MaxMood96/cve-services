const mongoose = require('mongoose')
const aggregatePaginate = require('mongoose-aggregate-paginate-v2')
const MongoPaging = require('mongo-cursor-pagination')

const schema = {
  _id: false,
  UUID: String,
  long_name: String,
  short_name: String,
  aliases: [String],
  cve_program_org_function: {
    type: String,
    enum: ['Top Level Root', 'Root', 'CNA', 'CNA-LR', 'Secretariat', 'Board', 'AWG', 'TWG', 'SPWG', 'Bulk Download', 'ADP']
  },
  authority: {
    active_roles: [String]
  },
  reports_to: String,
  oversees: [String],
  root_or_tlr: Boolean,
  users: [String],
  charter_or_scope: String,
  disclosure_policy: String,
  product_list: String,
  soft_quota: Number,
  hard_quota: Number,
  contact_info: {
    additional_contact_users: [String],
    poc: String,
    poc_email: String,
    poc_phone: String,
    admins: [String],
    org_email: String,
    website: String
  },
  in_use: Boolean,
  created: Date,
  last_updated: Date
}

const orgPrivate = '-_id -soft_quota -hard_quota -contact_info.admins -in_use -created -last_updated -__v'
// const orgSecretariat = ''
const RegistryOrgSchema = new mongoose.Schema(schema, { collection: 'RegistryOrg', timestamps: { createdAt: 'created', updatedAt: 'last_updated' } })

RegistryOrgSchema.query.byShortName = function (shortName) {
  return this.where({ short_name: shortName })
}

RegistryOrgSchema.query.byUUID = function (uuid) {
  return this.where({ UUID: uuid })
}

RegistryOrgSchema.statics.populateOverseesAndReportsTo = async function (items) { // Assuming the model name is 'RegistryOrg'
  for (const item of items) {
    if (item.oversees.length > 0) {
      const populatedOversees = await Promise.all(
        item.oversees.map(async (uuid) => {
          const org = await RegistryOrg.findOne({ UUID: uuid }).select(orgPrivate)
          return org ? org.toObject() : uuid // Return the org object if found, otherwise return the UUID
        })
      )
      item.oversees = populatedOversees
    }
    if (item.reports_to) {
      const org = await RegistryOrg.findOne({ UUID: item.reports_to }).select(orgPrivate)
      item.reports_to = org ? org.toObject() : item.reports_to // Return the org object if found, otherwise return the UUID
    }
  }

  return this
}

RegistryOrgSchema.statics.populateOrgAffiliations = async function (items) { // Assuming the model name is 'RegistryOrg'
  for (const item of items) {
    if (item.org_affiliations.length > 0) {
      const populatedOrgs = await Promise.all(
        item.org_affiliations.map(async ({ org_id: uuid, ...orgMeta }) => {
          const org = await RegistryOrg.findOne({ UUID: uuid }).select(orgPrivate)
          return {
            org: org ? org.toObject() : uuid, // Return the org object if found, otherwise return the UUID
            ...orgMeta
          }
        })
      )
      item.org_affiliations = populatedOrgs
    }
  }

  return this
}

RegistryOrgSchema.statics.populateCVEProgramOrgMembership = async function (items) { // Assuming the model name is 'RegistryOrg'
  for (const item of items) {
    if (item.cve_program_org_membership.length > 0) {
      const populatedOrgs = await Promise.all(
        item.cve_program_org_membership.map(async ({ program_org: uuid, ...orgMeta }) => {
          const org = await RegistryOrg.findOne({ UUID: uuid }).select(orgPrivate)
          return {
            org: org ? org.toObject() : uuid, // Return the org object if found, otherwise return the UUID
            ...orgMeta
          }
        })
      )
      item.cve_program_org_membership = populatedOrgs
    }
  }

  return this
}

RegistryOrgSchema.index({ UUID: 1 })
RegistryOrgSchema.index({ 'authority.active_roles': 1 })

RegistryOrgSchema.plugin(aggregatePaginate)

// Cursor pagination
RegistryOrgSchema.plugin(MongoPaging.mongoosePlugin)
const RegistryOrg = mongoose.model('RegistryOrg', RegistryOrgSchema)
module.exports = RegistryOrg
