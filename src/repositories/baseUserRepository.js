const BaseRepository = require('./baseRepository')
const BaseUser = require('../model/baseuser')
const BaseOrgRepository = require('./baseOrgRepository')
const uuid = require('uuid')
const argon2 = require('argon2')
const BaseOrgModel = require('../model/baseorg')
const RegistryUser = require('../model/registryuser')
const cryptoRandomString = require('crypto-random-string')
const UserRepository = require('./userRepository')
const getConstants = require('../constants').getConstants
const _ = require('lodash')

const skipNulls = (objValue, srcValue) => {
  if (_.isArray(objValue)) {
    return srcValue
  }
  return undefined
}

/**
 * @function setAggregateUserObj
 * @description Constructs the aggregation pipeline for legacy user objects.
 * @param {object} query - The query object to match.
 * @returns {Array} The aggregation pipeline.
 */
function setAggregateUserObj (query) {
  return [
    {
      $match: query
    },
    {
      $project: {
        _id: false,
        username: true,
        name: true,
        UUID: true,
        org_UUID: true,
        active: true,
        'authority.active_roles': true,
        time: true
      }
    }
  ]
}
/**
 * @function setAggregateRegistryUserObj
 * @description Constructs the aggregation pipeline for registry user objects.
 * @param {object} query - The query object to match.
 * @returns {Array} The aggregation pipeline.
 */
function setAggregateRegistryUserObj (query) {
  return [
    {
      $match: query
    },
    {
      $project: {
        _id: false,
        secret: false
      }
    }
  ]
}

class BaseUserRepository extends BaseRepository {
  constructor () {
    super(BaseUser)
  }

  /**
   * @async
   * @function orgHasUserByUUID
   * @description Checks if an organization has a user by UUID.
   * @param {string} orgShortName - The short name of the organization.
   * @param {string} uuid - The UUID of the user.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - Unused parameter.
   * @returns {Promise<boolean>} True if the organization has the user, false otherwise.
   */
  async orgHasUserByUUID (orgShortName, uuid, options = {}, isRegistryObject = true) {
    const org = await BaseOrgModel.findOne({ short_name: orgShortName }, null, options)
    if (!org || !Array.isArray(org.users)) {
      return false
    }

    // 4. Check if any UUID is present in org.users
    return org.users.includes(uuid)
  }

  /**
   * @async
   * @function orgHasUser
   * @description Checks if an organization has a user by username.
   * @param {string} orgShortName - The short name of the organization.
   * @param {string} username - The username to check.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - Unused parameter.
   * @returns {Promise<boolean>} True if the organization has the user, false otherwise.
   */
  async orgHasUser (orgShortName, username, options = {}, isRegistryObject = true) {
    // 1. Find all users with this username
    const users = await BaseUser.find({ username }, null, options)
    if (!users || users.length === 0) {
      return false
    }

    // 2. Get all their UUIDs
    const userUUIDs = users.map(u => u.UUID)

    // 3. Find the org
    const org = await BaseOrgModel.findOne({ short_name: orgShortName }, null, options)
    if (!org || !Array.isArray(org.users)) {
      return false
    }

    // 4. Check if any UUID is present in org.users
    return userUUIDs.some(uuid => org.users.includes(uuid))
  }

  /**
   * @async
   * @function findOneByUsernameAndOrgShortname
   * @description Finds a user by username and organization short name.
   * @param {string} username - The username to find.
   * @param {string} orgShortName - The short name of the organization.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - If false, returns a legacy user object if found.
   * @returns {Promise<object|null>} The user object or null if not found.
   */
  async findOneByUsernameAndOrgShortname (username, orgShortName, options = {}, isRegistryObject = true) {
    const legacyUserRepo = new UserRepository()
    const users = await BaseUser.find({ username: username }, null, options)
    if (!users || users.length === 0) {
      return null
    }
    const org = await BaseOrgModel.findOne({ short_name: orgShortName }, null, options)
    if (!org || !Array.isArray(org.users)) {
      return null
    }
    // users = users.map(user => user.toObject())
    const user = users.find(user => org.users.includes(user.UUID))

    if (!isRegistryObject && user) {
      return await legacyUserRepo.findOneByUUID(user.UUID) || null
    }
    return user || null
  }

