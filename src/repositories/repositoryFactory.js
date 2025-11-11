const OrgRepository = require('./orgRepository')
const CveRepository = require('./cveRepository')
const CveIdRepository = require('./cveIdRepository')
const CveIdRangeRepository = require('./cveIdRangeRepository')
const UserRepository = require('./userRepository')
const RegistryUserRepository = require('./registryUserRepository')
const RegistryOrgRepository = require('./registryOrgRepository')
const BaseOrgRepository = require('./baseOrgRepository')
const BaseUserRepository = require('./baseUserRepository')

class RepositoryFactory {
  getOrgRepository () {
    const repo = new OrgRepository()
    return repo
  }

  getCveRepository () {
    const repo = new CveRepository()
    return repo
  }

  getCveIdRepository () {
    const repo = new CveIdRepository()
    return repo
  }

  getCveIdRangeRepository () {
    const repo = new CveIdRangeRepository()
    return repo
  }

  getUserRepository () {
    const repo = new UserRepository()
    return repo
  }

  getRegistryUserRepository () {
    const repo = new RegistryUserRepository()
    return repo
  }

  getRegistryOrgRepository () {
    const repo = new RegistryOrgRepository()
    return repo
  }

  getBaseOrgRepository () {
    const repo = new BaseOrgRepository()
    return repo
  }

  getBaseUserRepository () {
    const repo = new BaseUserRepository()
    return repo
  }
}

module.exports = RepositoryFactory
