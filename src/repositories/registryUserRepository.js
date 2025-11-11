const BaseRepository = require('./baseRepository')
const RegistryUser = require('../model/registry-user')
const utils = require('../utils/utils')

class RegistryUserRepository extends BaseRepository {
  constructor () {
    super(RegistryUser)
  }

  async getUserUUID (username, orgUUID, options = {}) {
    return utils.getUserUUID(username, orgUUID, true, options)
  }

  async findOneByUUID (UUID) {
    return this.collection.findOne().byUUID(UUID)
  }

  async findUsersByOrgUUID (orgUUID, options = {}) {
    const filter = { 'org_affiliations.org_id': orgUUID }
    return this.collection.countDocuments(filter, options)
  }

  async isSecretariat (org, options = {}) {
    return utils.isSecretariat(org, true, options)
  }

  async isAdmin (username, orgShortname, options = {}) {
    return utils.isAdmin(username, orgShortname, true, options)
  }

  async isAdminUUID (username, OrgUUID, options = {}) {
    return utils.isAdminUUID(username, OrgUUID, true, options)
  }

  async updateByUserNameAndOrgUUID (username, orgUUID, user, options = {}) {
    const filter = { user_id: username, 'org_affiliations.org_id': orgUUID }
    const updatePayload = { $set: user }
    return this.collection.findOneAndUpdate(filter, updatePayload, options)
  }

  async updateByUUID (uuid, updatePayload, options = {}) {
    const filter = { UUID: uuid }

    const updateOperation = { $set: updatePayload }

    return this.collection.findOneAndUpdate(filter, updateOperation, options)
  }

  async findOneByUserNameAndOrgUUID (userName, orgUUID, projection = null, options = {}) {
    const query = { user_id: userName, 'org_affiliations.org_id': orgUUID }
    return this.collection.findOne(query, projection, options)
  }

  async deleteByUUID (uuid) {
    return this.collection.deleteOne({ UUID: uuid })
  }

  async addOrgToUserAffiliation (userUUID, orgUUID, options = {}) {
    const filter = { UUID: userUUID }
    const updateOperation = {
      $addToSet: {
        org_affiliations: [{
          org_id: orgUUID
        }]
      }
    }

    try {
      const result = await this.collection.updateOne(filter, updateOperation, options)
      if (result.matchedCount === 0) {
        console.warn(`addOrgToUserAffiliation: No ORG found with UUID '${orgUUID}'. User UUID not added.`)
      } else if (result.modifiedCount === 0 && result.matchedCount === 1) {
        console.info(`addOrgToUserAffiliation: ORG UUID '${orgUUID}' was already present in relevant lists for RegistryUser '${userUUID}', or no change was needed.`)
      }
      return result
    } catch (error) {
      console.error(`Error in addOrgToUserAffiliation for RegistryOrg ${orgUUID}, User ${userUUID}:`, error)
      throw error
    }
  }
}

module.exports = RegistryUserRepository
