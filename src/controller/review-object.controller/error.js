const idrErr = require('../../utils/error')

class ReviewObjectControllerError extends idrErr.IDRError {
  orgDnePathParam (shortname) {
    const err = {}
    err.error = 'ORG_DNE_PARAM'
    err.message = `The '${shortname}' organization designated by the shortname path parameter does not exist.`
    return err
  }
}

module.exports = {
  ReviewObjectControllerError
}
