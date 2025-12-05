const express = require('express')
const router = express.Router()
const mw = require('../../middleware/middleware')
const { param, query } = require('express-validator')
const controller = require('./registry-user.controller')
const { parseGetParams, parsePostParams, parseDeleteParams } = require('./registry-user.middleware')
const getConstants = require('../../constants').getConstants
const CONSTANTS = getConstants()

router.get('/registryUser',
  /*
  #swagger.tags = ['Registry User']
  #swagger.operationId = 'getAllRegistryUsers'
  #swagger.ignore = true
  #swagger.summary = "Retrieves information about all registry users (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Retrieves a list of all registry users</p>
  #swagger.parameters['$ref'] = [
    '#/components/parameters/pageQuery',
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'A list of all registry users, along with pagination fields if results span multiple pages of data',
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
  query(['page']).optional().isInt({ min: CONSTANTS.PAGINATOR_PAGE }),
  query(['page']).custom((val) => { return mw.containsNoInvalidCharacters(val) }),
  // parseError,
  parseGetParams,
  controller.ALL_USERS
)

router.get('/registryUser/:identifier',
/*
  #swagger.tags = ['Registry User']
  #swagger.operationId = 'getSingleRegistryUser'
  #swagger.ignore = true
  #swagger.summary = "Retrieves information about a specific registry user"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>All authenticated users can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>All Users:</b> Retrieves information about the specified registry user</p>
  #swagger.parameters['identifier'] = {
    in: 'path',
    description: 'The identifier of the registry user',
    required: true,
    type: 'string'
  }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'The requested registry user information is returned',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-user/get-registry-user-response.json' }
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
  // parseError,
  parseGetParams,
  controller.SINGLE_USER
)

router.post('/registryUser',
  /*
  #swagger.tags = ['Registry User']
  #swagger.operationId = 'createRegistryUser'
  #swagger.ignore = true
  #swagger.summary = "Creates a new registry user (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Creates a new registry user</p>
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.requestBody = {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '../schemas/registry-user/create-registry-user-request.json' }
      }
    }
  }
  #swagger.responses[201] = {
    description: 'The registry user was successfully created',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-user/create-registry-user-response.json' }
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
  // mw.onlySecretariat, // TODO: permissions
  // TODO: validation
  // parseError,
  parsePostParams,
  controller.CREATE_USER
)

router.put('/registryUser/:identifier',
  /*
  #swagger.tags = ['Registry User']
  #swagger.operationId = 'updateRegistryUser'
  #swagger.ignore = true
  #swagger.summary = "Updates an existing registry user (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Updates an existing registry user</p>
  #swagger.parameters['identifier'] = {
    in: 'path',
    description: 'The identifier of the registry user to update',
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
        schema: { $ref: '../schemas/registry-user/update-registry-user-request.json' }
      }
    }
  }
  #swagger.responses[200] = {
    description: 'The registry user was successfully updated',
    content: {
      "application/json": {
        schema: { $ref: '../schemas/registry-user/update-registry-user-response.json' }
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
  param(['identifier']).isString().trim(),
  // TODO: do more validation here
  // parseError,
  parsePostParams,
  controller.UPDATE_USER
)

router.delete(
  '/registryUser/:identifier',
  /*
  #swagger.tags = ['Registry User']
  #swagger.operationId = 'deleteRegistryUser'
  #swagger.ignore = true
  #swagger.summary = "Deletes an existing registry user (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>Only users with Secretariat role can access this endpoint</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Deletes an existing registry user</p>
  #swagger.parameters['identifier'] = {
    in: 'path',
    description: 'The identifier of the registry user to delete',
    required: true,
    type: 'string'
  }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'The registry user was successfully deleted',
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
  // parseError,
  parseDeleteParams,
  controller.DELETE_USER
)

module.exports = router
