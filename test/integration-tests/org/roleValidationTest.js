
const chai = require('chai')
const chaiHttp = require('chai-http')
const app = require('../../../src/index') // Adjust path as needed
const constants = require('../constants.js')
const expect = chai.expect

chai.use(chaiHttp)

// This test assumes a running server or proper mock setup usually handled by the test runner.
// For simplicity in this environment, we'll piggyback on existing integration test structures or
// use a very targeted unit/repo test data if we were mocking capable.
// Given strict restriction, I will create a test that can be run with `npm test` assuming the environment handles DB.

describe('BaseOrgRepository Role Validation', () => {
  // We need a known org to test against. 'mitre' usually exists in seed data.
  const orgShortName = 'mitre'

  it('should NOT add invalid roles to an organization', async () => {
    const res = await chai.request(app)
      .put(`/api/org/${orgShortName}?active_roles.add=INVALID_ROLE_XXX`)
      .set(constants.headers)

    // We expect 200 OK because we decided to filter out invalid values silently,
    // OR 400 if validation strictness was elsewhere.
    // Based on current code, it accepts arbitrary strings.
    // The fix will make it ignore them.

    expect(res).to.have.status(200)
    expect(res.body.updated.authority.active_roles).to.not.include('INVALID_ROLE_XXX')
  })

  it('should add valid roles to an organization', async () => {
    // Setup: assume MITRE is CNA. Let's try to add ROOT_CNA if not present, or just ensure it accepts valid enums.
    // CONSTANTS.AUTH_ROLE_ENUM.ROOT_CNA
    const validRole = 'ROOT_CNA'

    const res = await chai.request(app)
      .put(`/api/org/${orgShortName}?active_roles.add=${validRole}`)
      .set(constants.headers)

    expect(res).to.have.status(200)
    expect(res.body.updated.authority.active_roles).to.include(validRole)
  })
})
