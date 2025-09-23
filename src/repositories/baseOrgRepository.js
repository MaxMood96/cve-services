const BaseRepository = require('./baseRepository')
const BaseOrgModel = require('../model/baseorg')
const CNAOrgModel = require('../model/cnaorg')
const ADPOrgModel = require('../model/adporg')
const BulkDownloadModel = require('../model/bulkdownloadorg')
const SecretariatOrgModel = require('../model/secretariatorg')
const CveIdRepository = require('./cveIdRepository')
const uuid = require('uuid')
const _ = require('lodash')
const BaseOrg = require('../model/baseorg')
const getConstants = require('../constants').getConstants

function setAggregateOrgObj (query) {
  return [
    {
      $match: query
    },
    {
      $project: {
        _id: false,
        UUID: true,
        short_name: true,
        name: true,
        'authority.active_roles': true,
        'policies.id_quota': true,
        time: true
      }
    }
  ]
}

function setAggregateRegistryOrgObj (query) {
  return [
    {
      $match: query
    }
  ]
}

class BaseOrgRepository extends BaseRepository {
  constructor () {
    super(BaseOrg)
  }

  async findOneByShortNameWithSelect (shortName, select, options = {}, returnLegacyFormat = false) {
    const OrgRepository = require('./orgRepository')
    if (returnLegacyFormat) return await OrgRepository.findOneByShortName(shortName, options)
    await BaseOrgModel.findOne({ short_name: shortName }, null, options).select(select)
  }

  async findOneByShortName (shortName, options = {}, returnLegacyFormat = false) {
    const OrgRepository = require('./orgRepository')
    const legacyOrgRepo = new OrgRepository()
    if (returnLegacyFormat) return await legacyOrgRepo.findOneByShortName(shortName, options)
    const data = await BaseOrgModel.findOne({ short_name: shortName }, null, options)
    return data
  }

  async findOneByUUID (UUID, options = {}, returnLegacyFormat = false) {
    const OrgRepository = require('./orgRepository')
    const legacyOrgRepo = new OrgRepository()
    if (returnLegacyFormat) return await legacyOrgRepo.findOneByUUID(UUID, options)
    return await BaseOrgModel.findOne({ UUID: UUID }, null, options)
  }

  async getOrgUUID (shortName, options = {}, useLegacy = false) {
    const org = await BaseOrgModel.findOne({ short_name: shortName }, null, options)
    if (org) return org.UUID
    return null
  }

  // In the future we wont need a second arg here, but until that databases are synced I need to control this.
  async orgExists (shortName, options = {}, returnLegacyFormat = false) {
    if (await this.findOneByShortName(shortName, options, returnLegacyFormat)) {
      return true
    }
    return false
  }

  async addUserToOrg (orgShortName, userUUID, isAdmin = false, options = {}, isLegacyObject = false) {
    const org = await this.findOneByShortName(orgShortName, options)
    if (!org.users.includes(userUUID)) {
      org.users.push(userUUID)
    }
    if (isAdmin) {
      org.admins = [...org.admins, userUUID]
    }
    await org.save(options)
  }

  async getAllOrgs (options = {}, returnLegacyFormat = false) {
    const OrgRepository = require('./orgRepository')
    const orgRepo = new OrgRepository()
    let pg
    if (returnLegacyFormat) {
      const agt = setAggregateOrgObj({})
      pg = await orgRepo.aggregatePaginate(agt, options)
    } else {
      const agt = setAggregateRegistryOrgObj({})
      pg = await this.aggregatePaginate(agt, options)
    }
    const data = { organizations: pg.itemsList }
    if (pg.itemCount >= options.limit) {
      data.totalCount = pg.itemCount
      data.itemsPerPage = pg.itemsPerPage
      data.pageCount = pg.pageCount
      data.currentPage = pg.currentPage
      data.prevPage = pg.prevPage
      data.nextPage = pg.nextPage
    }
    return data
  }

