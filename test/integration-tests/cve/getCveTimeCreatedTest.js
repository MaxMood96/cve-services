/* eslint-disable no-unused-expressions */

const chai = require('chai')
chai.use(require('chai-http'))
const expect = chai.expect

const constants = require('../constants.js')
const app = require('../../../src/index.js')
const helpers = require('../helpers.js')
const _ = require('lodash')

const shortName = 'win_5'

describe('Test time_created parameter for get CVE', () => {
  let cveId
  before(async () => {
    cveId = await helpers.cveIdReserveHelper(1, '2023', shortName, 'non-sequential')
    await helpers.cveRequestAsCnaHelper(cveId)
  })
  context('Positive Test', () => {
    it('Get CVE with time_created.gt set to a known earlier date', async () => {
      await chai.request(app)
        .get('/api/cve/?time_created.gt=2022-01-01T00:00:00Z')
        .set(constants.headers)
        .then((res, err) => {
          expect(err).to.be.undefined
          expect(res).to.have.status(200)
          expect(_.some(res.body.cveRecords, { cveMetadata: { cveId: cveId } })).to.be.true
        })
    })
    it('Get CVE with time_created.gt should return and empty list when searched with a known bad earlier than date', async () => {
      await chai.request(app)
        .get('/api/cve/?time_created.gt=2100-01-01T00:00:00Z')
        .set(constants.headers)
        .then((res, err) => {
          expect(err).to.be.undefined
          expect(res).to.have.status(200)
          expect(_.some(res.body.cveRecords, { cveMetadata: { cveId: cveId } })).to.be.false
        })
    })

    it('Get CVE with time_created.lt should return when searched with a known later than date', async () => {
      await chai.request(app)
        .get('/api/cve/?time_created.lt=2100-01-01T00:00:00Z')
        .set(constants.headers)
        .then((res, err) => {
          expect(err).to.be.undefined
          expect(res).to.have.status(200)
          expect(_.some(res.body.cveRecords, { cveMetadata: { cveId: cveId } })).to.be.true
        })
    })
    it('Get CVE with time_created.lt should return and empty list when searched with a known bad later than date', async () => {
      await chai.request(app)
        .get('/api/cve/?time_created.lt=2022-01-01T00:00:00Z')
        .set(constants.headers)
        .then((res, err) => {
          expect(err).to.be.undefined
          expect(res).to.have.status(200)
          expect(_.some(res.body.cveRecords, { cveMetadata: { cveId: cveId } })).to.be.false
        })
    })
    it('Get CVE with time_created.lt and gt set', async () => {
      await chai.request(app)
        .get('/api/cve/?time_created.lt=2100-01-01T00:00:00Z&time_created.gt=2022-01-01T00:00:00Z')
        .set(constants.headers)
        .then((res, err) => {
          expect(err).to.be.undefined
          expect(res).to.have.status(200)
          expect(_.some(res.body.cveRecords, { cveMetadata: { cveId: cveId } })).to.be.true
        })
    })
  })
})
