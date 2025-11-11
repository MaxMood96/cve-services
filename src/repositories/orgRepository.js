const BaseRepository = require('./baseRepository')
const Org = require('../model/org')
const utils = require('../utils/utils')

class OrgRepository extends BaseRepository {
  constructor () {
    super(Org)
  }

  async findOneByShortName (shortName, options = {}) {
    const query = { short_name: shortName }
    return this.collection.findOne(query, null, options)
  }

  async findOneByUUID (UUID) {
    return this.collection.findOne().byUUID(UUID)
  }

  async getOrgUUID (shortName, options = {}) {
    return utils.getOrgUUID(shortName, false, options)
  }

  async updateByOrgUUID (orgUUID, updateData, executeOptions = {}) {
    // The filter to find the document
    const filter = { UUID: orgUUID }
    const updatePayload = { $set: updateData }
    return this.collection.findOneAndUpdate(filter, updatePayload, executeOptions)
  }

  async isSecretariat (org, options = {}) {
    return utils.isSecretariat(org, false, options)
  }

  async isSecretariatUUID (shortName) {
    return utils.isSecretariatUUID(shortName)
  }

  async isBulkDownload (shortName) {
    return utils.isBulkDownload(shortName)
  }

  async getAllOrgs () {
    return this.collection.find()
  }
}

module.exports = OrgRepository