  async getOrgObject (identifier, identifierIsUUID = false, options = {}, returnLegacyFormat = false) {
    const data = identifierIsUUID
      ? await this.findOneByUUID(identifier, options, returnLegacyFormat)
      : await this.findOneByShortName(identifier, options, returnLegacyFormat)
    if (!data) return null
    return data
  }

  async getOrg (identifier, identifierIsUUID = false, options = {}, returnLegacyFormat = false) {
    const { deepRemoveEmpty } = require('../utils/utils')
    const data = identifierIsUUID
      ? await this.findOneByUUID(identifier, options, returnLegacyFormat)
      : await this.findOneByShortName(identifier, options, returnLegacyFormat)
    if (!data) return null
    const result = data.toObject()
    delete result.__t
    delete result.__v
    delete result._id
    return deepRemoveEmpty(result)
  }

  async getOrgIdQuota (org, useLegacy = false) {
    const returnPayload = {
      ...(useLegacy ? { id_quota: org.policies.id_quota } : { hard_quota: org.hard_quota }),
      total_reserved: null,
      available: null
    }
    const query = {
      owning_cna: org.UUID,
      state: getConstants().CVE_STATES.RESERVED
    }
    const cveIdRepo = new CveIdRepository()
    const docs = await cveIdRepo.countDocuments(query)
    returnPayload.total_reserved = docs
    if (useLegacy) {
      returnPayload.available = returnPayload.id_quota - returnPayload.total_reserved
    } else {
      returnPayload.available = returnPayload.hard_quota - returnPayload.total_reserved
    }
    return returnPayload
  }

