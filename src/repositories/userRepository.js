const BaseRepository = require('./baseRepository')
const User = require('../model/user')

class UserRepository extends BaseRepository {
  constructor () {
    super(User)
  }

  async getUserUUID (userName, orgUUID, options = {}) {
    const utils = require('../utils/utils')
    return utils.getUserUUID(userName, orgUUID, options)
  }

  async isAdmin (username, shortname, options = {}) {
    const utils = require('../utils/utils')
    return utils.isAdmin(username, shortname, false, options)
  }

  async isAdminUUID (username, orgUUID) {
    const utils = require('../utils/utils')
    return utils.isAdminUUID(username, orgUUID)
  }

  async findOneByUUID (UUID) {
    return this.collection.findOne().byUUID(UUID)
  }

  async findUsersByOrgUUID (orgUUID, options = {}) {
    // Assumes your User schema has a field named 'org_UUID' linking to the organization.
    const filter = { org_UUID: orgUUID }
    return this.collection.countDocuments(filter, options)
  }

  async updateByUUID (uuid, updatePayload, options = {}) {
    const filter = { UUID: uuid }
    const updateOperation = { $set: updatePayload }
    return this.collection.findOneAndUpdate(filter, updateOperation, options)
  }

  async findOneByUserNameAndOrgUUID (userName, orgUUID, projection = null, options = {}) {
    const query = { username: userName, org_UUID: orgUUID }
    return this.collection.findOne(query, projection, options)
  }

  async updateByUserNameAndOrgUUID (username, orgUUID, user, options = {}) {
    const filter = { username: username, org_UUID: orgUUID }
    const updatePayload = { $set: user }
    return this.collection.findOneAndUpdate(filter, updatePayload, options)
  }

  async getAllUsers () {
    return this.collection.find()
  }
}

module.exports = UserRepository
