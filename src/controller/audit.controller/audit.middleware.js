const utils = require('../../utils/utils')

/**
 * Parse POST/PUT parameters and map to req.ctx
 */
function parsePostParams (req, res, next) {
  utils.reqCtxMapping(req, 'body', [])
  utils.reqCtxMapping(req, 'params', ['document_uuid', 'target_uuid', 'org_identifier', 'number_of_changes'])
  next()
}

/**
 * Parse GET parameters and map to req.ctx
 */
function parseGetParams (req, res, next) {
  utils.reqCtxMapping(req, 'params', ['document_uuid', 'target_uuid', 'org_identifier', 'number_of_changes'])
  utils.reqCtxMapping(req, 'query', ['page'])
  next()
}

module.exports = {
  parsePostParams,
  parseGetParams
}
