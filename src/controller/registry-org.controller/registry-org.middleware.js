const utils = require('../../utils/utils')
const getConstants = require('../../constants').getConstants
const { validationResult } = require('express-validator')
const errors = require('./error')
const error = new errors.RegistryOrgControllerError()

function parsePostParams (req, res, next) {
  utils.reqCtxMapping(req, 'body', [])
  utils.reqCtxMapping(req, 'params', ['identifier', 'shortname'])
  utils.reqCtxMapping(req, 'query', [
    'long_name', 'short_name', 'aliases',
    'cve_program_org_function', 'authority.active_roles',
    'reports_to', 'oversees',
    'root_or_tlr', 'users',
    'charter_or_scope', 'disclosure_policy', 'product_list',
    'soft_quota', 'hard_quota',
    'contact_info.additional_contact_users', 'contact_info.poc', 'contact_info.poc_email', 'contact_info.poc_phone',
    'contact_info.admins', 'contact_info.org_email', 'contact_info.website'
  ])
  next()
}

function parseGetParams (req, res, next) {
  utils.reqCtxMapping(req, 'params', ['identifier', 'shortname'])
  utils.reqCtxMapping(req, 'query', ['page'])
  next()
}

function parseDeleteParams (req, res, next) {
  utils.reqCtxMapping(req, 'params', ['identifier'])
  next()
}

function isOrgRole (val) {
  const CONSTANTS = getConstants()

  val.forEach(role => {
    if (!CONSTANTS.ORG_ROLES.includes(role)) {
      throw new Error('Organization role does not exist.')
    }
  })

  return true
}

function parseError (req, res, next) {
  const err = validationResult(req).formatWith(({ location, msg, param, value, nestedErrors }) => {
    return { msg: msg, param: param, location: location }
  })
  if (!err.isEmpty()) {
    return res.status(400).json(error.badInput(err.array()))
  }
  next()
}

module.exports = {
  parsePostParams,
  parseGetParams,
  parseError,
  parseDeleteParams,
  isOrgRole
}
