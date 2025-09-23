const express = require('express')
const router = express.Router()
const mw = require('../../middleware/middleware')
const errorMsgs = require('../../middleware/errorMessages')
const { body, param, query } = require('express-validator')
const controller = require('./registry-org.controller')
const { parseGetParams, parsePostParams, parseDeleteParams, parseError, isOrgRole } = require('./registry-org.middleware')
const { toUpperCaseArray, toLowerCaseArray, isFlatStringArray } = require('../../middleware/middleware')
const getConstants = require('../../constants').getConstants
const CONSTANTS = getConstants()

router.get('/registryOrg',
  /*
  #swagger.tags = ['Registry Organization']
  #swagger.operationId = 'getAllRegistryOrgs'
  #swagger.ignore = true
  #swagger.summary = "Retrieves information about all registry organizations (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Retrieves a list of all registry organizations</p>
  #swagger.parameters['$ref'] = [
    '#/components/parameters/pageQuery',
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'A list of all registry organizations, along with pagination fields if results span multiple pages of data',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-org/list-registry-orgs-response.json' }
      }
    }
  }
  #swagger.responses[400] = {
    description: 'Bad Request',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/bad-request.json' }
      }
    }
  }
  #swagger.responses[401] = {
    description: 'Not Authenticated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[403] = {
    description: 'Forbidden',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[500] = {
    description: 'Internal Server Error',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  */
  mw.validateUser,
  mw.onlySecretariat,
  query().custom((query) => { return mw.validateQueryParameterNames(query, ['page']) }),
  query(['page']).custom((val) => { return mw.containsNoInvalidCharacters(val) }),
  query(['page']).optional().isInt({ min: CONSTANTS.PAGINATOR_PAGE }),
  parseError,
  parseGetParams,
  controller.ALL_ORGS
)

router.get('/registryOrg/:identifier',
  /*
  #swagger.tags = ['Registry Organization']
  #swagger.operationId = 'getSingleRegistryOrg'
  #swagger.ignore = true
  #swagger.summary = "Retrieves information about a specific registry organization"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>All authenticated users can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>All Users:</b> Retrieves information about the specified registry organization</p>
  #swagger.parameters['identifier'] = {
    in: 'path',
    description: 'The identifier of the registry organization',
    required: true,
    type: 'string'
  }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'The requested registry organization information is returned',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-org/get-registry-org-response.json' }
      }
    }
  }
  #swagger.responses[400] = {
    description: 'Bad Request',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/bad-request.json' }
      }
    }
  }
  #swagger.responses[401] = {
    description: 'Not Authenticated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[404] = {
    description: 'Not Found',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[500] = {
    description: 'Internal Server Error',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  */
  mw.validateUser,
  mw.onlySecretariat,
  param(['identifier']).isString().trim(),
  parseError,
  parseGetParams,
  controller.SINGLE_ORG
)

router.post('/registryOrg',
  /*
  #swagger.tags = ['Registry Organization']
  #swagger.operationId = 'createRegistryOrg'
  #swagger.ignore = true
  #swagger.summary = "Creates a new registry organization (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Creates a new registry organization</p>
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.requestBody = {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '../schemas/registry-org/create-registry-org-request.json' }
      }
    }
  }
  #swagger.responses[201] = {
    description: 'The registry organization was successfully created',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-org/create-registry-org-response.json' }
      }
    }
  }
  #swagger.responses[400] = {
    description: 'Bad Request',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/bad-request.json' }
      }
    }
  }
  #swagger.responses[401] = {
    description: 'Not Authenticated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[403] = {
    description: 'Forbidden',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[500] = {
    description: 'Internal Server Error',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  */
  mw.validateUser,
  mw.onlySecretariat,
  body(['short_name']).isString().trim().notEmpty().isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH }),
  body(['long_name']).isString().trim().notEmpty(),
  body(['cve_program_org_function']).isString().trim().default('CNA'),
  body(['root_or_tlr']).default(false).isBoolean(),
  body(['oversees']).default([]).isArray(),
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
  body(['authority.active_roles']).optional()
    .custom(isFlatStringArray)
    .customSanitizer(toUpperCaseArray)
    .custom(isOrgRole),
  body(['soft_quota']).optional().not().isArray().isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max }).withMessage(errorMsgs.ID_QUOTA),
  body(['hard_quota']).optional().not().isArray().isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max }).withMessage(errorMsgs.ID_QUOTA),
  body(['contact_info.additional_contact_users']).optional()
    .custom(isFlatStringArray),
  body(['contact_info.admins']).optional()
    .custom(isFlatStringArray),
  body(['aliases']).optional()
    .custom(isFlatStringArray)
    .customSanitizer(toLowerCaseArray),
  // TO-DO: validate users here once implemented
  parseError,
  parsePostParams,
  controller.CREATE_ORG
)