  /**
   * @async
   * @function findOneByUserNameAndOrgUUID
   * @description Finds a user by username and organization UUID.
   * @param {string} username - The username to find.
   * @param {string} orgUUID - The UUID of the organization.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - If false, returns a legacy user object if found.
   * @returns {Promise<object|null>} The user object or null if not found.
   */
  async findOneByUserNameAndOrgUUID (username, orgUUID, options = {}, isRegistryObject = true) {
    const legacyUserRepo = new UserRepository()
    const users = await BaseUser.find({ username: username }, null, options)
    if (!users || users.length === 0) {
      return null
    }
    const org = await BaseOrgModel.findOne({ UUID: orgUUID }, null, options)
    if (!org || !Array.isArray(org.users)) {
      return null
    }

    const user = users.find(user => org.users.includes(user.UUID))
    if (!isRegistryObject && user) {
      return await legacyUserRepo.findOneByUUID(user.UUID) || null
    }
    return user || null
  }

  /**
   * @async
   * @function findUserByUUID
   * @description Finds a user by UUID.
   * @param {string} uuid - The UUID to find.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - If false, returns a legacy user object if found.
   * @returns {Promise<object|null>} The user object or null if not found.
   */
  async findUserByUUID (uuid, options = {}, isRegistryObject = true) {
    const legacyUserRepo = new UserRepository()
    const user = await BaseUser.findOne({ UUID: uuid }, null, options)
    if (!isRegistryObject) {
      return await legacyUserRepo.findOneByUUID(user.UUID) || null
    }
    return user || null
  }

  /**
   * @async
   * @function deleteUserByUUID
   * @description Delete a user by UUID from both BaseUser and RegistryUser collections,
   * and remove the user reference from any organizations.
   *
   * @param {string} uuid - The UUID of the user to delete.
   * @param {object} options - Mongoose options for the delete operations.
   * @returns {Promise<number>} Number of deleted documents (should be 1 if successful).
   */
  async deleteUserByUUID (uuid, options = {}) {
    // Delete from BaseUser collection
    const deleteResult = await BaseUser.deleteOne({ UUID: uuid }, options)

    // Delete from RegistryUser collection
    await RegistryUser.deleteOne({ UUID: uuid }, options)

    // Remove user from any organization’s users and admins arrays
    const orgs = await BaseOrgModel.find({ $or: [{ users: uuid }, { admins: uuid }] })
    for (const org of orgs) {
      org.users = org.users.filter(u => u !== uuid)
      if (Array.isArray(org.admins)) {
        org.admins = org.admins.filter(a => a !== uuid)
      }
      await org.save(options)
    }

    return deleteResult.deletedCount
  }

  /**
   * @async
   * @function getUserUUID
   * @description Retrieves the UUID of a user by username and organization short name.
   * @param {string} username - The username.
   * @param {string} orgShortname - The short name of the organization.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - If false, checks for legacy user format compatibility.
   * @returns {Promise<string|null>} The user UUID or null if not found.
   */
  async getUserUUID (username, orgShortname, options = {}, isRegistryObject = true) {
    const user = await this.findOneByUsernameAndOrgShortname(username, orgShortname, options, isRegistryObject)
    if (user) {
      return user.UUID
    }
    return null
  }

  /**
   * @function validateUser
   * @description Validates a user object.
   * @param {object} user - The user object to validate.
   * @returns {object} The validation result object.
   */
  validateUser (user) {
    let validateObject = {}
    // We will default to CNA if a type is not given
    validateObject = BaseUser.validateUser(user)

    return validateObject
  }

