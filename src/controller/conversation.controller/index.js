const router = require('express').Router()
const { param, query } = require('express-validator')
const controller = require('./conversation.controller')
const mw = require('../../middleware/middleware')
const getConstants = require('../../../src/constants').getConstants
const CONSTANTS = getConstants()

// Get all conversations - SEC only
router.get('/conversation',
  /*
  #swagger.tags = ['Conversation']
  #swagger.operationId = 'getAllConversations'
  #swagger.summary = "Retrieves all conversations (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>User must belong to an organization with the <b>Secretariat</b> role</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Retrieves all conversations</p>"
  #swagger.parameters['page'] = {
    in: 'query',
    description: 'The page of the conversation to retrieve',
    type: 'integer'
  }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'Returns all conversations, along with pagination fields if results span multiple pages of data',
    content: {
      "application/json": {
        schema: {
          $ref: '../schemas/conversation/list-conversations-response.json'
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
  query().custom((query) => { return mw.validateQueryParameterNames(query, ['page']) }),
  query(['page']).custom((val) => { return mw.containsNoInvalidCharacters(val) }),
  query(['page']).optional().isInt({ min: CONSTANTS.PAGINATOR_PAGE }),
  controller.getAllConversations
)

// Get all conversations for target UUID - SEC only
router.get('/conversation/target/:uuid',
  /*
  #swagger.tags = ['Conversation']
  #swagger.operationId = 'getConversationsForTargetUUID'
  #swagger.summary = "Retrieves all conversations for a specific target UUID (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>User must belong to an organization with the <b>Secretariat</b> role</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Retrieves all conversations for the specified target UUID</p>"
  #swagger.parameters['uuid'] = { description: 'The UUID of the target entity' }
  #swagger.parameters['page'] = {
    in: 'query',
    description: 'The page of the conversation to retrieve',
    type: 'integer'
  }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.responses[200] = {
    description: 'Returns all conversations for the target UUID, along with pagination fields if results span multiple pages of data',
    content: {
      "application/json": {
        schema: {
          $ref: '../schemas/conversation/list-conversations-response.json'
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
  query().custom((query) => { return mw.validateQueryParameterNames(query, ['page']) }),
  query(['page']).custom((val) => { return mw.containsNoInvalidCharacters(val) }),
  query(['page']).optional().isInt({ min: CONSTANTS.PAGINATOR_PAGE }),
  controller.getConversationsForTargetUUID
)

// Post conversation for target UUID - SEC only
router.post('/conversation/target/:uuid',
  /*
  #swagger.tags = ['Conversation']
  #swagger.operationId = 'createConversationForTargetUUID'
  #swagger.summary = "Creates a conversation for a specific target UUID (accessible to Secretariat only)"
  #swagger.description = "
        <h2>Access Control</h2>
        <p>User must belong to an organization with the <b>Secretariat</b> role</p>
        <h2>Expected Behavior</h2>
        <p><b>Secretariat:</b> Creates a conversation for the specified target UUID</p>"
  #swagger.parameters['uuid'] = { description: 'The UUID of the target entity' }
  #swagger.parameters['$ref'] = [
    '#/components/parameters/apiEntityHeader',
    '#/components/parameters/apiUserHeader',
    '#/components/parameters/apiSecretHeader'
  ]
  #swagger.requestBody = {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            body: {
              type: 'string',
              description: 'The content of the conversation message'
            }
          },
          required: ['body']
        }
      }
    }
  }
  #swagger.responses[200] = {
    description: 'Returns the created conversation',
    content: {
      "application/json": {
        schema: {
          $ref: '../schemas/conversation/conversation.json'
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
  param(['uuid']).isUUID(4),
  controller.createConversationForTargetUUID
)

module.exports = router
