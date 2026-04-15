const chai = require('chai')
chai.use(require('chai-http'))
const { expect } = chai
const { v4: uuidv4 } = require('uuid')
const AuditRepo = require('../../../src/repositories/auditRepository')

const app = require('../../../src/index.js')
const constants = require('../constants.js')

const secretariatHeaders = { ...constants.headers }
const MAX_SHORTNAME_LENGTH = 32

async function createTestOrg (customProps = {}) {
  const shortName = uuidv4().slice(0, MAX_SHORTNAME_LENGTH)
  const defaultProps = {
    short_name: shortName,
    long_name: `Test Org ${shortName}`,
    hard_quota: 1000,
    authority: ['CNA']
  }

  const orgData = { ...defaultProps, ...customProps }

  const res = await chai.request(app)
    .post('/api/registry/org')
    .set(secretariatHeaders)
    .send(orgData)

  expect(res).to.have.status(200)

  return {
    shortName: orgData.short_name,
    longName: orgData.long_name,
    uuid: res.body.created.UUID,
    fullResponse: res.body
  }
}

describe('Create and Update Audit Collection with Org Endpoints', () => {
  it('Should automatically create audit document when org is created', async () => {
    // Create org
    const org = await createTestOrg({
      hard_quota: 1500,
      authority: ['CNA']
    })

    // Verify audit was created
    const auditRes = await chai.request(app)
      .get(`/api/audit/org/${org.uuid}`)
      .set(constants.headers)

    expect(auditRes).to.have.status(200)

    // Verify audit structure
    const audit = auditRes.body
    expect(audit).to.have.property('uuid')
    expect(audit).to.have.property('target_uuid')
    expect(audit).to.have.property('history')
    expect(audit.target_uuid).to.equal(org.uuid)
    expect(audit.history).to.be.an('array').with.lengthOf(1)

    // Verify initial history entry
    const initialEntry = audit.history[0]
    expect(initialEntry).to.have.property('audit_object')
    expect(initialEntry.timestamp).to.be.a('string')
    expect(initialEntry.change_author).to.be.a('string')

    // Verify audit object matches created org
    const auditObject = initialEntry.audit_object
    expect(auditObject.short_name).to.equal(org.shortName)
    expect(auditObject.long_name).to.equal(org.longName)
    expect(auditObject.hard_quota).to.equal(1500)
    expect(auditObject.UUID).to.equal(org.uuid)
  })

  it('Should create separate audit documents for multiple orgs', async () => {
    // Create multiple orgs
    const [org1, org2, org3] = await Promise.all([
      createTestOrg({ long_name: 'First Org' }),
      createTestOrg({ long_name: 'Second Org' }),
      createTestOrg({ long_name: 'Third Org' })
    ])

    // Verify each has its own audit
    const audits = await Promise.all([
      chai.request(app).get(`/api/audit/org/${org1.uuid}`).set(constants.headers),
      chai.request(app).get(`/api/audit/org/${org2.uuid}`).set(constants.headers),
      chai.request(app).get(`/api/audit/org/${org3.uuid}`).set(constants.headers)
    ])

    // Each should have its own audit document
    audits.forEach((auditRes, index) => {
      expect(auditRes).to.have.status(200)
      const org = [org1, org2, org3][index]
      expect(auditRes.body.target_uuid).to.equal(org.uuid)
      expect(auditRes.body.history[0].audit_object.long_name).to.equal(org.longName)
    })

    // Audit UUIDs should all be different
    const auditUUIDs = audits.map(res => res.body.uuid)
    expect(new Set(auditUUIDs).size).to.equal(3)
  })

  it('Should NOT add audit entry when updating with no actual changes', async () => {
    const org = await createTestOrg({
      hard_quota: 1500,
      authority: ['CNA']
    })

    // Now update with same values
    const updateResAgain = await chai.request(app)
      .put(`/api/registry/org/${org.shortName}`)
      .set(secretariatHeaders)
      .send({
        short_name: org.shortName,
        hard_quota: 1500,
        authority: ['CNA'],
        long_name: org.longName
      })
    expect(updateResAgain).to.have.status(200)
    expect(updateResAgain.body.updated.long_name).to.equal(org.longName)

    // Check audit history
    const auditRes = await chai.request(app)
      .get(`/api/audit/org/${org.uuid}`)
      .set(constants.headers)

    expect(auditRes.body.history).to.have.lengthOf(2)
  })

  it('Should add audit entry when single field is changed', async () => {
    const testOrg = await createTestOrg({
      hard_quota: 1500,
      authority: ['CNA']
    })

    // Update org name
    const updateRes = await chai.request(app)
      .put(`/api/registry/org/${testOrg.shortName}`)
      .set(secretariatHeaders)
      .send({
        long_name: testOrg.longName,
        short_name: testOrg.shortName,
        authority: ['CNA'],
        hard_quota: 100
      })

    expect(updateRes).to.have.status(200)

    // Check audit history
    const auditRes = await chai.request(app)
      .get(`/api/audit/org/${testOrg.shortName}`)
      .set(constants.headers)

    expect(auditRes.body.history).to.have.lengthOf(2)

    // Original entry
    expect(auditRes.body.history[0].audit_object.hard_quota).to.equal(1500)

    // New entry
    expect(auditRes.body.history[1].audit_object.hard_quota).to.equal(100)
  })

  it('Should maintain chronological order in audit history', async () => {
    const testOrg = await createTestOrg({
      hard_quota: 1500,
      authority: ['CNA']
    })
    // Make sequential updates
    const updatedRes1 = await chai.request(app)
      .put(`/api/registry/org/${testOrg.shortName}`)
      .set(secretariatHeaders)
      .send({
        short_name: testOrg.shortName,
        long_name: testOrg.longName,
        authority: ['CNA'],
        hard_quota: 2000
      })
    expect(updatedRes1).to.have.status(200)

    const updatedRes2 = await chai.request(app)
      .put(`/api/registry/org/${testOrg.shortName}`)
      .set(secretariatHeaders)
      .send({
        short_name: testOrg.shortName,
        long_name: testOrg.longName,
        authority: ['CNA'],
        hard_quota: 3000
      })
    expect(updatedRes2).to.have.status(200)

    const updatedRes3 = await chai.request(app)
      .put(`/api/registry/org/${testOrg.shortName}`)
      .set(secretariatHeaders)
      .send({
        short_name: testOrg.shortName,
        long_name: testOrg.longName,
        authority: ['CNA'],
        hard_quota: 4000
      })
    expect(updatedRes3).to.have.status(200)
    // Check audit history
    const auditRes = await chai.request(app)
      .get(`/api/audit/org/${testOrg.uuid}`)
      .set(constants.headers)

    expect(auditRes.body.history).to.have.lengthOf(4)

    // Verify chronological order
    const quotas = auditRes.body.history.map(h => h.audit_object.hard_quota)
    expect(quotas).to.deep.equal([1500, 2000, 3000, 4000])

    // Verify timestamps are in order
    for (let i = 1; i < auditRes.body.history.length; i++) {
      const prev = new Date(auditRes.body.history[i - 1].timestamp)
      const curr = new Date(auditRes.body.history[i].timestamp)
      expect(curr.getTime()).to.be.greaterThan(prev.getTime())
    }
  })

  it('Should create an audit when updating an Org if it does not exist', async () => {
    const testOrg = await createTestOrg({
      hard_quota: 1500,
      authority: ['CNA']
    })
    // Manually delete audit document
    const repo = new AuditRepo()
    await repo.deleteByTargetUUID(testOrg.uuid)
    // Check audit history
    const auditRes = await chai.request(app)
      .get(`/api/audit/org/${testOrg.uuid}`)
      .set(constants.headers)
    expect(auditRes).to.have.status(404)
    // Now update org to trigger audit creation
    const updateRes = await chai.request(app)
      .put(`/api/registry/org/${testOrg.shortName}`)
      .set(secretariatHeaders)
      .send({
        short_name: testOrg.shortName,
        long_name: testOrg.longName,
        authority: ['CNA'],
        hard_quota: 2500
      })
    expect(updateRes).to.have.status(200)
    // Check audit history
    const auditResCreation = await chai.request(app)
      .get(`/api/audit/org/${testOrg.uuid}`)
      .set(constants.headers)
    // Should have 2 entries: initial creation of current org object + new update
    expect(auditResCreation.body.history).to.have.lengthOf(2)
  })
})
