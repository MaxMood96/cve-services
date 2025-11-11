const BaseRepository = require('./baseRepository')
const RegistryOrg = require('../model/registry-org')
const utils = require('../utils/utils')

class RegistryOrgRepository extends BaseRepository {
  constructor () {
    super(RegistryOrg)
  }

  async findOneByShortName (shortName, options = {}) {
    const query = { short_name: shortName }
    // We are returning the whole object here, so no projection is needed
    return this.collection.findOne(query, null, options)
  }

  async findOneByUUID (UUID) {
    return this.collection.findOne().byUUID(UUID)
  }

  async getOrgUUID (shortName, options = {}) {
    return utils.getOrgUUID(shortName, true, options) // use registryOrgRepository to find org UUID
  }

  async getAllOrgs () {
    return this.collection.find()
  }

  async isSecretariat (shortName, options = {}) {
    return utils.isSecretariat(shortName, true, options)
  }

  async updateByUUID (uuid, org, options = {}) {
    // The filter to find the document
    const filter = { UUID: uuid }
    const updatePayload = { $set: org }
    return this.collection.findOneAndUpdate(filter, updatePayload, options)
  }

  async deleteByUUID (uuid) {
    return this.collection.deleteOne({ UUID: uuid })
  }

  async removeUserFromOrgList (registryOrgUUID, userUUIDToRemove, isAdmin = false, options = {}) {
    if (!registryOrgUUID || !userUUIDToRemove) {
      throw new Error('RegistryOrg UUID and User UUID to remove are required for removeUserFromOrgList.')
    }

    const filter = { UUID: registryOrgUUID }
    const updateOperation = {
      $pull: {
        users: userUUIDToRemove
      }
    }

    if (isAdmin) {
      updateOperation.$pull['contact_info.admins'] = userUUIDToRemove
    }

    try {
      const result = await this.collection.updateOne(filter, updateOperation, options)
      if (result.matchedCount === 0) {
        console.warn(`removeUserFromOrgList: No RegistryOrg found with UUID '${registryOrgUUID}'. User UUID not removed.`)
      } else if (result.modifiedCount === 0) {
        console.info(`removeUserFromOrgList: User UUID '${userUUIDToRemove}' was not found in relevant lists for RegistryOrg '${registryOrgUUID}', or no change was needed.`)
      }
      return result
    } catch (error) {
      console.error(`Error in removeUserFromOrgList for RegistryOrg ${registryOrgUUID}, User ${userUUIDToRemove}:`, error)
      throw error
    }
  }

  async addUserToOrgList (registryOrgUUID, userUUIDToAdd, isAdmin = false, options = {}) {
    if (!registryOrgUUID || !userUUIDToAdd) {
      throw new Error('RegistryOrg UUID and User UUID to add are required for addUserToOrgList.')
    }

    const filter = { UUID: registryOrgUUID }
    const updateOperation = {
      $addToSet: {
        users: userUUIDToAdd
      }
    }

    if (isAdmin) {
      updateOperation.$addToSet['contact_info.admins'] = userUUIDToAdd
    }

    try {
      const result = await this.collection.updateOne(filter, updateOperation, options)
      if (result.matchedCount === 0) {
        console.warn(`addUserToOrgList: No RegistryOrg found with UUID '${registryOrgUUID}'. User UUID not added.`)
      } else if (result.modifiedCount === 0 && result.matchedCount === 1) {
        console.info(`addUserToOrgList: User UUID '${userUUIDToAdd}' was already present in relevant lists for RegistryOrg '${registryOrgUUID}', or no change was needed.`)
      }
      return result
    } catch (error) {
      console.error(`Error in addUserToOrgList for RegistryOrg ${registryOrgUUID}, User ${userUUIDToAdd}:`, error)
      throw error
    }
  }
}

module.exports = RegistryOrgRepository
