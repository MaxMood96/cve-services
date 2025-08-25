const mongoose = require('mongoose')
const aggregatePaginate = require('mongoose-aggregate-paginate-v2')
const MongoPaging = require('mongo-cursor-pagination')

const schema = {
  _id: false,
  UUID: String,
  user_id: String,
  secret: String,
  name: {
    first: String,
    last: String,
    middle: String,
    suffix: String
  },
  org_affiliations: [{
    org_id: String,
    email: String,
    phone: String
  }],
  cve_program_org_membership: [{
    program_org: String,
    roles: {
      type: [String],
      enum: ['Chair', 'Member', 'Admin']
    },
    status: {
      type: String,
      enum: ['active', 'inactive']
    }
  }],
  created: Date,
  created_by: String,
  last_updated: Date,
  deactivation_date: Date,
  last_active: Date
}

const userPrivate = '-secret -_id -org_affiliations._id -cve_program_org_membership._id -created_by -created -last_updated -last_active -__v'
// const userSecretariat = '-secret'
const RegistryUserSchema = new mongoose.Schema(schema, { collection: 'RegistryUser', timestamps: { createdAt: 'created', updatedAt: 'last_updated' } })

RegistryUserSchema.query.byUserID = function (userID) {
  return this.where({ user_id: userID })
}

RegistryUserSchema.query.byUUID = function (uuid) {
  return this.where({ UUID: uuid })
}

RegistryUserSchema.query.byUserIdAndOrgUUID = function (userId, orgUUID) {
  return this.where({ user_id: userId, 'org_affiliations.org_id': orgUUID })
}

RegistryUserSchema.statics.populateAdmins = async function (items) { // Assuming the model name is 'RegistryUser'
  for (const item of items) {
    if (item.contact_info && item.contact_info.admins && item.contact_info.admins.length > 0) {
      const populatedAdmins = await Promise.all(
        item.contact_info.admins.map(async (uuid) => {
          const user = await RegistryUser.findOne({ UUID: uuid }).select(userPrivate) // Only return necessary fields
          return user ? user.toObject() : uuid // Return the user object if found, otherwise return the UUID
        })
      )
      item.contact_info.admins = populatedAdmins
    }
  }

  return this
}

RegistryUserSchema.statics.populateUsers = async function (items) { // Assuming the model name is 'RegistryUser'
  for (const item of items) {
    if (item.users && item.users.length > 0) {
      const populatedUsers = await Promise.all(
        item.users.map(async (uuid) => {
          const user = await RegistryUser.findOne({ UUID: uuid }).select(userPrivate) // Only return necessary fields
          return user ? user.toObject() : uuid // Return the user object if found, otherwise return the UUID
        })
      )
      item.users = populatedUsers
    }
  }

  return this
}

RegistryUserSchema.statics.populateAdditionalContactUsers = async function (items) { // Assuming the model name is 'RegistryUser'
  for (const item of items) {
    if (item.contact_info && item.contact_info.additional_contact_users && item.contact_info.additional_contact_users.length > 0) {
      const populatedUsers = await Promise.all(
        item.contact_info.additional_contact_users.map(async (uuid) => {
          const user = await RegistryUser.findOne({ UUID: uuid }).select(userPrivate) // Only return necessary fields
          return user ? user.toObject() : uuid // Return the user object if found, otherwise return the UUID
        })
      )
      item.users = populatedUsers
    }
  }

  return this
}

RegistryUserSchema.index({ UUID: 1 })
RegistryUserSchema.index({ user_id: 1 })

RegistryUserSchema.plugin(aggregatePaginate)

// Cursor pagination
RegistryUserSchema.plugin(MongoPaging.mongoosePlugin)
const RegistryUser = mongoose.model('RegistryUser-Old', RegistryUserSchema)
module.exports = RegistryUser