  /**
   * @async
   * @function findUsersByOrgShortname
   * @description Finds all users in an organization by the organization's short name.
   * @param {string} shortName - The short name of the organization.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @returns {Promise<string[]>} An array of user UUIDs.
   */
  async findUsersByOrgShortname (shortName, options = {}) {
    const org = await BaseOrgModel.findOne({ short_name: shortName }, null, options)
    return org.users
  }

  /**
   * @async
   * @function isAdmin
   * @description Checks if a user is an Admin of an organization.
   * @param {string} username - The username to check.
   * @param {string} orgShortName - The short name of the organization.
   * @param {object} options - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - Unused parameter.
   * @returns {Promise<boolean>} True if the user is an Admin, false otherwise.
   */
  async isAdmin (username, orgShortName, options, isRegistryObject = true) {
    const baseOrgRepository = new BaseOrgRepository()
    const existingOrg = await baseOrgRepository.findOneByShortName(orgShortName)

    const user = await this.findOneByUsernameAndOrgShortname(username, orgShortName, options)
    if (!user) return false
    return existingOrg.admins.includes(user.UUID)
  }

  /**
   * @async
   * @function isAdminOrSecretariat
   * @description Checks if a user is an Admin or a Secretariat.
   * @param {string} orgShortName - The short name of the organization.
   * @param {string} username - The username to check.
   * @param {string} requesterOrg - The organization of the requester.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - Unused parameter.
   * @returns {Promise<boolean>} True if the user is an Admin or Secretariat, false otherwise.
   */
  async isAdminOrSecretariat (orgShortName, username, requesterOrg, options = {}, isRegistryObject = true) {
    const baseOrgRepository = new BaseOrgRepository()
    const org = await baseOrgRepository.findOneByShortName(requesterOrg)
    if (await baseOrgRepository.isSecretariat(org) || await this.isAdmin(username, orgShortName, options, isRegistryObject)) {
      return true
    }
    return false
  }

  /**
   * @async
   * @function getAllUsers
   * @description Retrieves all users with pagination.
   * @param {object} [options={}] - Pagination and query options.
   * @param {boolean} [isRegistryObject=true] - If true, returns registry formatted users.
   * @returns {Promise<object>} Paginated result containing users and metadata.
   */
  async getAllUsers (options = {}, isRegistryObject = true) {
    const UserRepository = require('./userRepository')
    const userRepo = new UserRepository()
    let pg
    if (!isRegistryObject) {
      const agt = setAggregateUserObj({})
      pg = await userRepo.aggregatePaginate(agt, options)
    } else {
      const agt = setAggregateRegistryUserObj({})
      pg = await this.aggregatePaginate(agt, options)
    }
    const data = { users: pg.itemsList }
    if (pg.itemCount >= options.limit) {
      data.totalCount = pg.itemCount
      data.itemsPerPage = pg.itemsPerPage
      data.pageCount = pg.pageCount
      data.currentPage = pg.currentPage
      data.prevPage = pg.prevPage
      data.nextPage = pg.nextPage
    }
    return data
  }

