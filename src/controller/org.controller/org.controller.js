require('dotenv').config()
const mongoose = require('mongoose')
const logger = require('../../middleware/logger')
const getConstants = require('../../constants').getConstants
const errors = require('./error')
const error = new errors.OrgControllerError()
const validateUUID = require('uuid').validate

/**
 *  Get the details of all orgs
 *  Called by GET /api/registry/org, GET /api/org
 **/
async function getOrgs (req, res, next) {
  try {
    const session = await mongoose.startSession()
    const repo = req.ctx.repositories.getBaseOrgRepository()
    const CONSTANTS = getConstants()
    let returnValue

    // temporary measure to allow tests to work after fixing #920
    // tests required changing the global limit to force pagination
    if (req.TEST_PAGINATOR_LIMIT) {
      CONSTANTS.PAGINATOR_OPTIONS.limit = req.TEST_PAGINATOR_LIMIT
    }

    const options = CONSTANTS.PAGINATOR_OPTIONS
    options.sort = { short_name: 'asc' }
    options.page = req.ctx.query.page ? parseInt(req.ctx.query.page) : CONSTANTS.PAGINATOR_PAGE // if 'page' query parameter is not defined, set 'page' to the default page value

    try {
      returnValue = await repo.getAllOrgs(options, !req.useRegistry)
    } finally {
      await session.endSession()
    }

    logger.info({ uuid: req.ctx.uuid, message: 'The orgs were sent to the user.' })
    return res.status(200).json(returnValue)
  } catch (err) {
    next(err)
  }
}

/**
 * Get the details of a single org for the specified shortname/UUID
 * Called by GET /api/registry/org/{identifier}, GET /api/org/{identifier}
 **/
