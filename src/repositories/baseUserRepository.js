const BaseRepository = require('./baseRepository')
const BaseUser = require('../model/baseuser')
const BaseOrgRepository = require('./baseOrgRepository')
const uuid = require('uuid')
const argon2 = require('argon2')
const BaseOrgModel = require('../model/baseorg')
const RegistryUser = require('../model/registryuser')
const cryptoRandomString = require('crypto-random-string')
const UserRepository = require('./userRepository')
const _ = require('lodash')
const getConstants = require('../constants').getConstants

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
function setAggregateRegistryUserObj (query) {
  return [
    {
      $match: query
    }
  ]
}

class BaseUserRepository extends BaseRepository {
  constructor () {
    super(BaseUser)
  }

  // Check if an org has a user by username
  async orgHasUserByUUID (orgShortName, uuid, options = {}, isLegacyObject = false) {
    const org = await BaseOrgModel.findOne({ short_name: orgShortName }, null, options)
    if (!org || !Array.isArray(org.users)) {
      return false
    }

    // 4. Check if any UUID is present in org.users
    return org.users.includes(uuid)
  }

  async orgHasUser (orgShortName, username, options = {}, isLegacyObject = false) {
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

  async findOneByUsernameAndOrgShortname (username, orgShortName, options = {}, isLegacyObject = false) {
    const legacyUserRepo = new UserRepository()
    const users = await BaseUser.find({ username: username }, null, options)
    if (!users || users.length === 0) {
      return null
    }
    const org = await BaseOrgModel.findOne({ short_name: orgShortName }, null, options)
    if (!org || !Array.isArray(org.users)) {
      return null
    }

    const user = users.find(user => org.users.includes(user.UUID))

    if (isLegacyObject && user) {
      return await legacyUserRepo.findOneByUUID(user.UUID) || null
    }
    return user || null
  }

  async findOneByUsernameAndOrgUUID (username, orgUUID, options = {}, isLegacyObject = false) {
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
    if (isLegacyObject && user) {
      return await legacyUserRepo.findOneByUUID(user.UUID) || null
    }
    return user || null
  }

  async findUserByUUID (uuid, options = {}, isLegacyObject = false) {
    const legacyUserRepo = new UserRepository()
    const user = await BaseUser.find({ UUID: uuid }, null, options)
    if (isLegacyObject) {
      return await legacyUserRepo.findOneByUUID(user.UUID) || null
    }
    return user || null
  }

  async getUserUUID (username, orgShortname, options = {}, isLegacyObject = false) {
    const user = await this.findOneByUsernameAndOrgShortname(username, orgShortname, options, isLegacyObject)
    if (user) {
      return user.UUID
    }
    return null
  }

  validateUser (user) {
    let validateObject = {}
    // We will default to CNA if a type is not given
    validateObject = BaseUser.validateUser(user)

    return validateObject
  }

  async findUsersByOrgShortname (shortName, options = {}) {
    const org = await BaseOrgModel.findOne({ short_name: shortName }, null, options)
    return org.users
  }

  async isAdmin (username, orgShortName, options, isLegacyObject = false) {
    const baseOrgRepository = new BaseOrgRepository()
    const existingOrg = await baseOrgRepository.findOneByShortName(orgShortName)

    const user = await this.findOneByUsernameAndOrgShortname(username, orgShortName, options)
    if (!user) return false
    return existingOrg.admins.includes(user.UUID)
  }

  async isAdminOrSecretariat (orgShortName, username, requesterOrg, options = {}, isLegacyObject = false) {
    const baseOrgRepository = new BaseOrgRepository()
    const org = await baseOrgRepository.findOneByShortName(requesterOrg)
    if (await baseOrgRepository.isSecretariat(org) || await this.isAdmin(username, orgShortName, options, isLegacyObject)) {
      return true
    }
    return false
  }

  async getAllUsers (options = {}, returnLegacyFormat = false) {
    const UserRepository = require('./userRepository')
    const userRepo = new UserRepository()
    let pg
    if (returnLegacyFormat) {
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

  // Create a new user (BaseUser or RegistryUser)
  async createUser (orgShortName, incomingUser, options = {}, isLegacyObject = false) {
    const { deepRemoveEmpty } = require('../utils/utils')
    // TO-DO: org_UUID is not necessarily the shortname. Is this info lost during conversion?
    let legacyObjectRaw = null
    let registryObjectRaw = null
    let registryObject = null
    const legacyUserRepo = new UserRepository()
    const baseOrgRepository = new BaseOrgRepository()

    const sharedUUID = uuid.v4()
    incomingUser.UUID = sharedUUID

    if (isLegacyObject) {
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

    if (isLegacyObject) {
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
    return deepRemoveEmpty(rawRegistryUserJson)
  }

  async updateUser (username, orgShortname, incomingParameters, options = {}, isLegacyObject = false) {
    const { deepRemoveEmpty } = require('../utils/utils')
    const baseOrgRepository = new BaseOrgRepository()
    const legacyUserRepo = new UserRepository()
    const registryOrg = await baseOrgRepository.getOrgObject(orgShortname, false, options)
    const legacyUser = await legacyUserRepo.findOneByUserNameAndOrgUUID(username, registryOrg.UUID, null, options)
    const registryUser = await this.findOneByUsernameAndOrgShortname(username, orgShortname, options, false) // WE always want the registry user

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
      const orgUpdates = await baseOrgRepository.getOrgObject(orgShortname)
      orgUpdates.admins = [..._.get(orgUpdates, 'admins', []), registryUser.UUID]
      await orgUpdates.save({ options })
    }

    const initialRoles = legacyUser.authority?.active_roles ?? []
    const finalRoles = [...new Set([...initialRoles, ...rolesToAdd])].filter(role => !rolesToRemove.includes(role))
    registryUser.role = finalRoles[0] ?? ''
    _.set(legacyUser, 'authority.active_roles', finalRoles)

    if (incomingParameters?.org_short_name) {
      // Remove us from the old users Array
      const filteredUuids = registryOrg.users.filter(uuid => uuid !== registryUser.UUID)
      registryOrg.users = filteredUuids
      // Add us to the new org
      const newOrg = await baseOrgRepository.getOrgObject(incomingParameters.org_short_name)
      newOrg.users = [...newOrg.users, registryUser.UUID]

      if (registryUser.role.includes('ADMIN')) {
        newOrg.admins = [...newOrg.admins, registryUser.UUID]
      }

      legacyUser.org_UUID = newOrg.UUID
      await registryOrg.save({ options })
      await newOrg.save({ options })
    }

    await legacyUser.save({ options })
    await registryUser.save({ options })

    if (isLegacyObject) {
      const plainJavascriptLegacyUser = legacyUser.toObject()
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

  async resetSecret (username, orgShortName, options = {}, isLegacyObject = false) {
    const legacyUserRepo = new UserRepository()
    const baseOrgRepository = new BaseOrgRepository()

    const legOrgUUID = await baseOrgRepository.getOrgUUID(orgShortName, options, true)
    const legUser = await legacyUserRepo.findOneByUserNameAndOrgUUID(username, legOrgUUID, null, options)
    const regUser = await this.findOneByUsernameAndOrgShortname(username, orgShortName, options, false)

    const randomKey = cryptoRandomString({ length: getConstants().CRYPTO_RANDOM_STRING_LENGTH })
    const secret = await argon2.hash(randomKey)
    legUser.secret = secret
    regUser.secret = secret
    await legUser.save({ options })
    await regUser.save({ options })

    return randomKey
  }

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
        modified: registryUser?.modified ?? null
      }
    }
  }

  async getAllUsersByOrgShortname (orgShortname, options = {}, returnLegacyFormat = false) {
    const CONSTANTS = getConstants()
    const baseOrgRepository = new BaseOrgRepository()
    console.log('Repository is using model:', BaseOrgModel.modelName)
    console.log('Model is targeting collection:', BaseOrgModel.collection.name)
    const userRepository = new UserRepository()
    const org = await baseOrgRepository.findOneByShortName(orgShortname)
    const usersInOrg = org.toObject().users

    let agt = {}
    let pg
    if (returnLegacyFormat) {
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