  /**
   * @async
   * @function createUser
   * @description Creates a new user in both registry and legacy systems.
   * @param {string} orgShortName - The short name of the organization.
   * @param {object} incomingUser - The user object to create.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - If false, accepts legacy user object.
   * @returns {Promise<object>} The created user object (registry or legacy format).
   */
  async createUser (orgShortName, incomingUser, options = {}, isRegistryObject = true) {
    const { deepRemoveEmpty } = require('../utils/utils')
    // TO-DO: org_UUID is not necessarily the shortname. Is this info lost during conversion?
    let legacyObjectRaw = null
    let registryObjectRaw = null
    let registryObject = null
    const legacyUserRepo = new UserRepository()
    const baseOrgRepository = new BaseOrgRepository()

    const sharedUUID = uuid.v4()
    incomingUser.UUID = sharedUUID

    if (!isRegistryObject) {
      legacyObjectRaw = incomingUser
      registryObjectRaw = this.convertLegacyToRegistry(incomingUser)
    } else {
      registryObjectRaw = incomingUser
      legacyObjectRaw = this.convertRegistryToLegacy(incomingUser)
    }

    const randomKey = cryptoRandomString({ length: getConstants().CRYPTO_RANDOM_STRING_LENGTH })
    const secret = await argon2.hash(randomKey)
    registryObjectRaw.secret = secret
    legacyObjectRaw.secret = secret

    // Registry Only Fields
    registryObjectRaw.status = 'active'
    // Legacy Specific fields
    legacyObjectRaw.active = true

    // Get UUID of org, that is having the user added to it.
    const existingOrg = await baseOrgRepository.findOneByShortName(orgShortName)

    const registryUserToSave = new RegistryUser(registryObjectRaw)

    registryObject = await registryUserToSave.save(options)
    baseOrgRepository.addUserToOrg(orgShortName, incomingUser.UUID, (incomingUser.role === 'ADMIN' || incomingUser.authority?.active_roles?.includes('ADMIN')))
    // We now have to make sure the user is added to the ORG's user array
    await legacyUserRepo.updateByUserNameAndOrgUUID(incomingUser.username, existingOrg.UUID, legacyObjectRaw, { ...options, upsert: true })

    if (!isRegistryObject) {
      legacyObjectRaw.secret = randomKey
      legacyObjectRaw.org_UUID = existingOrg.UUID
      delete legacyObjectRaw._id
      delete legacyObjectRaw.__v
      delete legacyObjectRaw.role
      return legacyObjectRaw
    }
    const rawRegistryUserJson = registryObject.toObject()
    rawRegistryUserJson.secret = randomKey
    delete rawRegistryUserJson._id
    delete rawRegistryUserJson.__v
    delete rawRegistryUserJson.authority
    delete rawRegistryUserJson.role
    return deepRemoveEmpty(rawRegistryUserJson)
  }

