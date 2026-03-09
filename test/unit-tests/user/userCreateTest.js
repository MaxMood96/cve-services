
const sinon = require('sinon')
const chai = require('chai')
const expect = chai.expect
const { faker } = require('@faker-js/faker')
const mongoose = require('mongoose')
const argon2 = require('argon2')

const { USER_CREATE_SINGLE } = require('../../../src/controller/org.controller/org.controller')
const BaseOrgRepository = require('../../../src/repositories/baseOrgRepository.js')
const RegistryUserModel = require('../../../src/model/registryuser.js')
const BaseOrg = require('../../../src/model/baseorg.js')
const BaseUserRepository = require('../../../src/repositories/baseUserRepository.js')
const BaseUser = require('../../../src/model/baseuser.js')
const UserRepository = require('../../../src/repositories/userRepository.js')

const stubOrgUUID = faker.datatype.uuid()
const stubUserUUID = faker.datatype.uuid()

const stubOrg = {
  short_name: 'stubOrg',
  name: 'test_user',
  UUID: stubOrgUUID,
  authority: {
    active_roles: ['ADMIN', 'CNA']
  }
}
const fakeBaseUserSavedObject = {
  username: 'test_user',
  secret: 'test_secret',
  role: 'Admin',
  UUID: stubUserUUID
}
const fakeLegacySavedObject = {
  short_name: 'mitre',
  name: 'The MITRE Corporation',
  authority: {
    active_roles: [
      'CNA',
      'SECRETARIAT'
    ]
  },
  policies: {
    id_quota: 1000
  }
}
const stubUser = {
  username: 'stubUser'
  // org_UUID: stubOrgUUID
}

const fakeUserMongooseDocument = new BaseUser(fakeBaseUserSavedObject)
const fakeOrgMongooseDocument = new BaseOrg(fakeLegacySavedObject)

// eslint-disable-next-line mocha/no-skipped-tests
describe('Testing the POST /org/:shortname/user endpoint in Org Controller', () => {
  let status, json, res, next, mockSession, baseOrgRepo, getBaseOrgRepository, baseUserRepo, getBaseUserRepository, req, userRepo, getUserRepository

  beforeEach(() => {
    status = sinon.stub()
    json = sinon.spy()
    res = { json, status }
    next = sinon.spy()
    status.returns(res)

    // Stub Mongoose session methods
    mockSession = {
      startTransaction: sinon.stub(),
      commitTransaction: sinon.stub().resolves(),
      abortTransaction: sinon.stub().resolves(),
      endSession: sinon.stub().resolves()
    }
    sinon.stub(mongoose, 'startSession').resolves(mockSession)

    baseOrgRepo = new BaseOrgRepository()
    getBaseOrgRepository = sinon.stub().returns(baseOrgRepo)
    baseUserRepo = new BaseUserRepository()
    getBaseUserRepository = sinon.stub().returns(baseUserRepo)
    userRepo = new UserRepository()
    getUserRepository = sinon.stub().returns(userRepo)

    req = {
      ctx: {
        org: stubOrg.short_name,
        uuid: stubOrg.UUID,
        params: {
          shortname: stubOrg.short_name
        },
        repositories: {
          getBaseOrgRepository,
          getBaseUserRepository,
          getUserRepository
        },
        body: {
          ...stubUser
        }
      }
    }
  })
  afterEach(() => {
    sinon.restore()
  })
  context('Positive Tests', () => {
    it('User is created', async () => {
      sinon.stub(baseUserRepo, 'orgHasUser').resolves(false)
      sinon.stub(baseUserRepo, 'isAdminOrSecretariat').resolves(true)
      sinon.stub(baseOrgRepo, 'getOrgUUID').resolves(true)
      sinon.stub(argon2, 'hash').resolves('hashedPassword')
      sinon.stub(BaseOrgRepository.prototype, 'findOneByShortName').resolves(fakeOrgMongooseDocument)
      sinon.stub(baseUserRepo, 'findUsersByOrgShortname').resolves([fakeUserMongooseDocument])
      sinon.stub(RegistryUserModel.prototype, 'save').resolves(fakeBaseUserSavedObject)
      // stub the prototype since createUser in baseUserRepository creates a new internal instance of the legacy UserRepository
      sinon.stub(UserRepository.prototype, 'updateByUserNameAndOrgUUID').resolves(fakeUserMongooseDocument)

      await USER_CREATE_SINGLE(req, res, next)
      expect(status.args[0][0]).to.equal(200)
      expect(res.json.args[0][0].message).contains('was successfully created')
    })
  })
  context('Negitive tests', () => {
    it('User Fails to be created because not in the same org', async () => {
      sinon.stub(baseUserRepo, 'orgHasUser').resolves(false)
      sinon.stub(baseUserRepo, 'isAdminOrSecretariat').resolves(false)
      sinon.stub(baseOrgRepo, 'getOrgUUID').resolves(true)
      req.ctx.org = 'FakeShortName'
      await USER_CREATE_SINGLE(req, res, next)
      expect(status.args[0][0]).to.equal(403)
      expect(res.json.args[0][0].error).contains('NOT_ORG_ADMIN_OR_SECRETARIAT')
    })
  })
})
