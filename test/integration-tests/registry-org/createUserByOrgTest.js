/* eslint-disable no-unused-expressions */

const chai = require('chai')
chai.use(require('chai-http'))

const expect = chai.expect

const constants = require('../constants.js')
const app = require('../../../src/index.js')

describe('Testing POST /api/registryOrg/:shortname/user endpoint', () => {
  // Positive test
  it('Should create a new user in an organization', (done) => {
    const orgShortName = 'mitre'
    const newUser = {
      username: 'testuser@example.com',
      name: {
        first: 'Test',
        last: 'User'
      },
      role: 'ADMIN'
    }

    chai.request(app)
      .post(`/api/registryOrg/${orgShortName}/user`)
      .set(constants.headers)
      .send(newUser)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res).to.have.status(200)
        expect(res.body).to.have.property('message').equal(`${newUser.username} was successfully created.`)
        expect(res.body).to.have.property('created')
        expect(res.body.created).to.have.property('username', newUser.username)
        expect(res.body.created).to.have.property('secret')
        done()
      })
  })

  // Negative test: Organization does not exist
  it('Should not create a user in a non-existent organization', (done) => {
    const orgShortName = 'nonexistentorg'
    const newUser = {
      username: 'testuser2@example.com',
      name: {
        first: 'Test',
        last: 'User'
      }
    }

    chai.request(app)
      .post(`/api/registryOrg/${orgShortName}/user`)
      .set(constants.headers)
      .send(newUser)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res).to.have.status(404)
        expect(res.body).to.have.property('message').equal(`The '${orgShortName}' organization designated by the shortname path parameter does not exist.`)
        done()
      })
  })

  // Negative test: User already exists
  it('Should not create a user that already exists', (done) => {
    const orgShortName = 'mitre'
    const existingUser = {
      username: 'testuser@example.com',
      name: {
        first: 'Test',
        last: 'User'
      }
    }

    chai.request(app)
      .post(`/api/registryOrg/${orgShortName}/user`)
      .set(constants.headers)
      .send(existingUser)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res).to.have.status(400)
        expect(res.body).to.have.property('message').equal(`The user '${existingUser.username}' already exists.`)
        done()
      })
  })

  // Negative test: Validation error (missing username)
  it('Should not create a user with a missing username', (done) => {
    const orgShortName = 'mitre'
    const invalidUser = {
      name: {
        first: 'Test',
        last: 'User'
      }
    }

    chai.request(app)
      .post(`/api/registryOrg/${orgShortName}/user`)
      .set(constants.headers)
      .send(invalidUser)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res).to.have.status(400)
        expect(res.body).to.have.property('message').equal('Parameters were invalid')
        done()
      })
  })
})
