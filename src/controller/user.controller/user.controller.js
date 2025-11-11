
require('dotenv').config()
const mongoose = require('mongoose')
const logger = require('../../middleware/logger')
const getConstants = require('../../constants').getConstants

/**
 * Get the details of all users
 * Called by GET /api/users
**/
async function getAllUsers (req, res, next) {
  try {
    const session = await mongoose.startSession()
    const repo = req.ctx.repositories.getBaseUserRepository()
    const CONSTANTS = getConstants()
    let returnValue

    // temporary measure to allow tests to work after fixing #920
    // tests required changing the global limit to force pagination
    if (req.TEST_PAGINATOR_LIMIT) {
      CONSTANTS.PAGINATOR_OPTIONS.limit = req.TEST_PAGINATOR_LIMIT
    }

    const options = CONSTANTS.PAGINATOR_OPTIONS
    options.sort = { username: 'asc' }
    options.page = req.ctx.query.page ? parseInt(req.ctx.query.page) : CONSTANTS.PAGINATOR_PAGE // if 'page' query parameter is not defined, set 'page' to the default page value

    try {
      returnValue = await repo.getAllUsers(options, !req.useRegistry)
    } finally {
      await session.endSession()
    }

    /* const agt = isRegistry ? setAggregateRegistryUserObj({}) : setAggregateUserObj({})
    const pg = await repo.aggregatePaginate(agt, options)
    const payload = { users: pg.itemsList }

    if (pg.itemCount >= CONSTANTS.PAGINATOR_OPTIONS.limit) {
      payload.totalCount = pg.itemCount
      payload.itemsPerPage = pg.itemsPerPage
      payload.pageCount = pg.pageCount
      payload.currentPage = pg.currentPage
      payload.prevPage = pg.prevPage
      payload.nextPage = pg.nextPage
    } */

    logger.info({ uuid: req.ctx.uuid, message: 'The user information was sent to the secretariat user.' })
    return res.status(200).json(returnValue)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  ALL_USERS: getAllUsers
}