  /**
 * @async
 * @function createOrg
 * @description Creates a new organization in both the registry and a parallel legacy system. It handles the conversion between legacy and registry data formats, assigns a shared UUID, and saves the new organization to the respective data stores.
 *
 * @param {object} incomingOrg - The raw organization data object. Can be in either legacy or registry format, specified by the `isLegacyObject` flag.
 * @param {object} [options={}] - Optional settings passed to the legacy repository for database operations.
 * @param {boolean} [isLegacyObject=false] - If true, `incomingOrg` is treated as a legacy-formatted object. If false, it's treated as a registry-formatted object.
 *
 * @returns {Promise<object>} A promise that resolves to a plain JavaScript object representing the newly created organization. The format of the returned object (legacy or registry) is determined by the `isLegacyObject` parameter. The object is stripped of internal properties and empty values.
 * @throws {string} Throws an error if the organization's authority role is not 'SECRETARIAT' or 'CNA'.
 */
  async createOrg (incomingOrg, options = {}, isLegacyObject = false) {
    const { deepRemoveEmpty } = require('../utils/utils')
    const OrgRepository = require('./orgRepository')
    const CONSTANTS = getConstants()
    // In the future we may be able to dynamically detect, but for now we will take a boolean
    let legacyObjectRaw = null
    let registryObjectRaw = null
    let legacyObject = null
    let registryObject = null
    const legacyOrgRepo = new OrgRepository()

    // generate a shared uuid
    const sharedUUID = uuid.v4()

    if (isLegacyObject) {
      legacyObjectRaw = incomingOrg
      registryObjectRaw = this.convertLegacyToRegistry(incomingOrg)
    } else {
      registryObjectRaw = incomingOrg
      legacyObjectRaw = this.convertRegistryToLegacy(incomingOrg)
    }

    if (!registryObjectRaw.authority) {
      registryObjectRaw.authority = ['CNA']
    }

    if (!legacyObjectRaw.authority?.active_roles) {
      legacyObjectRaw.authority = {
        active_roles: ['CNA']
      }
    }

    // Registry stuff
    // Add uuid to org object
    registryObjectRaw.UUID = sharedUUID
    // Figure out why this is not working....
    // registryObjectRaw = _.omitBy(registryObjectRaw, value => _.isNil(value) || _.isEmpty(value))

    // Write - use org type specific model
    if (registryObjectRaw.authority.includes('SECRETARIAT')) {
      // Write
      // testing:
      registryObjectRaw.authority = 'SECRETARIAT'
      const SecretariatObjectToSave = new SecretariatOrgModel(registryObjectRaw)
      registryObject = await SecretariatObjectToSave.save(options)
    } else if (registryObjectRaw.authority.includes('CNA')) {
      // A special case, we should make sure we have the default quota if it is not set
      if (!registryObjectRaw.hard_quota) {
      // set to default quota if none is specified
        registryObjectRaw.hard_quota = CONSTANTS.DEFAULT_ID_QUOTA
      }
      // Write
      const CNAObjectToSave = new CNAOrgModel(registryObjectRaw)
      registryObject = await CNAObjectToSave.save(options)
    } else if (registryObjectRaw.authority.includes('ADP')) {
      registryObjectRaw.hard_quota = 0
      const adpObjectToSave = new ADPOrgModel(registryObjectRaw)
      registryObject = await adpObjectToSave.save(options)
    } else if (registryObjectRaw.authority.includes('BULK_DOWNLOAD')) {
      registryObjectRaw.hard_quota = 0
      const bulkDownloadObjectToSave = new BulkDownloadModel(registryObjectRaw)
      registryObject = await bulkDownloadObjectToSave.save(options)
    } else {
      // eslint-disable-next-line no-throw-literal
      throw 'dave you screwed up'
    }

    // Legacy Write, this will be removed when backwards compatibility is no longer needed.
    legacyObjectRaw.UUID = sharedUUID

    //* ******* Legacy has some special cases that we have to deal with here.**************
    legacyObjectRaw.inUse = false
    if (!legacyObjectRaw?.policies?.id_quota) {
      // set to default quota if none is specified
      _.set(legacyObjectRaw, 'policies.id_quota', CONSTANTS.DEFAULT_ID_QUOTA)
    }
    if (
      legacyObjectRaw.authority.active_roles.length === 1 && (
        legacyObjectRaw.authority.active_roles[0] === 'ADP' ||
      legacyObjectRaw.authority.active_roles[0] === 'BULK_DOWNLOAD')
    ) {
      // ADPs have quota of 0
      _.set(legacyObjectRaw, 'policies.id_quota', 0)
    }

    // The legacy way of doing this, the way this is written under the hood there is no other way
    // This await does not return a value, even though there is a return in it. :shrugg:
    await legacyOrgRepo.updateByOrgUUID(sharedUUID, legacyObjectRaw, options)

    if (isLegacyObject) {
      // This gets us the mongoose object that has all the right data in it, the "legacyObjectRaw" is the custom JSON we are sending. NOT the post written object.
      legacyObject = await legacyOrgRepo.findOneByShortName(
        legacyObjectRaw.short_name,
        options
      )
      // Convert the actual model, back to a json model
      const legacyObjectRawJson = legacyObject.toObject()
      // Remove private stuff
      delete legacyObjectRawJson.__v
      delete legacyObjectRawJson._id
      return deepRemoveEmpty(legacyObjectRawJson)
    }

    const rawRegistryOrgObject = registryObject.toObject()
    delete rawRegistryOrgObject.__t
    delete rawRegistryOrgObject.__v
    delete rawRegistryOrgObject._id

    return deepRemoveEmpty(rawRegistryOrgObject)
  }

