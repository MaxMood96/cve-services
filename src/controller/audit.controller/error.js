const idrErr = require('../../utils/error')

class AuditControllerError extends idrErr.IDRError {
  auditDneByTarget (targetUUID) {
    const err = {}
    err.error = 'AUDIT_DNE_TARGET'
    err.message = `No audit history found for target UUID '${targetUUID}'.`
    return err
  }

  auditDneByDocument (documentUUID) {
    const err = {}
    err.error = 'AUDIT_DNE_DOCUMENT'
    err.message = `No audit document found with UUID '${documentUUID}'.`
    return err
  }

  orgDne (identifier) {
    const err = {}
    err.error = 'ORG_DNE'
    err.message = `No organization found with identifier '${identifier}'.`
    return err
  }

  auditExists (targetUUID) {
    const err = {}
    err.error = 'AUDIT_EXISTS'
    err.message = `Audit document already exists for target UUID '${targetUUID}'.`
    return err
  }

  invalidAuditObject () {
    const err = {}
    err.error = 'INVALID_AUDIT_OBJECT'
    err.message = 'The audit_object does not match the organization schema.'
    return err
  }

  invalidUUID (fieldName) {
    const err = {}
    err.error = 'INVALID_UUID'
    err.message = `The '${fieldName}' field contains an invalid UUID format.`
    return err
  }

  missingRequiredField (fieldName) {
    const err = {}
    err.error = 'MISSING_REQUIRED_FIELD'
    err.message = `Missing required field: '${fieldName}'.`
    return err
  }

  invalidNumberOfChanges () {
    const err = {}
    err.error = 'INVALID_NUMBER_OF_CHANGES'
    err.message = 'The number_of_changes parameter must be a positive integer.'
    return err
  }

  notAuthorized () {
    const err = {}
    err.error = 'NOT_AUTHORIZED'
    err.message = 'You do not have permission to view this audit history.'
    return err
  }

  uuidProvided (creationType) {
    const err = {}
    err.error = 'UUID_PROVIDED'
    err.message = `Providing UUIDs for ${creationType} creation or update is not allowed.`
    return err
  }
}

module.exports = {
  AuditControllerError
}