  /**
   * @async
   * @function updateUser
   * @description Updates a user's details.
   * @param {string} username - The username of the user to update.
   * @param {string} orgShortname - The short name of the organization.
   * @param {object} incomingParameters - The parameters to update.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - If false, returns a legacy user object.
   * @returns {Promise<object>} The updated user object.
   */
  async updateUser (username, orgShortname, incomingParameters, options = {}, isRegistryObject = true) {
    const { deepRemoveEmpty } = require('../utils/utils')
    const baseOrgRepository = new BaseOrgRepository()
    const legacyUserRepo = new UserRepository()
    const registryOrg = await baseOrgRepository.getOrgObject(orgShortname, false, options)
    const legacyUser = await legacyUserRepo.findOneByUserNameAndOrgUUID(username, registryOrg.UUID, null, options)
    const registryUser = await this.findOneByUsernameAndOrgShortname(username, orgShortname, options, true) // WE always want the registry user

    registryUser.username = incomingParameters?.new_username ?? registryUser.username
    legacyUser.username = incomingParameters?.new_username ?? legacyUser.username

    if (incomingParameters?.active != null) {
      const isConsideredActive = incomingParameters.active === true || String(incomingParameters.active).toLowerCase() === 'true'
      registryUser.status = isConsideredActive ? 'active' : 'inactive'
      legacyUser.active = incomingParameters.active ?? legacyUser.active
    }

    ['name.last', 'name.first', 'name.middle', 'name.suffix'].forEach(field => {
      _.set(registryUser, field, _.get(incomingParameters, field, _.get(registryUser, field, '')))
      _.set(legacyUser, field, _.get(incomingParameters, field, _.get(legacyUser, field, '')))
    })

    const rolesToAdd = _.flattenDeep(_.compact(_.get(incomingParameters, 'active_roles.add')))
    const rolesToRemove = _.flattenDeep(_.compact(_.get(incomingParameters, 'active_roles.remove')))
    if (rolesToRemove.includes('ADMIN')) {
      const filteredUuids = registryOrg.admins.filter(uuid => uuid !== registryUser.UUID)
      registryOrg.admins = filteredUuids
    }

    if (rolesToAdd.includes('ADMIN') && !incomingParameters?.org_short_name) {
      // Use the already fetched registryOrg instead of querying again
      registryOrg.admins = [...new Set([...(registryOrg.admins || []), registryUser.UUID])]
    }

    const initialRoles = legacyUser.authority?.active_roles ?? []
    const finalRoles = [...new Set([...initialRoles, ...rolesToAdd])].filter(role => !rolesToRemove.includes(role))
    registryUser.role = finalRoles[0] ?? ''
    _.set(legacyUser, 'authority.active_roles', finalRoles)

    if (incomingParameters?.org_short_name) {
      // Remove us from the old users Array
      const filteredUuids = registryOrg.users.filter(uuid => uuid !== registryUser.UUID)
      registryOrg.users = filteredUuids
      // Add us to the new org (this is a genuine cross-org migration, so we must fetch the new org)
      const newOrg = await baseOrgRepository.getOrgObject(incomingParameters.org_short_name)
      newOrg.users = [...new Set([...newOrg.users, registryUser.UUID])]

      if (registryUser.role.includes('ADMIN')) {
        newOrg.admins = [...new Set([...(newOrg.admins || []), registryUser.UUID])]
      }

      legacyUser.org_UUID = newOrg.UUID
      await newOrg.save(options)
    }

    delete registryUser.role
    // Single unified save for the primary org at the end
    await registryOrg.save(options)

    await legacyUser.save(options)
    await registryUser.save(options)

    if (!isRegistryObject) {
      const plainJavascriptLegacyUser = legacyUser.toObject()
      legacyUser.role = finalRoles[0] ?? ''
      delete plainJavascriptLegacyUser.__v
      delete plainJavascriptLegacyUser._id
      delete plainJavascriptLegacyUser.secret
      // return deepRemoveEmpty(plainJavascriptLegacyUser)
      return plainJavascriptLegacyUser
    }

    const plainJavascriptRegistryUser = registryUser.toObject()
    // Remove private things
    delete plainJavascriptRegistryUser.__v
    delete plainJavascriptRegistryUser._id
    delete plainJavascriptRegistryUser.__t
    delete plainJavascriptRegistryUser.secret
    return deepRemoveEmpty(plainJavascriptRegistryUser)
  }

