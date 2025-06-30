const getConstants = require('../../constants').getConstants
const { validationResult } = require('express-validator')
const errors = require('./error')
const error = new errors.OrgControllerError()
const { body, param, query } = require('express-validator')
const { toUpperCaseArray, isFlatStringArray } = require('../../middleware/middleware')
const CONSTANTS = getConstants()
const errorMsgs = require('../../middleware/errorMessages')
const utils = require('../../utils/utils')
const mw = require('../../middleware/middleware')
const _ = require('lodash')

function isOrgRole (val) {
  const CONSTANTS = getConstants()

  val.forEach(role => {
    if (!CONSTANTS.ORG_ROLES.includes(role)) {
      throw new Error('Organization role does not exist.')
    }
  })

  return true
}

function validateCreateOrgParameters () {
  return async (req, res, next) => {
    const useRegistry = req.query.registry === 'true'
    let validations = []
    if (useRegistry) {
      // Optional
      //  soft_quota,
      // Not allowed
      // users, contact_info.admins, in_use, created, last_updated
      const orgOptions = ['Top Level Root', 'Root', 'CNA', 'CNA-LR', 'Secretariat', 'Board', 'AWG', 'TWG', 'SPWG', 'Bulk Download', 'ADP']
      validations = [
        body(['short_name']).isString()
          .trim()
          .notEmpty()
          .isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH }),
        body(['long_name']).isString()
          .trim()
          .notEmpty(),
        body(['cve_program_org_function'])
          .default('CNA')
          .isString()
          .isIn(orgOptions),
        body(['oversees']).default([])
          .isArray(),
        body(['root_or_tlr']).default(false)
          .isBoolean(),
        body(
          [
            'charter_or_scope',
            'disclosure_policy',
            'product_list',
            'reports_to',
            'contact_info.poc',
            'contact_info.poc_email',
            'contact_info.poc_phone',
            'contact_info.org_email',
            'contact_info.website'
          ])
          .default('')
          .isString(),
        body(['authority.active_roles'])
          .default([CONSTANTS.AUTH_ROLE_ENUM.CNA])
          .custom(isFlatStringArray)
          .customSanitizer(toUpperCaseArray)
          .custom(isOrgRole),
        body(['hard_quota'])
          .default(CONSTANTS.DEFAULT_ID_QUOTA)
          .not()
          .isArray()
          .isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max })
          .withMessage(errorMsgs.ID_QUOTA),
        ...isNotAllowed('name', 'users', 'contact_info.admins', 'in_use', 'created', 'last_updated', 'policies.id_quota')
      ]
    } else {
      validations = [
        body(['short_name']).isString()
          .trim()
          .notEmpty()
          .isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH }),
        body(['name']).isString()
          .trim()
          .notEmpty(),
        body(['authority.active_roles'])
          .default([CONSTANTS.AUTH_ROLE_ENUM.CNA])
          .custom(isFlatStringArray)
          .customSanitizer(toUpperCaseArray)
          .custom(isOrgRole),
        body(['policies.id_quota'])
          .default(CONSTANTS.DEFAULT_ID_QUOTA)
          .not()
          .isArray()
          .isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max })
          .withMessage(errorMsgs.ID_QUOTA),
        ...isNotAllowed(
          'oversees',
          'long_name',
          'cve_program_org_function',
          'contact_info.admins',
          'in_use',
          'created',
          'root_or_tlr',
          'soft_quota',
          'aliases',
          'hard_quota',
          'contact_info.org_email',
          'contact_info.website',
          'contact_info',
          'users',
          'charter_or_scope',
          'disclosure_policy',
          'product_list',
          'reports_to',
          'contact_info.poc',
          'contact_info.poc_email',
          'contact_info.poc_phone',
          'contact_info.org_email',
          'contact_info.additional_contact_users',
          'contact_info.website')
      ]
    }

    const results = []
    for (const validation of validations) {
      const result = await validation.run(req)
      if (!result.isEmpty()) {
        results.push(...result.errors)
      }
    }
    if (results.length > 0) {
      return res.status(400).json({ message: 'Parameters were invalid', details: results })
    }
    next()
  }
}

function validateUserIdOrUsername () {
  return async (req, res, next) => {
    const useRegistry = req.query.registry === 'true'
    const validations = []
    if (useRegistry) {
      validations.push(
        body('user_id') // Condition to run validation
          .isString()
          .trim()
          .notEmpty(isValidUsername))
    } else {
      validations.push(body('username').isString().trim().notEmpty(isValidUsername))
    }
    const results = []
    for (const validation of validations) {
      const result = await validation.run(req)
      if (!result.isEmpty()) {
        results.push(...result.errors)
      }
    }
    if (results.length > 0) {
      return res.status(400).json({ message: 'Parameters were invalid', details: results })
    }
    next()
  }
}

