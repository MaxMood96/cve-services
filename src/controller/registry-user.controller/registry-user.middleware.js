const utils = require('../../utils/utils')

function parsePostParams (req, res, next) {
  utils.reqCtxMapping(req, 'body', [])
  utils.reqCtxMapping(req, 'params', ['identifier'])
  utils.reqCtxMapping(req, 'query', [
    'new_user_id',
    'name.first', 'name.last', 'name.middle', 'name.suffix',
    'org_affiliations.add', 'org_affiliations.remove',
    'cve_program_org_membership.add', 'cve_program_org_membership.remove'
  ])
  next()
}

function parseGetParams (req, res, next) {
  utils.reqCtxMapping(req, 'params', ['identifier'])
  utils.reqCtxMapping(req, 'query', ['page'])
  next()
}

function parseDeleteParams (req, res, next) {
  utils.reqCtxMapping(req, 'params', ['identifier'])
  next()
}

module.exports = {
  parsePostParams,
  parseGetParams,
  parseDeleteParams
}