router.put('/registryOrg/:shortname',
  /*
  #swagger.tags = ['Registry Organization']
  #swagger.operationId = 'updateRegistryOrg'
  #swagger.ignore = true
  #swagger.summary = "Updates an existing registry organization (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Updates an existing registry organization</p>
  #swagger.parameters['shortname'] = {
    in: 'path',
    description: 'The Shortname of the registry organization to update',
    required: true,
    type: 'string'
  }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.requestBody = {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '../schemas/registry-org/update-registry-org-request.json' }
      }
    }
  }
  #swagger.responses[200] = {
    description: 'The registry organization was successfully updated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-org/update-registry-org-response.json' }
      }
    }
  }
  #swagger.responses[400] = {
    description: 'Bad Request',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/bad-request.json' }
      }
    }
  }
  #swagger.responses[401] = {
    description: 'Not Authenticated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[403] = {
    description: 'Forbidden',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[404] = {
    description: 'Not Found',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[500] = {
    description: 'Internal Server Error',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  */
  mw.validateUser,
  mw.onlySecretariat,
  param(['shortname']).isString().trim(),
  body(['short_name']).isString().trim().notEmpty().isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH }),
  body(['long_name']).isString().trim().notEmpty(),
  body(['cve_program_org_function']).isString().trim().default('CNA'),
  body(['root_or_tlr']).default(false).isBoolean(),
  body(['oversees']).default([]).isArray(),
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
  body(['authority.active_roles']).optional()
    .custom(isFlatStringArray)
    .customSanitizer(toUpperCaseArray)
    .custom(isOrgRole),
  body(['soft_quota']).optional().not().isArray().isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max }).withMessage(errorMsgs.ID_QUOTA),
  body(['hard_quota']).optional().not().isArray().isInt({ min: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_min, max: CONSTANTS.MONGOOSE_VALIDATION.Org_policies_id_quota_max }).withMessage(errorMsgs.ID_QUOTA),
  body(['contact_info.additional_contact_users']).optional()
    .custom(isFlatStringArray),
  body(['contact_info.admins']).optional()
    .custom(isFlatStringArray),
  body(['aliases']).optional()
    .custom(isFlatStringArray)
    .customSanitizer(toLowerCaseArray),
  // TO-DO: validate users here once implemented
  parseError,
  parsePostParams,
  parseGetParams,
  controller.UPDATE_ORG
)

router.delete('/registryOrg/:identifier',
  /*
  #swagger.tags = ['Registry Organization']
  #swagger.operationId = 'deleteRegistryOrg'
  #swagger.ignore = true
  #swagger.summary = "Deletes an existing registry organization (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Deletes an existing registry organization</p>
  #swagger.parameters['identifier'] = {
    in: 'path',
    description: 'The identifier of the registry organization to delete',
    required: true,
    type: 'string'
  }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'The registry organization was successfully deleted',
    content: {
      "application/json": {
        schema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message describing successful deletion operation'
            }
          }
        }
      }
    }
  }
  #swagger.responses[400] = {
    description: 'Bad Request',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/bad-request.json' }
      }
    }
  }
  #swagger.responses[401] = {
    description: 'Not Authenticated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[403] = {
    description: 'Forbidden',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[404] = {
    description: 'Not Found',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  */
  mw.validateUser,
  // TODO: permissions
  mw.onlySecretariat,
  param(['identifier']).isString().trim(),
  parseError,
  parseDeleteParams,
  controller.DELETE_ORG
)