  /**
 * @async
 * @function updateOrg
 * @description Updates an organization's details in both the new registry system and a parallel legacy system. It finds the organization by its short name, applies the provided updates, and saves the changes to both data sources.
 *
 * @param {string} shortName - The unique short name of the organization to update.
 * @param {object} incomingParameters - An object containing the fields to update.
 * @param {string} [incomingParameters.new_short_name] - The new short name for the organization. (Applied to both legacy and registry)
 * @param {string} [incomingParameters.name] - The new long name for the organization. (Applied to both legacy and registry)
 * @param {object} [incomingParameters.active_roles] - Object to manage active roles. (Applied to both legacy and registry)
 * @param {string[]} [incomingParameters.active_roles.add] - An array of role strings to add.
 * @param {string[]} [incomingParameters.active_roles.remove] - An array of role strings to remove.
 * @param {number} [incomingParameters.id_quota] - The ID quota for the organization. (Applied to legacy and CNA-type registry orgs)
 * @param {string} [incomingParameters.root_or_tlr] - The root or Top-Level Root (TLR) status. (Registry only)
 * @param {string} [incomingParameters.charter_or_scope] - The charter or scope description. (Registry only)
 * @param {string} [incomingParameters.disclosure_policy] - The disclosure policy. (Registry only)
 * @param {string[]} [incomingParameters.product_list] - A list of the organization's products. (Registry only)
 * @param {string[]} [incomingParameters.oversees] - A list of short names of organizations this org oversees. (Registry only)
 * @param {string} [incomingParameters.reports_to] - The short name of the organization this org reports to. (Registry only)
 * @param {string} [incomingParameters.contact_info.poc] - The primary point of contact's name. (Registry only)
 * @param {string} [incomingParameters.contact_info.poc_email] - The primary point of contact's email. (Registry only)
 * @param {string} [incomingParameters.contact_info.poc_phone] - The primary point of contact's phone number. (Registry only)
 * @param {string} [incomingParameters.contact_info.org_email] - The general organization email address. (Registry only)
 * @param {string} [incomingParameters.contact_info.website] - The organization's website URL. (Registry only)
 * @param {object} [options={}] - Optional settings for the repository query.
 * @param {boolean} [isLegacyObject=false] - If true, the function returns the updated legacy organization object. Otherwise, it returns the updated registry organization object.
 *
 * @returns {Promise<object>} A promise that resolves to a plain JavaScript object representing the updated organization, stripped of internal properties and empty values.
 */
  async updateOrg (shortName, incomingParameters, options = {}, isLegacyObject = false) {
    const { deepRemoveEmpty } = require('../utils/utils')
    const OrgRepository = require('./orgRepository')
    // If we get here, we know the org exists
    const legacyOrgRepo = new OrgRepository()
    const legacyOrg = await legacyOrgRepo.findOneByShortName(shortName, options)
    const registryOrg = await this.findOneByShortName(shortName, options)

    // Both legacy and registry
    if (shortName && typeof shortName === 'string' && shortName.trim() !== '') {
      registryOrg.short_name = incomingParameters?.new_short_name ?? registryOrg.short_name
      legacyOrg.short_name = incomingParameters?.new_short_name ?? legacyOrg.short_name
    }

    registryOrg.long_name = incomingParameters?.name ?? registryOrg.long_name
    legacyOrg.name = incomingParameters?.name ?? legacyOrg.name

    // TODO: We should probably limit this so it only puts in things that we allow
    // Deal with the special way roles are added / removed
    // TODO: We are going to need to really check this, this works for single adds / removes. But Matt has some good tests that we should run.
    // TODO: What should we do if something is a CNA type, and then gets removed. Does its descriminator need to change?
    const rolesToAdd = _.flattenDeep(_.compact(_.get(incomingParameters, 'active_roles.add')))
    const rolesToRemove = _.flattenDeep(_.compact(_.get(incomingParameters, 'active_roles.remove')))
    const initialRoles = legacyOrg.authority?.active_roles ?? []
    const finalRoles = [...new Set([...initialRoles, ...rolesToAdd])].filter(role => !rolesToRemove.includes(role))
    registryOrg.authority = finalRoles
    _.set(legacyOrg, 'authority.active_roles', finalRoles)

    // Registry Only Stuff
    // Only a CNA object can have quota
    if (registryOrg.__t === 'CNAOrg') {
      registryOrg.hard_quota = incomingParameters?.id_quota ?? registryOrg.hard_quota
    }

    registryOrg.root_or_tlr = incomingParameters?.root_or_tlr ?? registryOrg.root_or_tlr
    registryOrg.charter_or_scope = incomingParameters?.charter_or_scope ?? registryOrg.charter_or_scope
    registryOrg.disclosure_policy = incomingParameters?.disclosure_policy ?? registryOrg.disclosure_policy
    registryOrg.product_list = incomingParameters?.product_list ?? registryOrg.product_list

    registryOrg.oversees = incomingParameters?.oversees ?? registryOrg.oversees
    registryOrg.reports_to = incomingParameters?.reports_to ?? registryOrg.reports_to;

    ['contact_info.poc', 'contact_info.poc_email', 'contact_info.poc_phone', 'contact_info.org_email', 'contact_info.website'].forEach(field => {
      _.set(registryOrg, field, _.get(incomingParameters, field, _.get(registryOrg, field, '')))
    })

    // legacy Only Stuff
    _.set(legacyOrg, 'policies.id_quota', (incomingParameters?.id_quota ?? legacyOrg.policies.id_quota))

    // Save changes
    await registryOrg.save({ options })
    await legacyOrg.save({ options })
    if (isLegacyObject) {
      const plainJavascriptLegacyOrg = legacyOrg.toObject()
      delete plainJavascriptLegacyOrg.__v
      delete plainJavascriptLegacyOrg._id
      return deepRemoveEmpty(plainJavascriptLegacyOrg)
    }

    const plainJavascriptRegistryOrg = registryOrg.toObject()
    // Remove private things
    delete plainJavascriptRegistryOrg.__v
    delete plainJavascriptRegistryOrg._id
    delete plainJavascriptRegistryOrg.__t
    return deepRemoveEmpty(plainJavascriptRegistryOrg)
  }

