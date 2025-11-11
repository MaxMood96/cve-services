const Org = require('../model/org')
const User = require('../model/user')

const BaseOrg = require('../model/baseorg')
const BaseUserRepository = require('../repositories/baseUserRepository')

const getConstants = require('../constants').getConstants
const _ = require('lodash')
const { DateTime } = require('luxon')
const BaseOrgRepository = require('../repositories/baseOrgRepository')

async function getOrgUUID (shortName, useRegistry = false, options = {}) {
  const ModelToQuery = useRegistry ? BaseOrg : Org
  const query = { short_name: shortName }
  const projection = 'UUID' // We only need the UUID field

  // It's often good practice to use .lean() for read-only operations
  // if you don't need full Mongoose documents.

  const executionOptions = { ...options }
  if (executionOptions.lean === undefined) executionOptions.lean = true

  const orgDocument = await ModelToQuery.findOne(query, projection, executionOptions)

  return orgDocument ? orgDocument.UUID : null
}

async function getUserUUID (userIdentifier, orgUUID, useRegistry = false, options = {}) {
  let query

  if (!useRegistry) {
    // For User, query by username and org_UUID
    query = {
      username: userIdentifier, // Matches the 'username' field in User schema
      org_UUID: orgUUID // Matches the 'org_UUID' field in User schema
    }
    const projection = 'UUID' // We only need the user's UUID field
    const executionOptions = { ...options }
    if (executionOptions.lean === undefined) executionOptions.lean = true

    const userDocument = await User.findOne(query, projection, executionOptions)

    return userDocument ? userDocument.UUID : null
  } else {
    const baseUserRepository = new BaseUserRepository()
    const userDocument = await baseUserRepository.findOneByUsernameAndOrgUUID(userIdentifier, orgUUID, options)
    return userDocument ? userDocument.UUID : null
  }
}

async function isSecretariat (shortName, useRegistry = false, options = {}) {
  let result = false
  let orgUUID = null
  let secretariats = []

  const CONSTANTS = getConstants()
  if (useRegistry) {
    orgUUID = await getOrgUUID(shortName, useRegistry, options) // may be null if org does not exists
    secretariats = await BaseOrg.find({ authority: { $in: [CONSTANTS.AUTH_ROLE_ENUM.SECRETARIAT] } })
  } else {
    orgUUID = await getOrgUUID(shortName, false, options) // may be null if org does not exists
    secretariats = await Org.find({ 'authority.active_roles': { $in: [CONSTANTS.AUTH_ROLE_ENUM.SECRETARIAT] } })
  }

  if (orgUUID) {
    secretariats.forEach((obj) => {
      if (obj.UUID === orgUUID) {
        result = true // org is secretariat
      }
    })
  }

  return result
}

async function isSecretariatUUID (orgUUID) {
  let result = false
  const CONSTANTS = getConstants()
  const secretariats = await BaseOrg.find({ authority: { $in: [CONSTANTS.AUTH_ROLE_ENUM.SECRETARIAT] } })

  if (orgUUID) {
    secretariats.forEach((obj) => {
      if (obj.UUID === orgUUID) {
        result = true // org is secretariat
      }
    })
  }

  return result // org is not secretariat
}

async function isBulkDownload (shortName) {
  let result = false
  const CONSTANTS = getConstants()
  const orgUUID = await getOrgUUID(shortName) // may be null if org does not exists
  const bulkDownloadOrgs = await BaseOrg.find({ authority: { $in: [CONSTANTS.AUTH_ROLE_ENUM.BULK_DOWNLOAD] } })

  if (orgUUID) {
    bulkDownloadOrgs.forEach((obj) => {
      if (obj.UUID === orgUUID) {
        result = true // org has the bulk download role
      }
    })
  }

  return result // org does not have bulk download as a role
}

async function isAdmin (requesterUsername, requesterShortName, isRegistry = false, options = {}) {
  let result = false
  const CONSTANTS = getConstants()
  const requesterOrgUUID = await getOrgUUID(requesterShortName, isRegistry, options) // may be null if org does not exists

  const baseUserRepository = new BaseUserRepository()
  if (requesterOrgUUID) {
    const user = isRegistry ? await baseUserRepository.findOneByUsernameAndOrgUUID(requesterUsername, requesterOrgUUID) : await User.findOne().byUserNameAndOrgUUID(requesterUsername, requesterOrgUUID)

    if (user) {
      if (isRegistry) {
        result = baseUserRepository.isAdmin(requesterShortName, requesterUsername, options)
      } else {
        result = user.authority.active_roles.includes(CONSTANTS.USER_ROLE_ENUM.ADMIN)
      }
    }
  }

  return result // org is not secretariat
}

async function isAdminUUID (requesterUsername, requesterOrgUUID, isRegistry = false, options = {}) {
  let result = false
  const CONSTANTS = getConstants()

  const baseUserRepository = new BaseUserRepository()
  const baseOrgRepository = new BaseOrgRepository()
  if (requesterOrgUUID) {
    const orgObject = await baseOrgRepository.findOneByUUID(requesterOrgUUID, options)
    const user = isRegistry ? await baseUserRepository.findOneByUsernameAndOrgUUID(requesterUsername, requesterOrgUUID) : await User.findOne().byUserNameAndOrgUUID(requesterUsername, requesterOrgUUID)

    if (user && orgObject) {
      if (isRegistry) {
        result = baseUserRepository.isAdmin(orgObject.short_name, requesterUsername, options)
      } else {
        result = user.authority.active_roles.includes(CONSTANTS.USER_ROLE_ENUM.ADMIN)
      }
    }
  }

  return result // org is not secretariat
}

