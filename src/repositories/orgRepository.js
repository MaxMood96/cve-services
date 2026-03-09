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
    const data = await this.collection.findOneAndUpdate(filter, updatePayload, { ...executeOptions, new: true })
    return data
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

  async deleteOneByShortName (shortName, options = {}) {
    return this.collection.deleteOne({ short_name: shortName }, options)
  }
}

module.exports = OrgRepository