  validateOrg (org) {
    let validateObject = {}

    if (org.authority === 'ADP') {
      validateObject = ADPOrgModel.validateOrg(org)
    }
    if (org.authority === 'SECRETARIAT') {
      validateObject = SecretariatOrgModel.validateOrg(org)
    }
    // We will default to CNA if a type is not given
    if (org.authority === 'CNA' || !org.authority) {
      validateObject = CNAOrgModel.validateOrg(org)
    }

    return validateObject
  }

  async isSecretariatByShortName (shortname, options = {}, isLegacyObject = false) {
    const org = await BaseOrgModel.findOne({ short_name: shortname }, null, options)
    if (org.authority.includes('SECRETARIAT')) {
      return true
    }
    return false
  }

  isSecretariat (org, options = {}, isLegacyObject = false) {
    if (isLegacyObject) {
      return org.authority && org.authority.active_roles.includes('SECRETARIAT')
    } else {
      return org.authority && org.authority.includes('SECRETARIAT')
    }
  }

  async isBulkDownloadByShortname (orgShortname, options = {}, isLegacyObject = false) {
    const org = await BaseOrgModel.findOne({ short_name: orgShortname }, null, options)
    if (org.authority.includes('BULK_DOWNLOAD')) {
      return true
    }
    return false
  }

  isBulkDownload (org, isLegacyObject = false) {
    if (isLegacyObject) {
      return org.authority && org.authority.active_roles.includes('BULK_DOWNLOAD')
    } else {
      return org.authority && org.authority.includes('BULK_DOWNLOAD')
    }
  }

  convertLegacyToRegistry (legacyOrg) {
    let newRoles = []
    if (legacyOrg?.authority?.active_roles.includes('SECRETARIAT')) {
      newRoles.push('SECRETARIAT')
    } else {
      newRoles = legacyOrg?.authority?.active_roles
    }
    return {
      long_name: legacyOrg?.name ?? null,
      short_name: legacyOrg?.short_name ?? null,
      UUID: legacyOrg?.UUID ?? null,
      authority: newRoles || ['CNA'],
      hard_quota: legacyOrg?.policies?.id_quota ?? null,
      created: legacyOrg?.time?.created ?? null,
      last_updated: legacyOrg?.time?.modified ?? null
    }
  }

  convertRegistryToLegacy (registryOrg) {
    return {
      name: registryOrg?.long_name ?? null,
      short_name: registryOrg?.short_name ?? null,
      UUID: registryOrg?.UUID ?? null,
      authority: {
        active_roles: registryOrg?.authority || ['CNA']
      },
      policies: {
        id_quota: registryOrg?.hard_quota ?? null
      },
      time: {
        created: registryOrg?.created ?? null,
        modified: registryOrg?.modified ?? null
      }
    }
  }
}
module.exports = BaseOrgRepository