  /**
   * @async
   * @function updateUserFull
   * @description Updates a user using a full user object.
   * @param {string} identifier - The identifier (UUID) of the user.
   * @param {object} incomingUser - The full user object with updates.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - If false, accepts/returns legacy format.
   * @returns {Promise<object>} The updated user object.
   */
  async updateUserFull (identifier, incomingUser, options = {}, isRegistryObject = true) {
    const legacyUserRepo = new UserRepository()

    // Find registry user by UUID
    const registryUser = await this.findUserByUUID(identifier, options)
    if (!registryUser) {
      throw new Error('Registry user not found')
    }

    // Find legacy user
    const legacyUser = await legacyUserRepo.findOneByUUID(identifier)
    if (!legacyUser) {
      throw new Error('Legacy user not found')
    }

    const { ...incomingUserBody } = incomingUser
    let legacyObjectRaw
    let registryObjectRaw

    if (!isRegistryObject) {
      legacyObjectRaw = incomingUserBody
      registryObjectRaw = this.convertLegacyToRegistry(incomingUserBody)
    } else {
      registryObjectRaw = incomingUserBody
      legacyObjectRaw = this.convertRegistryToLegacy(incomingUserBody)
    }

    const protectedFieldsRegistry = ['_id', 'UUID', '__v', 'secret', 'created', 'last_updated']
    const protectedFieldsLegacy = ['_id', 'UUID', '__v', 'secret', 'time', 'org_UUID']

    const updatedRegistryUser = registryUser.overwrite(_.mergeWith(_.pick(registryUser.toObject(), protectedFieldsRegistry), registryObjectRaw, skipNulls))
    const updatedLegacyUser = legacyUser.overwrite(_.mergeWith(_.pick(legacyUser.toObject(), protectedFieldsLegacy), legacyObjectRaw, skipNulls))

    try {
      if (incomingUser.org_short_name) {
        const baseOrgRepository = new BaseOrgRepository()
        const currentOrgUUID = legacyUser.org_UUID
        const currentOrg = await baseOrgRepository.findOneByUUID(currentOrgUUID)
        const newOrg = await baseOrgRepository.findOneByShortName(incomingUser.org_short_name)

        if (!newOrg) {
          throw new Error(`Organization ${incomingUser.org_short_name} not found`)
        }

        // 1. Remove user from old org's users list
        currentOrg.users = currentOrg.users.filter(u => u !== identifier)

        // 2. Remove user from old org's admins list (if present)
        if (currentOrg.admins && currentOrg.admins.includes(identifier)) {
          currentOrg.admins = currentOrg.admins.filter(a => a !== identifier)
        }

        // 3. Add user to new org's users list
        newOrg.users = [...new Set([...newOrg.users, identifier])]

        // 4. Add user to new org's admins list (if they are an admin)
        const isAdmin = updatedRegistryUser.role === 'ADMIN' || (updatedLegacyUser.authority && updatedLegacyUser.authority.active_roles && updatedLegacyUser.authority.active_roles.includes('ADMIN'))

        if (isAdmin) {
          newOrg.admins = [...new Set([...(newOrg.admins || []), identifier])]
        }

        // 5. Update user's org_UUID
        updatedLegacyUser.org_UUID = newOrg.UUID

        // Save org changes
        await currentOrg.save(options)
        await newOrg.save(options)
      }

      await updatedLegacyUser.save(options)
      await updatedRegistryUser.save(options)
    } catch (error) {
      throw new Error('Failed to update user: ' + error.message)
    }

    if (!isRegistryObject) {
      const plain = updatedLegacyUser.toObject()
      delete plain._id
      delete plain.__v
      delete plain.secret
      return plain
    }

    // Retrieve updated registry user
    const plainJsRegistryUser = updatedRegistryUser.toObject()
    delete plainJsRegistryUser._id
    delete plainJsRegistryUser.__v
    delete plainJsRegistryUser.secret
    delete plainJsRegistryUser.authority

    return plainJsRegistryUser
  }

  /**
   * @async
   * @function resetSecret
   * @description Resets a user's API secret.
   * @param {string} username - The username.
   * @param {string} orgShortName - The short name of the organization.
   * @param {object} [options={}] - Optional settings for the repository query.
   * @param {boolean} [isRegistryObject=true] - Unused parameter.
   * @returns {Promise<string>} The new random secret key.
   */
  async resetSecret (username, orgShortName, options = {}, isRegistryObject = true) {
    const legacyUserRepo = new UserRepository()
    const baseOrgRepository = new BaseOrgRepository()

    const legOrgUUID = await baseOrgRepository.getOrgUUID(orgShortName, options, true)
    const legUser = await legacyUserRepo.findOneByUserNameAndOrgUUID(username, legOrgUUID, null, options)
    const regUser = await this.findOneByUsernameAndOrgShortname(username, orgShortName, options, true)

    const randomKey = cryptoRandomString({ length: getConstants().CRYPTO_RANDOM_STRING_LENGTH })
    const secret = await argon2.hash(randomKey)
    legUser.secret = secret
    regUser.secret = secret
    await legUser.save(options)
    await regUser.save(options)

    return randomKey
  }

