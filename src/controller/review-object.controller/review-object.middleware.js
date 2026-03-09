const { validationResult } = require('express-validator')

function parseError (req, res, next) {
  const err = validationResult(req).formatWith(({ location, msg, param, value, nestedErrors }) => {
    return { msg: msg, param: param, location: location }
  })
  if (!err.isEmpty()) {
    return res.status(400).json({ message: 'Bad Request', details: err.array() })
  }
  next()
}

module.exports = {
  parseError
}