function validateUpdateOrgParameters () {
  return async (req, res, next) => {
    const useRegistry = req.query.registry === 'true'

    const legacyParametersOnly = ['id_quota', 'name']
    const registryParametersOnly = ['hard_quota', 'long_name', 'cve_program_org_function', 'oversees', 'root_or_tlr', 'charter_or_scope', 'disclosure_policy', 'product_list']
    const sharedParameters = ['new_short_name', 'active_roles.add', 'active_roles.remove', 'registry']

    const allParameters = [
      ...legacyParametersOnly, ...registryParametersOnly, ...sharedParameters
    ]

    const validations = [query().custom((query) => { return mw.validateQueryParameterNames(query, allParameters) }),
      query(allParameters).custom((val) => { return mw.containsNoInvalidCharacters(val) }),
      query(['new_short_name']).optional().isString().trim().notEmpty().isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH }),
      query(['active_roles.add']).optional().toArray()
        .custom(isFlatStringArray)
        .customSanitizer(toUpperCaseArray)
        .custom(isOrgRole).withMessage(errorMsgs.ORG_ROLES),
      query(['active_roles.remove']).optional().toArray()
        .custom(isFlatStringArray)
        .customSanitizer(toUpperCaseArray)
        .custom(isOrgRole).withMessage(errorMsgs.ORG_ROLES),
      param(['shortname']).isString().trim().isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH })]

    if (useRegistry) {
      validations.push(

        query(['hard_quota']).optional().not().isArray().isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max }).withMessage(errorMsgs.ID_QUOTA),
        query(['long_name']).optional().isString().trim().notEmpty(),
        query(['oversees']).optional().isArray(),
        query(['root_or_tlr']).optional().isBoolean(),
        query(
          [
            'cve_program_org_function',
            'charter_or_scope',
            'disclosure_policy',
            'product_list',
            'contact_info.poc',
            'contact_info.poc_email',
            'contact_info.poc_phone',
            'contact_info.org_email',
            'contact_info.website'
          ])
          .optional()
          .isString(),
        ...isNotAllowedQuery(...legacyParametersOnly)
        // if we decide that we want to allow more, we can add them here.

      )
    } else {
      validations.push(

        query(['id_quota']).optional().not().isArray().isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max }).withMessage(errorMsgs.ID_QUOTA),
        query(['name']).optional().isString().trim().notEmpty(),
        ...isNotAllowedQuery(...registryParametersOnly)

      )
    }

    const results = []
    for (const validation of validations) {
      const result = await validation.run(req)
      if (!result.isEmpty()) {
        results.push(...result.errors)
      }
    }
    if (results.length > 0) {
      return res.status(400).json({ message: 'Parameters were invalid', details: results })
    }
    next()
  }
}

function isNotAllowed (...fields) {
  return fields.map(field =>
    body(field)
      .if((value, { req }) => _.has(req.body, field))
      .custom(() => {
        throw new Error(`${field} must not be present`)
      })
  )
}

function isNotAllowedQuery (...fields) {
  return fields.map(field =>
    query(field)
      .if((value, { req }) => _.has(req.query, field))
      .custom(() => {
        throw new Error(`${field} must not be present`)
      })
  )
}

function isUserRole (val) {
  const CONSTANTS = getConstants()

  val.forEach(role => {
    if (!CONSTANTS.USER_ROLES.includes(role)) {
      throw new Error('User role does not exist.')
    }
  })

  return true
}

function parsePostParams (req, res, next) {
  utils.reqCtxMapping(req, 'body', [])
  utils.reqCtxMapping(req, 'query', [
    'new_short_name', 'name', 'id_quota', 'active',
    'active_roles.add', 'active_roles.remove',
    'new_username', 'org_short_name',
    'name.first', 'name.last', 'name.middle', 'name.suffix', 'long_name', 'cve_program_org_function',
    'charter_or_scope',
    'disclosure_policy',
    'product_list',
    'contact_info.poc',
    'contact_info.poc_email',
    'contact_info.poc_phone',
    'contact_info.org_email',
    'hard_quota',
    'contact_info.website', 'root_or_tlr', 'oversees'
  ])
  utils.reqCtxMapping(req, 'params', ['shortname', 'username'])
  next()
}

function parseGetParams (req, res, next) {
  utils.reqCtxMapping(req, 'params', ['shortname', 'username', 'identifier', 'registry'])
  utils.reqCtxMapping(req, 'query', ['page', 'registry'])
  next()
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

function isValidUsername (val) {
  const value = val.match(/^[A-Za-z0-9\-_@.]{3,128}$/)
  if (value == null) {
    throw new Error('Username should be 3-128 characters. Allowed characters are alphanumeric and -_@.')
  }
  return true
}

module.exports = {
  parsePostParams,
  parseGetParams,
  parseError,
  isOrgRole,
  isUserRole,
  isValidUsername,
  validateCreateOrgParameters,
  validateUpdateOrgParameters,
  validateUserIdOrUsername
}