console.log(controller.USER_ALL)

router.get('/registryOrg/:shortname/users',
  /*
  #swagger.tags = ['Registry User']
  #swagger.operationId = 'registryUserOrgAll'
  #swagger.ignore = true
  #swagger.summary = "Retrieves all users for the organization with the specified short name (accessible to all registered users)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>All registered users can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Regular, CNA & Admin Users:</b> Retrieves information about users in the same organization</p>
        <p><b>Secretariat:</b> Retrieves all user information for any organization</p>"
  #swagger.parameters['shortname'] = { description: 'The shortname of the organization' }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/pageQuery',
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'Returns all users for the organization, along with pagination fields if results span multiple pages of data',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-user/list-registry-users-response.json' }
      }
    }
  }
  #swagger.responses[400] = {
    description: 'Bad Request',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/bad-request.json' }
      }
    }
  }
  #swagger.responses[401] = {
    description: 'Not Authenticated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[403] = {
    description: 'Forbidden',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[404] = {
    description: 'Not Found',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[500] = {
    description: 'Internal Server Error',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  */
  mw.validateUser,
  mw.onlySecretariat,
  param(['shortname']).isString().trim().notEmpty().isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH }),
  query(['page']).optional().isInt({ min: CONSTANTS.PAGINATOR_PAGE }),
  parseError,
  parseGetParams,
  controller.USER_ALL)

router.post('/registryOrg/:shortname/user',
  /*
  #swagger.tags = ['Registry User']
  #swagger.operationId = 'RegistryUserCreateSingle'
  #swagger.ignore = true
  #swagger.summary = "Create a user with the provided short name as the owning organization (accessible to Admins and Secretariats)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>User must belong to an organization with the <b>Secretariat</b> role or be an <b>Admin</b> of the organization</p>
        <h2>Expected Behavior</h2>
        <p><b>Admin User:</b> Creates a user for the Admin's organization</p>
        <p><b>Secretariat:</b> Creates a user for any organization</p>"
  #swagger.parameters['shortname'] = { description: 'The shortname of the organization' }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.requestBody = {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '../schemas/registry-user/create-registry-user-request.json' },
      }
    }
  }
  #swagger.responses[200] = {
    description: 'Returns the new user information (with the secret)',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-user/create-registry-user-response.json' },
      }
    }
  }
  #swagger.responses[400] = {
    description: 'Bad Request',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/bad-request.json' }
      }
    }
  }
  #swagger.responses[401] = {
    description: 'Not Authenticated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[403] = {
    description: 'Forbidden',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[404] = {
    description: 'Not Found',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  #swagger.responses[500] = {
    description: 'Internal Server Error',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/errors/generic.json' }
      }
    }
  }
  */
  // mw.validateUser,
  // mw.onlySecretariatOrAdmin(true),
  // // mw.onlyOrgWithPartnerRole,
  mw.onlySecretariat,
  param(['shortname']).isString().trim().notEmpty().isLength({ min: CONSTANTS.MIN_SHORTNAME_LENGTH, max: CONSTANTS.MAX_SHORTNAME_LENGTH }),
  // body(['cve_program_org_membership']).optional().custom(isFlatStringArray), // TO-DO: implement custom(mw.isCveProgramOrgMembershipObject),
  body(
    [
      'user_id',
      'name.first',
      'name.last'
    ])
    .isString(),
  body(
    [
      'name.middle',
      'name.suffix',
      'contact_info.phone',
      'contact_info.email' // // TO-DO: this needs to be required only when contact-info is present?
    ])
    .default('')
    .isString(),
  body(['org_affiliations']) // TO-DO
    .optional(),
  body(['authority.active_roles'])
    .optional()
    .custom(isFlatStringArray)
    .customSanitizer(toUpperCaseArray)
    .custom(isOrgRole), // TO-DO: this needs to be required only when authority is present?
  parseError,
  parsePostParams,
  controller.USER_CREATE_SINGLE)

module.exports = router