  /**
   * @function convertLegacyToRegistry
   * @description Converts a legacy user object to the registry format.
   * @param {object} legacyUser - The legacy user object.
   * @returns {object} The converted registry user object.
   */
  convertLegacyToRegistry (legacyUser) {
    let newRole = ''
    if (legacyUser?.authority?.active_roles?.includes('ADMIN')) {
      newRole = 'ADMIN'
    }
    return {
      UUID: legacyUser.UUID,
      username: legacyUser.username,
      secret: legacyUser.secret,
      role: newRole,
      name: {
        first: legacyUser.name?.first,
        middle: legacyUser.name?.middle,
        last: legacyUser.name?.last,
        suffix: legacyUser.name?.suffix
      },
      status: 'active',
      created: legacyUser?.time?.created ?? null,
      last_updated: legacyUser?.time?.modified ?? null
    }
  }

  /**
   * @function convertRegistryToLegacy
   * @description Converts a registry user object to the legacy format.
   * @param {object} registryUser - The registry user object.
   * @returns {object} The converted legacy user object.
   */
  convertRegistryToLegacy (registryUser) {
    return {
      UUID: registryUser.UUID,
      username: registryUser.username,
      authority: {
        active_roles: registryUser.role === 'ADMIN' ? ['ADMIN'] : []
      },
      name: {
        first: registryUser.name?.first,
        middle: registryUser.name?.middle,
        last: registryUser.name?.last,
        suffix: registryUser.name?.suffix
      },
      secret: registryUser.secret,
      active: registryUser.status === 'active',
      time: {
        created: registryUser?.created ?? null,
        modified: registryUser?.last_updated ?? null
      }
    }
  }

  /**
   * @async
   * @function getAllUsersByOrgShortname
   * @description Retrieves all users for a given organization, with optional pagination.
   *
   * @param {string} orgShortname - The short name of the organization.
   * @param {object} options - Pagination options (e.g., limit, page).
   * @param {boolean} isRegistryObject - Whether to return users in the registry format.
   * @returns {Promise<object>} An object containing the list of users and pagination details.
   */
  async getAllUsersByOrgShortname (orgShortname, options = {}, isRegistryObject = true) {
    const CONSTANTS = getConstants()
    const baseOrgRepository = new BaseOrgRepository()
    const userRepository = new UserRepository()
    const org = await baseOrgRepository.findOneByShortName(orgShortname)
    const usersInOrg = org.toObject().users

    let agt = {}
    let pg
    if (!isRegistryObject) {
      agt = setAggregateUserObj({ org_UUID: org.UUID })
      pg = await userRepository.aggregatePaginate(agt, options)
    } else {
      // wtf
      agt = [
        {
          $match: {
            UUID: { $in: usersInOrg }
          }
        },
        {
          $project: {
            secret: false,
            _id: false
          }
        }
      ]
      pg = await this.aggregatePaginate(agt, options)
    }

    const payload = { users: pg.itemsList }

    if (pg.itemCount >= CONSTANTS.PAGINATOR_OPTIONS.limit) {
      payload.totalCount = pg.itemCount
      payload.itemsPerPage = pg.itemsPerPage
      payload.pageCount = pg.pageCount
      payload.currentPage = pg.currentPage
      payload.prevPage = pg.prevPage
      payload.nextPage = pg.nextPage
    }

    return payload
  }

  /**
   * @async
   * @function populateUsers
   * @description Populates user details for a list of items containing user UUIDs.
   * @param {Array<object>} uuids - Array of objects, each containing a `users` array of UUIDs.
   * @returns {Promise<void>}
   */
  async populateUsers (uuids) {
    for (const item of uuids) {
      if (item.users && item.users.length > 0) {
        const populatedUsers = await Promise.all(
          item.users.map(async (uuid) => {
            const user = await this.findOneByUUID(uuid)
            return user ? user.toObject() : uuid // Return the user object if found, otherwise return the UUID
          })
        )
        item.users = populatedUsers
      }
    }
  }
}
module.exports = BaseUserRepository
