/* eslint-disable no-unused-expressions */

const chai = require('chai')
chai.use(require('chai-http'))

const expect = chai.expect

const constants = require('../constants.js')
const app = require('../../../src/index.js')

const body = {
  username: 'adpUser',
  active: 'true',
  name: {
    first: 'TestCnaAdmin',
    last: 'test',
    middle: 'N',
    suffix: 'I'
  },
  authority: {
    active_roles: ['Admin']
  }
}

const registryBody = {
  username: 'adpUser2',
  active: 'true',
  name: {
    first: 'SecondTestCnaAdmin',
    last: 'test',
    middle: 'N',
    suffix: 'I'
  },
  authority: {
    active_roles: ['Admin']
  }
}

const nonAdminBody = {
  username: 'nonAdminUser',
  active: 'true',
  name: {
    first: 'TestCnaAdmin',
    last: 'test',
    middle: 'N',
    suffix: 'I'
  },
  authority: {
  }
}

const registryNonAdminBody = {
  username: 'nonAdminUser2',
  active: 'true',
  name: {
    first: 'SecondTestCnaAdmin',
    last: 'test',
    middle: 'N',
    suffix: 'I'
  },
  authority: {
  }
}

describe('Testing create user endpoint', () => {
  it('Should return 200 and new user', (done) => {
    chai.request(app)
      .post('/api/org/range_4/user')
      .set(constants.headers)
      .send(body)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res.body).to.have.property('created')
        expect(res.body.created.username).to.equal(body.username)
        expect(res).to.have.status(200)
        done()
      })
  })
  it('Should return 200 and new user with registry enabled', (done) => {
    chai.request(app)
      .post('/api/registry/org/range_4/user')
      .set(constants.headers)
      .send(registryBody)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res.body).to.have.property('created')
        expect(res.body.created.username).to.equal(registryBody.username)
        expect(res).to.have.status(200)
        done()
      })
  })
  it('Should return 200 and create a non admin user', (done) => {
    chai.request(app)
      .post('/api/org/range_4/user')
      .set(constants.headers)
      .send(nonAdminBody)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res.body).to.have.property('created')
        expect(res.body.created.username).to.equal(nonAdminBody.username)
        expect(res).to.have.status(200)
        done()
      })
  })
  it('Should return 200 and create a non admin user with registry enabled', (done) => {
    chai.request(app)
      .post('/api/registry/org/range_4/user')
      .set(constants.headers)
      .send(registryNonAdminBody)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res.body).to.have.property('created')
        expect(res.body.created.username).to.equal(registryNonAdminBody.username)
        expect(res).to.have.status(200)
        done()
      })
  })
})
