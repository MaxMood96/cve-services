const argon2 = require('argon2')
const cryptoRandomString = require('crypto-random-string')
const uuid = require('uuid')
const logger = require('../../middleware/logger')
const { getConstants } = require('../../constants')
const RegistryUser = require('../../model/registry-user')
const RegistryOrg = require('../../model/registry-org')
const errors = require('../user.controller/error')
const error = new errors.UserControllerError()

async function getAllUsers (req, res, next) {
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
    const repo = req.ctx.repositories.getRegistryUserRepository()

    const agt = setAggregateUserObj({})
    const pg = await repo.aggregatePaginate(agt, options)

    await RegistryOrg.populateOrgAffiliations(pg.itemsList)
    await RegistryOrg.populateCVEProgramOrgMembership(pg.itemsList)

    const payload = { users: pg.itemsList }

    if (pg.itemCount >= CONSTANTS.PAGINATOR_OPTIONS.limit) {
      payload.totalCount = pg.itemCount
      payload.itemsPerPage = pg.itemsPerPage
      payload.pageCount = pg.pageCount
      payload.currentPage = pg.currentPage
      payload.prevPage = pg.prevPage
      payload.nextPage = pg.nextPage
    }

    logger.info({ uuid: req.ctx.uuid, message: 'The user information was sent to the secretariat user.' })
    return res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
}

async function getUser (req, res, next) {
  try {
    const repo = req.ctx.repositories.getRegistryUserRepository()
    const identifier = req.ctx.params.identifier
    const agt = setAggregateUserObj({ UUID: identifier })
    let result = await repo.aggregate(agt)
    result = result.length > 0 ? result[0] : null

    logger.info({ uuid: req.ctx.uuid, message: identifier + ' user was sent to the user.', user: result })
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

async function createUser (req, res, next) {
  try {
    // const requesterUsername = req.ctx.user
    // const requesterShortName = req.ctx.org
    const orgRepo = req.ctx.repositories.getOrgRepository()
    const userRepo = req.ctx.repositories.getUserRepository()
    const registryUserRepo = req.ctx.repositories.getRegistryUserRepository()
    const body = req.ctx.body

    // Short circuit if UUID provided
    const bodyKeys = Object.keys(body).map((k) => k.toLowerCase())
    if (bodyKeys.includes('uuid')) {
      return res.status(400).json(error.uuidProvided('user'))
    }

    // TODO: check if affiliated orgs and program orgs exist, and if their membership limit is reached

    const newUser = new RegistryUser()
    Object.keys(body).map(k => k.toLowerCase()).forEach(k => {
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
        // TODO: dedupe
      } else if (k === 'cve_program_org_membership') {
        // TODO: dedupe
      }
    })

    // TODO: check that requesting user is admin of org for new user

    newUser.UUID = uuid.v4()
    const randomKey = cryptoRandomString({ length: getConstants().CRYPTO_RANDOM_STRING_LENGTH })
    newUser.secret = await argon2.hash(randomKey)
    newUser.last_active = null
    newUser.deactivation_date = null

    await registryUserRepo.updateByUUID(newUser.UUID, newUser, { upsert: true })
    const agt = setAggregateUserObj({ UUID: newUser.UUID })
    let result = await registryUserRepo.aggregate(agt)
    result = result.length > 0 ? result[0] : null

    const payload = {
      action: 'create_registry_user',
      change: result.user_id + ' was successfully created.',
      req_UUID: req.ctx.uuid,
      org_UUID: await orgRepo.getOrgUUID(req.ctx.org),
      user: result
    }
    payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, payload.org_UUID)
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

async function updateUser (req, res, next) {
  try {
    // const username = req.ctx.params.username
    // const shortName = req.ctx.params.shortname
    const userUUID = req.ctx.params.identifier
    const userRepo = req.ctx.repositories.getUserRepository()
    const orgRepo = req.ctx.repositories.getOrgRepository()
    const registryUserRepo = req.ctx.repositories.getRegistryUserRepository()
    // const orgUUID = await orgRepo.getOrgUUID(shortName)
    // Check if requester is Admin of the designated user's org

    const user = await registryUserRepo.findOneByUUID(userUUID)
    const newUser = new RegistryUser()

    // Sets the name values to what currently exists in the database, this ensures data is retained during partial name updates
    newUser.name.first = user.name.first
    newUser.name.last = user.name.last
    newUser.name.middle = user.name.middle
    newUser.name.suffix = user.name.suffix

    // TODO: check permissions
    // Check to ensure that the user has the right permissions to edit the fields tha they are requesting to edit, and fail fast if they do not.
    // if (Object.keys(req.ctx.query).length > 0 && Object.keys(req.ctx.query).some((key) => { return queryParameterPermissions[key] }) && !(isAdmin || isSecretariat)) {
    // logger.info({ uuid: req.ctx.uuid, message: 'The user could not be updated because ' + requesterUsername + ' user is not Org Admin or Secretariat to modify these fields.' })
    // return res.status(403).json(error.notOrgAdminOrSecretariatUpdate())
    // }

    for (const k in req.ctx.query) {
      const key = k.toLowerCase()

      if (key === 'new_user_id') {
        newUser.user_id = req.ctx.query.new_user_id
      } else if (key === 'name.first') {
        newUser.name.first = req.ctx.query['name.first']
      } else if (key === 'name.last') {
        newUser.name.last = req.ctx.query['name.last']
      } else if (key === 'name.middle') {
        newUser.name.middle = req.ctx.query['name.middle']
      } else if (key === 'name.suffix') {
        newUser.name.suffix = req.ctx.query['name.suffix']
      }

      // TODO: process org affiliations and program org membership updates
    }

    await registryUserRepo.updateByUUID(userUUID, newUser)
    const agt = setAggregateUserObj({ UUID: userUUID })
    let result = await registryUserRepo.aggregate(agt)
    result = result.length > 0 ? result[0] : null

    const payload = {
      action: 'update_registry_user',
      change: result.user_id + ' was successfully updated.',
      req_UUID: req.ctx.uuid,
      org_UUID: await orgRepo.getOrgUUID(req.ctx.org),
      user: result
    }
    payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, payload.org_UUID)
    logger.info(JSON.stringify(payload))

    let msgStr = ''
    if (Object.keys(req.ctx.query).length > 0) {
      msgStr = result.user_id + ' was successfully updated.'
    } else {
      msgStr = 'No updates were specified for ' + result.user_id + '.'
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

async function deleteUser (req, res, next) {
  try {
    const userRepo = req.ctx.repositories.getUserRepository()
    const orgRepo = req.ctx.repositories.getOrgRepository()
    const registryUserRepo = req.ctx.repositories.getRegistryUserRepository()
    const userUUID = req.ctx.params.identifier

    const user = await registryUserRepo.findOneByUUID(userUUID)

    // TODO: check permissions

    await registryUserRepo.deleteByUUID(userUUID)

    const payload = {
      action: 'delete_registry_user',
      change: user.user_id + ' was successfully deleted.',
      req_UUID: req.ctx.uuid,
      org_UUID: await orgRepo.getOrgUUID(req.ctx.org)
    }
    payload.user_UUID = await userRepo.getUserUUID(req.ctx.user, payload.org_UUID)
    logger.info(JSON.stringify(payload))

    const responseMessage = {
      message: user.user_id + ' was successfully deleted.'
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

module.exports = {
  ALL_USERS: getAllUsers,
  SINGLE_USER: getUser,
  CREATE_USER: createUser,
  UPDATE_USER: updateUser,
  DELETE_USER: deleteUser
}
