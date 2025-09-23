/* eslint-disable no-unused-expressions */

const chai = require('chai')
const sinon = require('sinon')
const { faker } = require('@faker-js/faker')
const expect = chai.expect

const OrgRepository = require('../../../src/repositories/orgRepository.js')
const { onlyOrgWithPartnerRole } = require('../../../src/middleware/middleware.js')
const errors = require('../../../src/middleware/error.js')
const BaseOrgRepository = require('../../../src/repositories/baseOrgRepository.js')
const BaseUserRepository = require('../../../src/repositories/baseUserRepository.js')
const error = new errors.MiddlewareError()

const stubAdpOrg = {
  short_name: 'adpOrg',
  name: 'test_adp',
  UUID: faker.datatype.uuid(),
  authority: {
    active_roles: [
      'ADP'
    ]
  }
}

const stubCnaOrg = {
  short_name: 'cnaOrg',
  name: 'test_cna',
  UUID: faker.datatype.uuid(),
  authority: {
    active_roles: [
      'CNA'
    ]
  }
}

const stubBulkDownloadOrg = {
  short_name: 'bdOrg',
  name: 'test_bd',
  UUID: faker.datatype.uuid(),
  authority: {
    active_roles: [
      'BULK_DOWNLOAD'
    ]
  }
}

const stubOrgNoRole = {
  short_name: 'NoRole',
  name: 'test_org',
  UUID: faker.datatype.uuid(),
  authority: {
    active_roles: []
  }
}

const stubSecretariat = {
  short_name: 'secOrg',
  name: 'test_sec',
  UUID: faker.datatype.uuid(),
  authority: {
    active_roles: [
      'SECRETARIAT'
    ]
  }
}

describe('Testing onlyOrgWithPartnerRole middleware', () => {
  let status, json, res, next, getOrgRepository, baseUserRepo, baseOrgRepo, getBaseOrgRepository, getBaseUserRepository, orgRepo
  beforeEach(() => {
    status = sinon.stub()
    json = sinon.spy()
    res = { json, status }
    next = sinon.spy()
    status.returns(res)
    orgRepo = new OrgRepository()
    getOrgRepository = sinon.stub()
    getOrgRepository.returns(orgRepo)

    baseOrgRepo = new BaseOrgRepository()
    getBaseOrgRepository = sinon.stub()
    getBaseOrgRepository.returns(baseOrgRepo)

    baseUserRepo = new BaseUserRepository()
    getBaseUserRepository = sinon.stub()
    getBaseUserRepository.returns(baseUserRepo)
  })
  context('Negative Tests', () => {
    it('Should return 403 for users from orgs without a partner role ', async () => {
      const req = {
        ctx: {
          org: stubBulkDownloadOrg.short_name,
          uuid: stubBulkDownloadOrg.UUID,
          repositories: {
            getOrgRepository,
            getBaseOrgRepository,
            getBaseUserRepository
          }
        }
      }
      const stub = sinon.stub(baseOrgRepo, 'findOneByShortName').returns(stubBulkDownloadOrg)

      await onlyOrgWithPartnerRole(req, res, next)
      expect(stub.calledOnce).to.be.true
      expect(status.calledOnce).to.be.true
      expect(status.args[0][0]).to.equal(403)
      expect(res.json.args[0][0].error).to.equal(error.orgHasNoPartnerRole().error)
    })
    it('Should return 403 for users from orgs without a role ', async () => {
      const req = {
        ctx: {
          org: stubOrgNoRole.short_name,
          uuid: stubOrgNoRole.UUID,
          repositories: {
            getOrgRepository,
            getBaseOrgRepository
          }
        }
      }
      const stub = sinon.stub(baseOrgRepo, 'findOneByShortName').returns(stubOrgNoRole)

      await onlyOrgWithPartnerRole(req, res, next)
      expect(stub.calledOnce).to.be.true
      expect(status.calledOnce).to.be.true
      expect(status.args[0][0]).to.equal(403)
      expect(res.json.args[0][0].error).to.equal(error.orgHasNoPartnerRole().error)
    })

    it('Should return 404 if the requester org does not exist', async () => {
      const req = {
        ctx: {
          org: stubCnaOrg.short_name,
          uuid: stubCnaOrg.UUID,
          repositories: {
            getOrgRepository,
            getBaseOrgRepository
          }
        }
      }
      const stub = sinon.stub(baseOrgRepo, 'findOneByShortName').returns(null)

      await onlyOrgWithPartnerRole(req, res, next)
      expect(stub.calledOnce).to.be.true
      expect(status.calledOnce).to.be.true
      expect(status.args[0][0]).to.equal(404)
      expect(res.json.args[0][0].error).to.equal(error.orgDoesNotExist(stubCnaOrg.short_name).error)
    })
  })

  context('Positive Tests', () => {
    it('Should allow orgs with ADP partner role through by calling next()  ', async () => {
      const req = {
        ctx: {
          org: stubAdpOrg.short_name,
          uuid: stubAdpOrg.UUID,
          repositories: {
            getOrgRepository,
            getBaseOrgRepository
          }
        }
      }
      const stub = sinon.stub(baseOrgRepo, 'findOneByShortName').returns(stubAdpOrg)

      await onlyOrgWithPartnerRole(req, res, next)
      expect(stub.calledOnce).to.be.true
      expect(status.calledOnce).to.be.false
      expect(next.calledOnce).to.be.true
    })
    it('Should allow orgs with CNA partner role through by calling next()  ', async () => {
      const req = {
        ctx: {
          org: stubCnaOrg.short_name,
          uuid: stubCnaOrg.UUID,
          repositories: {
            getOrgRepository,
            getBaseOrgRepository
          }
        }
      }
      const stub = sinon.stub(baseOrgRepo, 'findOneByShortName').returns(stubCnaOrg)

      await onlyOrgWithPartnerRole(req, res, next)
      expect(stub.calledOnce).to.be.true
      expect(status.calledOnce).to.be.false
      expect(next.calledOnce).to.be.true
    })
    it('Should allow orgs with Secretariat role through by calling next()  ', async () => {
      const req = {
        ctx: {
          org: stubSecretariat.short_name,
          uuid: stubSecretariat.UUID,
          repositories: {
            getOrgRepository,
            getBaseOrgRepository
          }
        }
      }
      const stub = sinon.stub(baseOrgRepo, 'findOneByShortName').returns(stubSecretariat)

      await onlyOrgWithPartnerRole(req, res, next)
      expect(stub.calledOnce).to.be.true
      expect(status.calledOnce).to.be.false
      expect(next.calledOnce).to.be.true
    })
  })
})