function reqCtxMapping (req, keyType, keys) {
  if (!(keyType in req.ctx)) {
    req.ctx[keyType] = {}
  }

  // request body gets mapped to request context
  // while query parameters or headers are mapped individually
  if (keyType === 'body') {
    if (req[keyType]) {
      req.ctx[keyType] = req[keyType]
    }
  } else {
    keys.forEach(k => {
      if (k in req[keyType]) {
        req.ctx[keyType][k] = req[keyType][k]
      }
    })
  }
}

// Return true if boolean is 0, true, or yes, with any mix of casing
// Please note that this function does NOT evaluate "undefined" as false. - A tired developer who lost way too much time to this.
function booleanIsTrue (val) {
  if ((val.toString() === '1') ||
      (val.toString().toLowerCase() === 'true') ||
      (val.toString().toLowerCase() === 'yes')) {
    return true
  } else { return false }
}

// Sanitizer for dates
function toDate (val) {
  val = val.toUpperCase()
  //
  let value = val.match(/^\d{4}-\d{2}-\d{2}T(?:0?[0-9]|1[0-9]|2[0-3]):(?:0[0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]):(?:0[0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])(\.\d+)?(|Z|((-|\+)(?:0[0-2]|1[0-9]|2[0-3]):(?:0[0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])))$/)
  let result = null
  if (value) {
    const dateStr = value[0]
    // Make sure that the string passed is a valid date
    if (DateTime.fromISO(dateStr.toString()).isValid) {
      result = new Date(dateStr)
    }
  } else {
    value = val.match(/^\d{4}-\d{2}-\d{2}$/)
    /* eslint-disable-next-line */
    if ((value) && DateTime.fromISO(dateStr.toString()).isValid) {
      result = new Date(`${value[0]}T00:00:00.000+00:00`)
    }
  }
  return result
}

// Covert Dates to ISO format
function convertDatesToISO (obj, dateKeys) {
  // Helper function to check if a value is a valid date
  function isValidDate (value) {
    return value instanceof Date && !isNaN(value)
  }

  // Helper function to check if a string is a valid date
  function isStringDate (value) {
    const date = new Date(value)
    return !isNaN(date.getTime())
  }

  function updateDateValue (objectToUpdate, key, value) {
    if (isValidDate(value)) {
      _.set(objectToUpdate, key, value.toISOString())
    } else if (typeof value === 'string' && isStringDate(value)) {
      _.set(objectToUpdate, key, new Date(value).toISOString())
    }
  }

  // For the top layer object
  for (const key of dateKeys) {
    if (_.has(obj, key)) {
      const value = _.get(obj, key)
      updateDateValue(obj, key, value)
    }
  }

  // For the ADP(s)
  if (_.has(obj, 'containers.adp')) {
    // Use lodash for each to loop over array and check for date keys
    _.each(obj.containers.adp, (adp) => {
      for (const key of dateKeys) {
        if (_.has(adp, key)) {
          const value = _.get(adp, key)
          updateDateValue(adp, key, value)
        }
      }
    })
  }
  // For the CNAs

  if (_.has(obj, 'containers.cna')) {
    // Use lodash to check the containers.cna object for date keys
    for (const key of dateKeys) {
      if (_.has(obj.containers.cna, key)) {
        const value = _.get(obj.containers.cna, key)
        updateDateValue(obj.containers.cna, key, value)
      }
    }
  }

  return obj
}

function isEnrichedContainer (container) {
  const hasCvss = container?.metrics?.some(item => 'cvssV4_0' in item || 'cvssV3_1' in item || 'cvssV3_0' in item || 'cvssV2_0' in item)
  const hasCwe = container?.problemTypes?.some(pItem => pItem?.descriptions?.some(dItem => 'cweId' in dItem))
  if (!(hasCvss && hasCwe)) {
    return false
  }
  return true
}

function deepRemoveEmpty (obj) {
  // Create a deep clone to avoid modifying the original object
  const newObj = _.cloneDeep(obj)

  const clean = (currentObj) => {
    _.forOwn(currentObj, (value, key) => {
      // 1. If the value is a nested object, recurse into it
      if (_.isObject(value) && !_.isArray(value) && !_.isDate(value)) {
        clean(value)
      }

      // 2. After recursion, check if the key's value is an empty object or array.
      // This will catch both initially empty fields and nested objects that became empty.
      if (
        (_.isObject(value) && !_.isDate(value) && _.isEmpty(value)) ||
        (_.isArray(value) && _.isEmpty(value))
      ) {
        delete currentObj[key]
      }
    })
  }

  clean(newObj)
  return newObj
}

module.exports = {
  deepRemoveEmpty,
  isSecretariat,
  isBulkDownload,
  isAdmin,
  isAdminUUID,
  isSecretariatUUID,
  isEnrichedContainer,
  getOrgUUID,
  getUserUUID,
  reqCtxMapping,
  booleanIsTrue,
  toDate,
  convertDatesToISO

}
