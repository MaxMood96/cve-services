const argon2 = require('argon2')
const uuid = require('uuid')
const logger = require('../../middleware/logger')
const { getConstants } = require('../../constants')
const RegistryOrg = require('../../model/registry-org')
const RegistryUser = require('../../model/registry-user')
const errors = require('./error')
const cryptoRandomString = require('crypto-random-string')
const error = new errors.RegistryOrgControllerError()
const validateUUID = require('uuid').validate

async function getAllOrgs (req, res, next) {
  try {
    const CONSTANTS = getConstants()

    // temporary measure to allow tests to work after fixing #920
    // tests required changing the global limit to force pagination
    if (req.TEST_PAGINATOR_LIMIT) {
      CONSTANTS.PAGINATOR_OPTIONS.limit = req.TEST_PAGINATOR_LIMIT
    }

    const options = CONSTANTS.PAGINATOR_OPTIONS
    options.sort = { short_name: 'asc' }
    options.page = req.ctx.query.page ? parseInt(req.ctx.query.page) : CONSTANTS.PAGINATOR_PAGE // if 'page' query parameter is not defined, set 'page' to the default page value
    const repo = req.ctx.repositories.getRegistryOrgRepository()
    const agt = setAggregateOrgObj({})
    const pg = await repo.aggregatePaginate(agt, options)

    await RegistryOrg.populateOverseesAndReportsTo(pg.itemsList)
    await RegistryUser.populateUsers(pg.itemsList)
    await RegistryUser.populateAdditionalContactUsers(pg.itemsList)
    await RegistryUser.populateAdmins(pg.itemsList)
    // Update UUIDS to objects

    const payload = { orgs: pg.itemsList }

    if (pg.itemCount >= CONSTANTS.PAGINATOR_OPTIONS.limit) {
      payload.totalCount = pg.itemCount
      payload.itemsPerPage = pg.itemsPerPage
      payload.pageCount = pg.pageCount
      payload.currentPage = pg.currentPage
      payload.prevPage = pg.prevPage
      payload.nextPage = pg.nextPage
    }

    logger.info({ uuid: req.ctx.uuid, message: 'The org information was sent to the secretariat user.' })
    return res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
}

async function getOrg (req, res, next) {
  try {
    const repo = req.ctx.repositories.getRegistryOrgRepository()
    // User passed in parameter to filter for
    const identifier = req.ctx.params.identifier
    const orgShortName = req.ctx.org
    const isSecretariat = await repo.isSecretariat(orgShortName)
    const org = await repo.findOneByShortName(orgShortName)
    let requestingUserOrgIdentifier = orgShortName
    let agt = setAggregateOrgObj({ short_name: identifier })

    if (validateUUID(identifier)) {
      requestingUserOrgIdentifier = org.UUID
      agt = setAggregateOrgObj({ UUID: identifier })
    }

    if (requestingUserOrgIdentifier !== identifier && !isSecretariat) {
      logger.info({ uuid: req.ctx.uuid, message: identifier + ' organization can only be viewed by the users of the same organization or the Secretariat.' })
      return res.status(403).json(error.notSameOrgOrSecretariat())
    }

    let result = await repo.aggregate(agt)
    result = result.length > 0 ? result[0] : null
    // TODO: We need real error messages here pls and thanks

    if (!result) {
      logger.info({ uuid: req.ctx.uuid, message: identifier + ' organization does not exist.' })
      return res.status(404).json(error.orgDne(identifier, 'identifier', 'path'))
    }

    logger.info({ uuid: req.ctx.uuid, message: identifier + ' org was sent to the user.', org: result })
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

async function createOrg (req, res, next) {
  try {
    const CONSTANTS = getConstants()
    const userRepo = req.ctx.repositories.getRegistryUserRepository()
    const registryOrgRepo = req.ctx.repositories.getRegistryOrgRepository()
    const body = req.ctx.body

    // Short circuit if UUID provided
    const bodyKeys = Object.keys(body).map(k => k.toLowerCase())
    if (bodyKeys.includes('uuid')) {
      return res.status(400).json(error.uuidProvided('org'))
    }

    const newOrg = new RegistryOrg()
    bodyKeys.forEach(k => {
      if (k === 'long_name') {
        newOrg.long_name = body[k]
      } else if (k === 'short_name') {
        newOrg.short_name = body[k]
      } else if (k === 'aliases') {
        newOrg.aliases = [...new Set(body[k])]
      } else if (k === 'cve_program_org_function') {
        newOrg.cve_program_org_function = body[k]
      } else if (k === 'authority') {
        if ('active_roles' in body[k]) {
          newOrg.authority.active_roles = [...new Set(body[k].active_roles)]
        }
      } else if (k === 'reports_to') {
        // TODO: org check logic?
      } else if (k === 'oversees') {
        // TODO: org check logic?
      } else if (k === 'root_or_tlr') {
        newOrg.root_or_tlr = body[k]
      } else if (k === 'users') {
        // TODO: users logic?
      } else if (k === 'charter_or_scope') {
        newOrg.charter_or_scope = body[k]
      } else if (k === 'disclosure_policy') {
        newOrg.disclosure_policy = body[k]
      } else if (k === 'product_list') {
        newOrg.product_list = body[k]
      } else if (k === 'soft_quota') {
        newOrg.soft_quota = body[k]
      } else if (k === 'hard_quota') {
        newOrg.hard_quota = body[k]
      } else if (k === 'contact_info') {
        const { additionalContactUsers, admins, ...contactInfo } = body[k]
        newOrg.contact_info = {
          additional_contact_users: [...(additionalContactUsers || [])],
          poc: '',
          poc_email: '',
          poc_phone: '',
          admins: [...(admins || [])],
          org_email: '',
          website: '',
          ...contactInfo
        }
      }
    })

    const doesExist = await registryOrgRepo.findOneByShortName(newOrg.short_name)
    if (doesExist) {
      logger.info({ uuid: req.ctx.uuid, message: newOrg.short_name + ' organization was not created because it already exists.' })
      return res.status(400).json(error.orgExists(newOrg.short_name))
    }

    if (newOrg.reports_to === undefined) {
      // TODO: This may need to be set to mitre, will ask the awg
      newOrg.reports_to = null
    }
    if (newOrg.root_or_tlr === undefined) {
      newOrg.root_or_tlr = false
    }
    if (newOrg.soft_quota === undefined) { // set to default quota if none is specified
      newOrg.soft_quota = CONSTANTS.DEFAULT_ID_QUOTA
    }
    if (newOrg.hard_quota === undefined) { // set to default quota if none is specified
      newOrg.hard_quota = CONSTANTS.DEFAULT_ID_QUOTA
    }
    if (newOrg.authority.active_roles.length === 1 && newOrg.authority.active_roles[0] === 'ADP') { // ADPs have quota of 0
      newOrg.soft_quota = 0
      newOrg.hard_quota = 0
    }

    newOrg.in_use = false
    newOrg.UUID = uuid.v4()

    await registryOrgRepo.updateByUUID(newOrg.UUID, newOrg, { upsert: true })
    const agt = setAggregateOrgObj({ UUID: newOrg.UUID })
    let result = await registryOrgRepo.aggregate(agt)
    result = result.length > 0 ? result[0] : null

    const payload = {
      action: 'create_registry_org',
      change: result.short_name + ' was successfully created.',
      req_UUID: req.ctx.uuid,
      org_UUID: await registryOrgRepo.getOrgUUID(req.ctx.org),
      org: result
    }
    payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, payload.org_UUID)
    logger.info(JSON.stringify(payload))

    const responseMessage = {
      message: result.short_name + ' was successfully created.',
      created: result
    }
    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

async function updateOrg (req, res, next) {
  try {
    const shortName = req.ctx.params.shortname
    const userRepo = req.ctx.repositories.getRegistryUserRepository()
    const registryOrgRepo = req.ctx.repositories.getRegistryOrgRepository()

    const org = await registryOrgRepo.findOneByShortName(shortName)
    if (!org) {
      logger.info({ uuid: req.ctx.uuid, message: shortName + ' organization could not be updated in MongoDB because it does not exist.' })
      return res.status(404).json(error.orgDnePathParam(shortName))
    }

    const orgUUID = await registryOrgRepo.getOrgUUID(shortName)

    const newOrg = new RegistryOrg()
    newOrg.contact_info = { ...org.contact_info }

    for (const k in req.ctx.query) {
      const key = k.toLowerCase()

      if (key === 'long_name') {
        newOrg.long_name = req.ctx.query.long_name
      } else if (key === 'short_name') {
        newOrg.short_name = req.ctx.query.short_name
      } else if (key === 'aliases') {
        // TODO: handle aliases
      } else if (key === 'cve_program_org_function') {
        newOrg.cve_program_org_function = req.ctx.query.cve_program_org_function
        // TODO: validate against enum?
      } else if (key === 'authority') {
        // TODO: handle active_roles
      } else if (key === 'reports_to') {
        // TODO: validate org
      } else if (key === 'oversees') {
        // TODO: validate orgs
      } else if (key === 'root_or_tlr') {
        newOrg.root_or_tlr = req.ctx.query.root_or_tlr
      } else if (key === 'users') {
        // TODO: validate users
      } else if (key === 'charter_or_scope') {
        newOrg.charter_or_scope = req.ctx.query.charter_or_scope
      } else if (key === 'disclosure_policy') {
        newOrg.disclosure_policy = req.ctx.query.disclosure_policy
      } else if (key === 'product_list') {
        newOrg.product_list = req.ctx.query.product_list
      } else if (key === 'soft_quota') {
        newOrg.soft_quota = req.ctx.query.soft_quota
      } else if (key === 'hard_quota') {
        newOrg.hard_quota = req.ctx.query.hard_quota
      } else if (key === 'contact_info.additional_contact_users') {
        // TODO: validate users
      } else if (key === 'contact_info.poc') {
        newOrg.contact_info.poc = req.ctx.query['contact_info.poc']
      } else if (key === 'contact_info.poc_email') {
        newOrg.contact_info.poc_email = req.ctx.query['contact_info.poc_email']
      } else if (key === 'contact_info.poc_phone') {
        newOrg.contact_info.poc_phone = req.ctx.query['contact_info.poc_phone']
      } else if (key === 'contact_info.admins') {
        // TODO: validate admins
      } else if (key === 'contact_info.org_email') {
        newOrg.contact_info.org_email = req.ctx.query['contact_info.org_email']
      } else if (key === 'contact_info.website') {
        newOrg.contact_info.website = req.ctx.query['contact_info.website']
      }
    }

    await registryOrgRepo.updateByUUID(orgUUID, newOrg)
    const agt = setAggregateOrgObj({ UUID: orgUUID })
    let result = await registryOrgRepo.aggregate(agt)
    result = result.length > 0 ? result[0] : null

    const payload = {
      action: 'update_registry_org',
      change: result.short_name + ' was successfully updated.',
      req_UUID: req.ctx.uuid,
      org_UUID: await registryOrgRepo.getOrgUUID(req.ctx.org),
      user: result
    }
    payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, payload.org_UUID)
    logger.info(JSON.stringify(payload))

    let msgStr = ''
    if (Object.keys(req.ctx.query).length > 0) {
      msgStr = result.short_name + ' was successfully updated.'
    } else {
      msgStr = 'No updates were specified for ' + result.short_name + '.'
    }
    const responseMessage = {
      message: msgStr,
      updated: result
    }

    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

async function deleteOrg (req, res, next) {
  try {
    const userRepo = req.ctx.repositories.getUserRepository()
    const orgRepo = req.ctx.repositories.getOrgRepository()
    const registryOrgRepo = req.ctx.repositories.getRegistryOrgRepository()
    const orgUUID = req.ctx.params.identifier

    const org = await registryOrgRepo.findOneByUUID(orgUUID)

    await registryOrgRepo.deleteByUUID(orgUUID)

    const payload = {
      action: 'delete_registry_org',
      change: org.short_name + ' was successfully deleted.',
      req_UUID: req.ctx.uuid,
      org_UUID: await orgRepo.getOrgUUID(req.ctx.org)
    }
    payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, payload.org_UUID)
    logger.info(JSON.stringify(payload))

    const responseMessage = {
      message: org.short_name + ' was successfully deleted.'
    }

    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

/**
 *  Get the details of all users from an org given the specified shortname
 *  Called by GET /api/org/{shortname}/users
 **/
async function getUsers (req, res, next) {
  try {
    const CONSTANTS = getConstants()

    // temporary measure to allow tests to work after fixing #920
    // tests required changing the global limit to force pagination
    if (req.TEST_PAGINATOR_LIMIT) {
      CONSTANTS.PAGINATOR_OPTIONS.limit = req.TEST_PAGINATOR_LIMIT
    }

    const options = CONSTANTS.PAGINATOR_OPTIONS
    options.sort = { username: 'asc' }
    options.page = req.ctx.query.page ? parseInt(req.ctx.query.page) : CONSTANTS.PAGINATOR_PAGE // if 'page' query parameter is not defined, set 'page' to the default page value
    const shortName = req.ctx.org
    const orgShortName = req.ctx.params.shortname
    const orgRepo = req.ctx.repositories.getRegistryOrgRepository()
    const userRepo = req.ctx.repositories.getRegistryUserRepository()
    const orgUUID = await orgRepo.getOrgUUID(orgShortName)
    const isSecretariat = await orgRepo.isSecretariat(shortName)

    if (!orgUUID) {
      logger.info({ uuid: req.ctx.uuid, message: orgShortName + ' organization does not exist.' })
      return res.status(404).json(error.orgDnePathParam(orgShortName))
    }

    if (orgShortName !== shortName && !isSecretariat) {
      logger.info({ uuid: req.ctx.uuid, message: orgShortName + ' organization can only be viewed by the users of the same organization or the Secretariat.' })
      return res.status(403).json(error.notSameOrgOrSecretariat())
    }

    const agt = setAggregateUserObj({ 'org_affiliations.org_id': orgUUID })
    const pg = await userRepo.aggregatePaginate(agt, options)
    const payload = { users: pg.itemsList }

    if (pg.itemCount >= CONSTANTS.PAGINATOR_OPTIONS.limit) {
      payload.totalCount = pg.itemCount
      payload.itemsPerPage = pg.itemsPerPage
      payload.pageCount = pg.pageCount
      payload.currentPage = pg.currentPage
      payload.prevPage = pg.prevPage
      payload.nextPage = pg.nextPage
    }

    logger.info({ uuid: req.ctx.uuid, message: `The users of ${orgShortName} organization were sent to the user.` })
    return res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
}

async function createUserByOrg (req, res, next) {
  try {
    const requesterUsername = req.ctx.user
    const requesterShortName = req.ctx.org
    const shortName = req.ctx.params.shortname

    const registryUserRepo = req.ctx.repositories.getRegistryUserRepository()
    const registryOrgRepo = req.ctx.repositories.getRegistryOrgRepository()
    const orgUUID = await registryOrgRepo.getOrgUUID(shortName)
    const requesterOrgUUID = await registryOrgRepo.getOrgUUID(requesterShortName)
    const body = req.ctx.body

    const isSecretariat = await registryOrgRepo.isSecretariat(requesterShortName)
    const isAdmin = await registryUserRepo.isAdmin(requesterUsername, requesterShortName)

    if (!isSecretariat && !isAdmin) { // may be redundant after validation check is implemented
      return res.status(403).json(error.notOrgAdminOrSecretariat()) // User must be secretariat or an admin
    }
    if (!orgUUID) {
      return res.status(404).json(error.orgDnePathParam(shortName)) // Org must exist
    }
    if (!isSecretariat) { // Admins can only create user within the same org
      if (orgUUID !== requesterOrgUUID) {
        return res.status(403).json(error.notOrgAdminOrSecretariat()) // The Admin user must belong to the new user's organization
      }
    }

    const username = body.user_id || body.username
    if (!username) {
      return res.status(400).json({ message: 'user_id is required' })
    }
    const existingUser = await registryUserRepo.findOneByUserNameAndOrgUUID(username, orgUUID)
    if (existingUser) {
      return res.status(400).json(error.userExists(username))
    }

    const bodyKeys = Object.keys(body).map(k => k.toLowerCase())
    if (bodyKeys.includes('uuid')) {
      return res.status(400).json(error.uuidProvided('user'))
    }

    // Creating a new user under specific org
    const newUser = new RegistryUser()
    bodyKeys.forEach(k => {
      if (k === 'user_id' || k === 'username') {
        newUser.user_id = body[k]
      } else if (k === 'name') {
        newUser.name = {
          first: '',
          last: '',
          middle: '',
          suffix: '',
          ...body.name
        }
      } else if (k === 'org_affiliations') {
        newUser.org_affiliations = body[k].map(item => {
          const {
            orgId = '',
            email = '',
            phone = '',
            ...rest
          } = item

          return {
            org_id: orgId,
            email,
            phone,
            ...rest
          }
        })
      } else if (k === 'cve_program_org_membership') {
        newUser.cve_program_org_membership = body[k].map(item => {
          const {
            programOrg = '',
            roles = [],

            status = false,
            ...rest
          } = item

          return {
            program_org: programOrg,
            roles,
            status,
            ...rest
          }
        })
      }
    })

    newUser.UUID = uuid.v4()

    const randomKey = cryptoRandomString({ length: getConstants().CRYPTO_RANDOM_STRING_LENGTH })
    newUser.secret = await argon2.hash(randomKey)
    newUser.last_active = null
    newUser.deactivation_date = null

    await registryUserRepo.updateByUserNameAndOrgUUID(newUser.user_id, orgUUID, newUser, { upsert: true })
    await registryUserRepo.addOrgToUserAffiliation(newUser.UUID, orgUUID)
    await registryOrgRepo.addUserToOrgList(orgUUID, newUser.UUID, body.authority?.active_roles ? [...new Set(body.authority.active_roles)].includes('ADMIN') : false, { upsert: true })

    const agt = setAggregateUserObj({ UUID: newUser.UUID })
    let result = await registryUserRepo.aggregate(agt)
    result = result.length > 0 ? result[0] : null

    const payload = {
      action: 'create_registry_user',
      change: result.user_id + ' was successfully created.',
      req_UUID: req.ctx.uuid,
      org_UUID: orgUUID,
      user: result
    }
    payload.user_UUID = await registryUserRepo.getUserUUID(req.ctx.user, orgUUID)
    logger.info(JSON.stringify(payload))

    result.secret = randomKey
    const responseMessage = {
      message: result.user_id + ' was successfully created.',
      created: result
    }

    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

function setAggregateUserObj (query) {
  return [
    {
      $match: query
    },
    {
      $project: {
        _id: false,
        UUID: true,
        user_id: true,
        name: true,
        org_affiliations: true,
        cve_program_org_membership: true,
        created: true,
        created_by: true,
        last_updated: true,
        deactivation_date: true,
        last_active: true
      }
    }
  ]
}

function setAggregateOrgObj (query) {
  return [
    {
      $match: query
    },
    {
      $project: {
        _id: false,
        UUID: true,
        long_name: true,
        short_name: true,
        aliases: true,
        cve_program_org_function: true,
        authority: true,
        reports_to: true,
        oversees: true,
        root_or_tlr: true,
        users: true,
        charter_or_scope: true,
        disclosure_policy: true,
        product_list: true,
        soft_quota: true,
        hard_quota: true,
        contact_info: true,
        in_use: true,
        created: true,
        last_updated: true
      }
    }
  ]
}

module.exports = {
  ALL_ORGS: getAllOrgs,
  SINGLE_ORG: getOrg,
  CREATE_ORG: createOrg,
  UPDATE_ORG: updateOrg,
  DELETE_ORG: deleteOrg,
  USER_ALL: getUsers,
  USER_CREATE_SINGLE: createUserByOrg
}