async function getOrg (req, res, next) {
  try {
    const session = await mongoose.startSession()
    const repo = req.ctx.repositories.getBaseOrgRepository()
    const requesterOrgShortName = req.ctx.org
    const identifier = req.ctx.params.identifier
    const identifierIsUUID = validateUUID(identifier)
    let returnValue

    try {
      session.startTransaction()
      const requesterOrg = await repo.findOneByShortName(requesterOrgShortName, { session }, !req.useRegistry)
      const requesterOrgIdentifier = identifierIsUUID ? requesterOrg.UUID : requesterOrgShortName
      const isSecretariat = await repo.isSecretariat(requesterOrg, { session }, !req.useRegistry)

      if (requesterOrgIdentifier !== identifier && !isSecretariat) {
        logger.info({ uuid: req.ctx.uuid, message: identifier + ' organization can only be viewed by the users of the same organization or the Secretariat.' })
        return res.status(403).json(error.notSameOrgOrSecretariat())
      }

      returnValue = await repo.getOrg(identifier, identifierIsUUID, { session }, !req.useRegistry)
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }
    if (!returnValue) { // an empty result can only happen if the requestor is the Secretariat
      logger.info({ uuid: req.ctx.uuid, message: identifier + ' organization does not exist.' })
      return res.status(404).json(error.orgDne(identifier, 'identifier', 'path'))
    }

    logger.info({ uuid: req.ctx.uuid, message: identifier + ' organization was sent to the user.', org: returnValue })
    return res.status(200).json(returnValue)
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
    // options.sort = { username: 'asc' }
    options.page = req.ctx.query.page ? parseInt(req.ctx.query.page) : CONSTANTS.PAGINATOR_PAGE // if 'page' query parameter is not defined, set 'page' to the default page value
    const shortName = req.ctx.org
    const orgShortName = req.ctx.params.shortname
    const orgRepo = req.ctx.repositories.getBaseOrgRepository()
    const userRepo = req.ctx.repositories.getBaseUserRepository()

    const orgUUID = await orgRepo.getOrgUUID(orgShortName)
    const isSecretariat = await orgRepo.isSecretariatByShortName(shortName)

    if (!orgUUID) {
      logger.info({ uuid: req.ctx.uuid, message: orgShortName + ' organization does not exist.' })
      return res.status(404).json(error.orgDnePathParam(orgShortName))
    }

    if (orgShortName !== shortName && !isSecretariat) {
      logger.info({ uuid: req.ctx.uuid, message: orgShortName + ' organization can only be viewed by the users of the same organization or the Secretariat.' })
      return res.status(403).json(error.notSameOrgOrSecretariat())
    }

    const payload = await userRepo.getAllUsersByOrgShortname(orgShortName, options, true)

    logger.info({ uuid: req.ctx.uuid, message: `The users of ${orgShortName} organization were sent to the user.` })
    return res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
}

/**
 *  Get the details of a single user for the specified username
 *  Called by GET /api/org/{shortname}/user/{username}
 **/
async function getUser (req, res, next) {
  try {
    const shortName = req.ctx.org
    const username = req.ctx.params.username
    const orgShortName = req.ctx.params.shortname

    const orgRepo = req.ctx.repositories.getBaseOrgRepository()
    const isSecretariat = await orgRepo.isSecretariatByShortName(shortName, {}, !req.useRegistry)

    if (orgShortName !== shortName && !isSecretariat) {
      logger.info({ uuid: req.ctx.uuid, message: shortName + ' organization can only be viewed by that organization\'s users or the Secretariat.' })
      return res.status(403).json(error.notSameOrgOrSecretariat())
    }

    const orgUUID = await orgRepo.getOrgUUID(orgShortName)
    if (!orgUUID) { // the org can only be non-existent if the requestor is the Secretariat
      logger.info({ uuid: req.ctx.uuid, message: orgShortName + ' organization does not exist.' })
      return res.status(404).json(error.orgDnePathParam(orgShortName))
    }

    const userRepo = req.ctx.repositories.getBaseUserRepository()
    // This is simple, we can just call our function
    const result = await userRepo.findOneByUsernameAndOrgShortname(username, orgShortName, {}, !req.useRegistry)

    if (!result) {
      logger.info({ uuid: req.ctx.uuid, message: username + ' does not exist.' })
      return res.status(404).json(error.userDne(username))
    }

    const rawResult = result.toObject()

    delete rawResult._id
    delete rawResult.__v
    delete rawResult.secret

    logger.info({ uuid: req.ctx.uuid, message: username + ' was sent to the user.', user: result })
    return res.status(200).json(rawResult)
  } catch (err) {
    next(err)
  }
}

/**
 * Get details on ID quota for an org with the specified org shortname
 * Called by GET /api/registry/org/{shortname}/id_quota, GET /api/org/{shortname}/id_quota
 **/
async function getOrgIdQuota (req, res, next) {
  try {
    const session = await mongoose.startSession()
    const orgRepo = req.ctx.repositories.getBaseOrgRepository()
    const requesterOrgShortName = req.ctx.org
    const shortName = req.ctx.params.shortname

    try {
      session.startTransaction()
      const requesterOrg = await orgRepo.findOneByShortName(requesterOrgShortName)
      const isSecretariat = await orgRepo.isSecretariat(requesterOrg, !req.useRegistry)

      if (requesterOrgShortName !== shortName && !isSecretariat) {
        logger.info({ uuid: req.ctx.uuid, message: shortName + ' organization id quota can only be viewed by the users of the same organization or the Secretariat.' })
        return res.status(403).json(error.notSameOrgOrSecretariat())
      }

      const org = await orgRepo.getOrg(shortName, false, { session }, !req.useRegistry)
      if (!org) { // a null org can only happen if the requestor is the Secretariat
        logger.info({ uuid: req.ctx.uuid, message: shortName + ' organization does not exist.' })
        return res.status(404).json(error.orgDnePathParam(shortName))
      }

      const returnPayload = await orgRepo.getOrgIdQuota(org, !req.useRegistry)
      logger.info({ uuid: req.ctx.uuid, message: 'The organization\'s id quota was returned to the user.', details: returnPayload })
      return res.status(200).json(returnPayload)
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }
  } catch (err) {
    next(err)
  }
}

async function registryCreateOrg (req, res, next) {
  try {
    const session = await mongoose.startSession()
    const repo = req.ctx.repositories.getBaseOrgRepository()
    const body = req.ctx.body
    let returnValue
    // Do not allow the user to pass in a UUID
    if (body?.uuid ?? null) {
      return res.status(400).json(error.uuidProvided('org'))
    }

    try {
      session.startTransaction()
      // Because Discriminators are used to handle the different types, mongoose automatically drops ALL fields that are not defined in EITHER the base or sub schema

      const result = repo.validateOrg(req.ctx.body, { session })
      if (!result.isValid) {
        logger.error(JSON.stringify({ uuid: req.ctx.uuid, message: 'CVE JSON schema validation FAILED.' }))
        await session.abortTransaction()
        if (!Array.isArray(body?.authority) || body?.authority.some(item => typeof item !== 'string')) {
          return res.status(400).json({ message: 'Parameters were invalid', details: [{ param: 'authority', msg: 'Parameter must be a one-dimensional array of strings' }] })
        }
        return res.status(400).json({ message: 'Parameters were invalid', errors: result.errors })
      }

      // Check to see if the org already exists
      if (await repo.orgExists(body.short_name, { session })) {
        logger.info({ uuid: req.ctx.uuid, message: body.short_name + ' organization was not created because it already exists.' })
        await session.abortTransaction()
        return res.status(400).json(error.orgExists(body.short_name))
      }

      // If we get here, we know we are good to create
      returnValue = await repo.createOrg(req.ctx.body, { session, upsert: true })
      await session.commitTransaction()
      logger.info({
        action: 'create_org',
        change: returnValue.short_name + ' organization was successfully created.',
        req_UUID: req.ctx.uuid,
        org_UUID: returnValue.UUID,
        org: returnValue
      })
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }

    return res.status(200).json({ message: returnValue.short_name + ' organization was successfully created.', created: returnValue })
  } catch (err) {
    next(err)
  }
}

/**
 *  Creates a new org only if the org doesn't exist for the specified shortname.
 *  If the org exists, we do not update the org.
 *  Called by POST /api/org/
 **/
async function createOrg (req, res, next) {
  try {
    const session = await mongoose.startSession()
    const repo = req.ctx.repositories.getBaseOrgRepository()
    const body = req.ctx.body
    let returnValue
    // Do not allow the user to pass in a UUID
    if ((body?.UUID ?? null) || (body?.uuid ?? null)) return res.status(400).json(error.uuidProvided('org'))

    try {
      session.startTransaction()
      if (await repo.orgExists(body?.short_name, { session }, true)) {
        logger.info({ uuid: req.ctx.uuid, message: body?.short_name + ' organization was not created because it already exists.' })
        await session.abortTransaction()
        return res.status(400).json(error.orgExists(body?.short_name))
      }
      returnValue = await repo.createOrg(req.ctx.body, { session, upsert: true }, true)

      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }

    const responseMessage = {
      message: body?.short_name + ' organization was successfully created.',
      created: returnValue
    }
    const payload = {
      action: 'create_org',
      change: body?.short_name + ' organization was successfully created.',
      req_UUID: req.ctx.uuid,
      org_UUID: returnValue.UUID,
      org: returnValue
    }

    // const userRepo = req.ctx.repositories.getUserRepository()
    // payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, payload.org_UUID)
    logger.info(JSON.stringify(payload))
    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

// update org for registry
// /api/registry/org/{shortname}
async function registryUpdateOrg (req, res, next) {
  const session = await mongoose.startSession()
  const shortNameUrlParameter = req.ctx.params.shortname
  let responseMessage
  const orgRepository = req.ctx.repositories.getBaseOrgRepository()

  // Get the query parameters as JSON
  // These are validated by the middleware in org/index.js
  const queryParametersJson = req.ctx.query

  // Try for network request
  try {
    // Try for database, if we were catching things more specifically, we could move to 1 try statement
    try {
      session.startTransaction()
      if (queryParametersJson['active_roles.add']) {
        if (!Array.isArray(queryParametersJson.active_roles?.add) || queryParametersJson.active_roles?.add.some(item => typeof item !== 'string')) {
          return res.status(400).json({ message: 'Parameters were invalid', details: [{ param: 'authority', msg: 'Parameter must be a one-dimensional array of strings' }] })
        }
      }

      if (queryParametersJson['active_roles.remove']) {
        if (!Array.isArray(queryParametersJson.active_roles?.remove) || queryParametersJson.active_roles?.remove.some(item => typeof item !== 'string')) {
          return res.status(400).json({ message: 'Parameters were invalid', details: [{ param: 'authority', msg: 'Parameter must be a one-dimensional array of strings' }] })
        }
      }

      if (!(await orgRepository.orgExists(shortNameUrlParameter, { session }))) {
        logger.info({ uuid: req.ctx.uuid, message: `Organization ${shortNameUrlParameter} not found.` })
        await session.abortTransaction()
        return res.status(404).json(error.orgDnePathParam(shortNameUrlParameter))
      }

      if (Object.hasOwn(queryParametersJson, 'new_short_name') && (await orgRepository.orgExists(queryParametersJson.new_short_name, { session }))) {
        await session.abortTransaction()
        return res.status(403).json(error.duplicateShortname(queryParametersJson.new_short_name))
      }

      const updatedOrg = await orgRepository.updateOrg(shortNameUrlParameter, queryParametersJson, { session })

      const userRepo = req.ctx.repositories.getUserRepository()
      responseMessage = { message: `${updatedOrg.short_name} organization was successfully updated.`, updated: updatedOrg } // Clarify message
      const payload = { action: 'update_org', change: `${updatedOrg.short_name} organization was successfully updated.`, org: updatedOrg }
      payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, updatedOrg.UUID, { session })
      payload.org_UUID = updatedOrg.UUID
      payload.req_UUID = req.ctx.uuid
      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }
    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

/**
 *  Updates an org only if the org exist for the specified shortname.
 *  If no org exists, we do not create the org.
 *  Called by PUT /api/org/{shortname}
 **/
async function updateOrg (req, res, next) {
  const shortNameUrlParameter = req.ctx.params.shortname
  const orgRepository = req.ctx.repositories.getBaseOrgRepository()

  const session = await mongoose.startSession()
  let responseMessage
  // Get the query parameters as JSON
  // These are validated by the middleware in org/index.js
  const queryParametersJson = req.ctx.query

  try {
    try {
      session.startTransaction()
      if (!(await orgRepository.orgExists(shortNameUrlParameter, { session }))) {
        logger.info({ uuid: req.ctx.uuid, message: `Organization ${shortNameUrlParameter} not found.` })
        return res.status(404).json(error.orgDnePathParam(shortNameUrlParameter))
      }

      if (Object.hasOwn(queryParametersJson, 'new_short_name') && (await orgRepository.orgExists(queryParametersJson.new_short_name, { session }))) {
        return res.status(403).json(error.duplicateShortname(queryParametersJson.new_short_name))
      }

      const updatedOrg = await orgRepository.updateOrg(shortNameUrlParameter, queryParametersJson, { session }, true)

      const userRepo = req.ctx.repositories.getBaseUserRepository()
      responseMessage = { message: `${updatedOrg.short_name} organization was successfully updated.`, updated: updatedOrg } // Clarify message
      const payload = { action: 'update_org', change: `${updatedOrg.short_name} organization was successfully updated.`, org: updatedOrg }
      payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, updatedOrg.UUID)
      payload.org_UUID = updatedOrg.UUID
      payload.req_UUID = req.ctx.uuid
      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }

    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

/**
 *  Creates a user only if the org exists and
 * the user does not exist for the specified shortname and username
 * Called by POST /api/org/{shortname}/user
 **/
async function createUser (req, res, next) {
  const session = await mongoose.startSession()
  try {
    const body = req.ctx.body
    const userRepo = req.ctx.repositories.getBaseUserRepository()
    const orgRepo = req.ctx.repositories.getBaseOrgRepository()
    const orgShortName = req.ctx.params.shortname
    let returnValue

    // Check to make sure Org Exists first
    const orgUUID = await orgRepo.getOrgUUID(orgShortName)
    if (!orgUUID) {
      logger.info({ uuid: req.ctx.uuid, message: 'The user could not be created because ' + orgShortName + ' organization does not exist.' })
      return res.status(404).json(error.orgDnePathParam(orgShortName))
    }

    // Do not allow the user to pass in a UUID
    if ((body?.UUID ?? null) || (body?.uuid ?? null)) {
      return res.status(400).json(error.uuidProvided('user'))
    }

    if ((body?.org_UUID ?? null) || (body?.org_uuid ?? null)) {
      return res.status(400).json(error.uuidProvided('org'))
    }

    try {
      session.startTransaction()
      if (req.useRegistry) {
        const result = await userRepo.validateUser(body)
        if (body?.role && typeof body?.role !== 'string') {
          return res.status(400).json({ message: 'Parameters were invalid', details: [{ param: 'role', msg: 'Parameter must be a string' }] })
        }
        if (!result.isValid) {
          logger.error(JSON.stringify({ uuid: req.ctx.uuid, message: 'User JSON schema validation FAILED.' }))
          await session.abortTransaction()
          return res.status(400).json({ message: 'Parameters were invalid', errors: result.errors })
        }
      } else {
        if (!body?.username || typeof body?.username !== 'string' || !body?.username.length > 0) {
          return res.status(400).json({ message: 'Parameters were invalid', details: [{ param: 'username', msg: 'Parameter must be a non empty string' }] })
        }
      }

      // Ask repo if user already exists
      if (await userRepo.orgHasUser(orgShortName, body?.username, { session }, !req.useRegistry)) {
        logger.info({ uuid: req.ctx.uuid, message: `${body?.username} user was not created because it already exists.` })
        await session.abortTransaction()
        return res.status(400).json(error.userExists(body?.username))
      }

      if (!await userRepo.isAdminOrSecretariat(orgShortName, req.ctx.user, req.ctx.org, { session }, !req.useRegistry)) {
        await session.abortTransaction()
        return res.status(403).json(error.notOrgAdminOrSecretariat()) // The Admin user must belong to the new user's organization
      }

      const users = await userRepo.findUsersByOrgShortname(orgShortName, { session })
      if (users.length >= 100) {
        await session.abortTransaction()
        return res.status(400).json(error.userLimitReached())
      }

      returnValue = await userRepo.createUser(orgShortName, body, { session, upsert: true }, !req.useRegistry)
      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }

    const responseMessage = {
      message: `${body?.username} was successfully created.`,
      created: returnValue
    }

    const payload = {
      action: 'create_user',
      change: `${body?.username} was successfully created.`,
      req_UUID: req.ctx.uuid,
      org_UUID: returnValue.org_UUID,
      user_UUID: returnValue.UUID,
      user: returnValue
    }

    logger.info(JSON.stringify(payload))
    return res.status(200).json(responseMessage)
  } catch (err) {
    next(err)
  }
}

/**
 *  Updates a user only if the user exist for the specified username.
 *  If no user exists, it does not create the user.
 *  Called by PUT /org/{shortname}/user/{username}
 **/
async function updateUser (req, res, next) {
  const session = await mongoose.startSession()

  try {
    session.startTransaction()

    const requesterShortName = req.ctx.org
    const requesterUsername = req.ctx.user
    const usernameParams = req.ctx.params.username
    const shortNameParams = req.ctx.params.shortname

    const userRepo = req.ctx.repositories.getBaseUserRepository()
    const orgRepo = req.ctx.repositories.getBaseOrgRepository()

    const queryParametersJson = req.ctx.query

    // Get requester UUID for later
    const requesterUUID = await userRepo.getUserUUID(requesterUsername, requesterShortName, { session }, !req.useRegistry)
    const targetUserUUID = await userRepo.getUserUUID(usernameParams, shortNameParams, { session }, !req.useRegistry)

    const isRequesterSecretariat = await orgRepo.isSecretariatByShortName(requesterShortName, { session })
    const isAdmin = await userRepo.isAdmin(requesterUsername, requesterShortName, { session })
    const targetOrgUUID = await orgRepo.getOrgUUID(shortNameParams, { session })

    // if (req.useRegistry) {
    //   if (body?.role && typeof body?.role !== 'string') {
    //     return res.status(400).json({ message: 'Parameters were invalid', details: [{ param: 'role', msg: 'Parameter must be a string' }] })
    //   }
    // }

    if (!targetOrgUUID) {
      logger.info({ uuid: req.ctx.uuid, message: `Target organization ${shortNameParams} does not exist.` })
      await session.abortTransaction()
      return res.status(404).json(error.orgDnePathParam(shortNameParams))
    }

    if (shortNameParams !== requesterShortName && !isRequesterSecretariat) {
      logger.info({ uuid: req.ctx.uuid, message: `${shortNameParams} organization data can only be modified by users of the same organization or the Secretariat.` })
      await session.abortTransaction()
      return res.status(403).json(error.notSameOrgOrSecretariat())
    }

    // Specific check for org_short_name (Secretariat only)
    if (queryParametersJson.org_short_name && !isRequesterSecretariat) {
      logger.info({ uuid: req.ctx.uuid, message: 'Only Secretariat can reassign user organization.' })
      await session.abortTransaction()
      return res.status(403).json(error.notAllowedToChangeOrganization())
    }

    if (!isRequesterSecretariat && !isAdmin) {
      if (targetUserUUID !== requesterUUID) {
        if (!targetUserUUID) {
          logger.info({ uuid: req.ctx.uuid, message: 'User DNE' })
          await session.abortTransaction()
          return res.status(404).json(error.userDne(usernameParams))
        }
        logger.info({ uuid: req.ctx.uuid, message: 'Not same user or secretariat' })
        await session.abortTransaction()
        return res.status(403).json(error.notSameUserOrSecretariat())
      }
    }

    const newOrgShortNameToMoveTo = queryParametersJson.org_short_name

    if (newOrgShortNameToMoveTo) {
      if (newOrgShortNameToMoveTo === shortNameParams) {
        logger.info({ uuid: req.ctx.uuid, message: `User ${usernameParams} is already in organization ${newOrgShortNameToMoveTo}.` })
        await session.abortTransaction()
        return res.status(403).json(error.alreadyInOrg(newOrgShortNameToMoveTo, usernameParams))
      }

      const newTargetRegistryOrgUUID = await orgRepo.getOrgUUID(newOrgShortNameToMoveTo, { session })

      if (!newTargetRegistryOrgUUID) {
        logger.info({ uuid: req.ctx.uuid, message: `New target organization ${newOrgShortNameToMoveTo} does not exist.` })
        await session.abortTransaction()
        return res.status(404).json(error.orgDne(newOrgShortNameToMoveTo, 'org_short_name', 'query'))
      }
    }

    if (queryParametersJson.active) {
      if (requesterUUID === targetUserUUID) {
        await session.abortTransaction()
        return res.status(403).json(error.notOrgAdminOrSecretariatUpdate())
      }
    }

    if (!targetUserUUID) {
      logger.info({ uuid: req.ctx.uuid, message: 'User DNE' })
      await session.abortTransaction()
      return res.status(404).json(error.userDne(usernameParams))
    }

    if (!await userRepo.orgHasUserByUUID(shortNameParams, targetUserUUID, { session })) {
      logger.info({ uuid: req.ctx.uuid, message: `User ${usernameParams} does not exist for ${shortNameParams} organization.` })
      await session.abortTransaction()
      return res.status(404).json(error.userDne(usernameParams))
    }

    // General permission check for fields requiring admin/secretariat
    if ((queryParametersJson.new_username || queryParametersJson['active_roles.remove'] || queryParametersJson['active_roles.add'])) {
      if (!isRequesterSecretariat && !isAdmin) {
        logger.info({ uuid: req.ctx.uuid, message: `User ${requesterUsername} (not Admin/Secretariat) trying to modify admin-only fields.` })
        await session.abortTransaction()
        return res.status(403).json(error.notOrgAdminOrSecretariatUpdate())
      }
    }

    // If we get here, we have the permissions needed to change a username. But we need to make sure the name that they want to change it to DNE
    if (queryParametersJson.new_username) {
      const unameToCheck = await userRepo.findOneByUsernameAndOrgShortname(queryParametersJson.new_username, shortNameParams, { session })
      if (unameToCheck) {
        logger.info({ uuid: req.ctx.uuid, message: queryParametersJson.new_username + ' was not created because it already exists.' })
        await session.abortTransaction()
        return res.status(403).json(error.duplicateUsername(queryParametersJson.new_username, shortNameParams))
      }
    }

    // This is a special case, and needs to be handled in the controller, and not in the repository
    const rolesFromQuery = queryParametersJson['active_roles.remove'] ?? []
    const removeRolesCollector = []
    const processRoleRemoval = (r) => {
      const roleToRemove = r.toUpperCase()
      removeRolesCollector.push(roleToRemove)
    }
    rolesFromQuery.forEach(processRoleRemoval)

    // Check to make sure we are NOT self demoting
    if (removeRolesCollector.includes('ADMIN')) {
      if (requesterUUID === targetUserUUID) {
        await session.abortTransaction()
        return res.status(403).json(error.notAllowedToSelfDemote())
      }
    }

    const payload = await userRepo.updateUser(usernameParams, shortNameParams, queryParametersJson, { session }, !req.useRegistry)
    await session.commitTransaction()
    return res.status(200).json({ message: `${usernameParams} was successfully updated.`, updated: payload })
  } catch (err) {
    if (session && session.inTransaction()) {
      await session.abortTransaction()
    }
    next(err)
  } finally {
    if (session && session.id) { // Check if session is still valid before trying to end
      try {
        await session.endSession()
      } catch (sessionEndError) {
        logger.error({ uuid: req.ctx.uuid, message: 'Error ending session in finally block', error: sessionEndError })
      }
    }
  }
}

/**
 * Resets API secret for specified user.
 * Called by PUT /org/{shortname}/user/{username}/reset_secret, PUT /registry/org/{shortname}/user/{username}/reset_secret
 */
async function resetSecret (req, res, next) {
  try {
    const session = await mongoose.startSession()
    const requesterOrgShortName = req.ctx.org
    const requesterUsername = req.ctx.user
    const targetOrgShortName = req.ctx.params.shortname
    const targetUsername = req.ctx.params.username

    const orgRepo = req.ctx.repositories.getBaseOrgRepository()
    const userRepo = req.ctx.repositories.getBaseUserRepository()

    try {
      session.startTransaction()

      // Check if target org exists
      const targetOrgUUID = await orgRepo.getOrgUUID(targetOrgShortName, { session }, !req.useRegistry)
      if (!targetOrgUUID) {
        logger.info({ uuid: req.ctx.uuid, message: 'Org DNE' })
        await session.abortTransaction()
        return res.status(404).json(error.orgDnePathParam(targetOrgShortName))
      }

      // Check if target user exists in target org
      const targetUserUUID = await userRepo.getUserUUID(targetUsername, targetOrgShortName, { session }, !req.useRegistry)
      if (!targetUserUUID) {
        logger.info({ uuid: req.ctx.uuid, message: 'User DNE' })
        await session.abortTransaction()
        return res.status(404).json(error.userDne(targetUsername))
      }

      const requesterUserUUID = await userRepo.getUserUUID(requesterUsername, requesterOrgShortName, { session }, !req.useRegistry)

      const isRequesterSecretariat = await orgRepo.isSecretariatByShortName(requesterOrgShortName, { session })

      if (!isRequesterSecretariat) {
        // If they are in the same organization, they must be the target user themselves OR an admin of the target org.

        // 1. WE are not the same user
        if (requesterUserUUID !== targetUserUUID) {
          // Check to see if we are the admin of the target organization
          const isAdminOfTargetOrg = await userRepo.isAdmin(requesterUsername, targetOrgShortName, { session })
          // The tests say we have to check the org next:
          if (requesterOrgShortName !== targetOrgShortName && !isAdminOfTargetOrg) {
            logger.info({ uuid: req.ctx.uuid, message: 'The api secret can only be reset by the Secretariat, an Org admin or if the requester is the user.' })
            await session.abortTransaction()
            return res.status(403).json(error.notSameOrgOrSecretariat())
          }

          if (!isAdminOfTargetOrg) {
            logger.info({ uuid: req.ctx.uuid, message: 'The api secret can only be reset by the Secretariat, an Org admin or if the requester is the user.' })
            await session.abortTransaction()
            return res.status(403).json(error.notSameUserOrSecretariat())
          }
        }
      }

      const updatedSecret = await userRepo.resetSecret(targetUsername, targetOrgShortName, { session }, !req.useRegistry)

      logger.info({ uuid: req.ctx.uuid, message: `The API secret was successfully reset and sent to ${targetUsername}` })
      const payload = {
        action: 'reset_userAPIkey',
        change: 'API secret was successfully reset.',
        req_UUID: req.ctx.uuid,
        org_UUID: targetOrgUUID
      }
      payload.user_UUID = targetUserUUID
      logger.info(JSON.stringify(payload))
      await session.commitTransaction()
      return res.status(200).json({ 'API-secret': updatedSecret })
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }
  } catch (err) {
    next(err)
  }
}

module.exports = {
  ORG_ALL: getOrgs,
  ORG_SINGLE: getOrg,
  ORG_CREATE_SINGLE: createOrg,
  ORG_UPDATE_SINGLE: updateOrg,
  USER_ALL: getUsers,
  ORG_ID_QUOTA: getOrgIdQuota,
  USER_SINGLE: getUser,
  USER_CREATE_SINGLE: createUser,
  USER_UPDATE_SINGLE: updateUser,
  USER_RESET_SECRET: resetSecret,
  REGISTRY_CREATE_ORG: registryCreateOrg,
  REGISTRY_UPDATE_ORG: registryUpdateOrg
}
