/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */
const chai = require('chai')
const sinon = require('sinon')
const { faker } = require('@faker-js/faker')
const expect = chai.expect
const mongoose = require('mongoose')

const { ORG_CREATE_SINGLE } = require('../../../src/controller/org.controller/org.controller.js')
const CONSTANTS = require('../../../src/constants/index.js')
const BaseOrgRepository = require('../../../src/repositories/baseOrgRepository.js')
const BaseUserRepository = require('../../../src/repositories/baseUserRepository.js')

const stubAdpOrg = {
  short_name: 'adpOrg',
  name: 'test_adp',
  authority: {
    active_roles: [
      'ADP'
    ]
  },
  policies: {
    id_quota: 200
  }
}

const stubAdpCnaOrg = {
  short_name: 'cnaAdpOrg',
  name: 'testCnaAdp',
  authority: {
    active_roles: [
      'ADP',
      'CNA'
    ]
  },
  policies: {
    id_quota: 200
  }
}

describe('Testing creating orgs with the ADP role', () => {
  let status, json, res, next, getOrgRepository, regOrgRepo, getUserRepository, getBaseOrgRepository,
    updateOrg, updateRegOrg, userRegistryRepo, getBaseUserRepository, mockSession

  beforeEach(() => {
    status = sinon.stub()
    json = sinon.spy()
    res = { json, status }
    next = sinon.spy()
    status.returns(res)

    // --- Mongoose Session Stubbing ---
    mockSession = {
      startTransaction: sinon.stub(),
      commitTransaction: sinon.stub().resolves(),
      abortTransaction: sinon.stub().resolves(),
      endSession: sinon.stub().resolves()
    }
    sinon.stub(mongoose, 'startSession').returns(Promise.resolve(mockSession))

    // --- Repository Stubbing ---
    regOrgRepo = new BaseOrgRepository()
    getBaseOrgRepository = sinon.stub().returns(regOrgRepo)

    userRegistryRepo = new BaseUserRepository()
    getBaseUserRepository = sinon.stub().returns(userRegistryRepo)

    // --- Method Stubbing --
    sinon.stub(regOrgRepo, 'findOneByShortName').resolves(null)
    sinon.stub(regOrgRepo, 'isSecretariatByShortName').resolves(true)

    // Stub aggregate to return an array with a fake object, so result[0] works
    const fakeAggregatedOrg = { UUID: 'org-uuid-123', short_name: 'fakeOrg', name: 'Fake Org Name' }
    sinon.stub(regOrgRepo, 'aggregate').resolves([fakeAggregatedOrg])

    // Stub UUID getters to resolve with fake UUIDs
    sinon.stub(regOrgRepo, 'getOrgUUID').resolves('org-uuid-123')
    sinon.stub(userRegistryRepo, 'getUserUUID').resolves('user-uuid-123')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('Should return newly created org with id_quota of 0 and ADP role', async () => {
    const req = {
      ctx: {
        uuid: faker.datatype.uuid(),
        repositories: {
          getBaseOrgRepository,
          getBaseUserRepository
        },
        body: {
          ...stubAdpOrg
        }
      }
    }

    const temp = stubAdpOrg
    temp.policies.id_quota = 0
    sinon.stub(regOrgRepo, 'createOrg').resolves(temp)
    await ORG_CREATE_SINGLE(req, res, next)
    expect(status.args[0][0]).to.equal(200)
    expect(json.args[0][0].created.policies.id_quota).to.equal(0)
    expect(json.args[0][0].created.authority.active_roles[0]).to.equal('ADP')
    expect(mockSession.commitTransaction.calledOnce).to.be.true
    expect(mockSession.endSession.calledOnce).to.be.true
  })
})
