/* eslint-disable no-unused-expressions */

const chai = require('chai')
chai.use(require('chai-http'))
const expect = chai.expect

const constants = require('../constants.js')
const app = require('../../../src/index.js')
const helpers = require('../helpers.js')
const _ = require('lodash')

const cnaContainer = require('../../schemas/cna-container/cna-container_pass.json').cnaContainer

// Parameters for the CVE-ID reservation helper
const requestLength = 1
const shortName = 'win_5'
const cveYear = '2023'
const batchType = 'non-sequential'

async function cveRequestAsCna (cveId, headers, body) {
  return await chai.request(app)
    .post(`/api/cve/${cveId}/cna`)
    .set(headers)
    .send(body)
}

describe('Testing validateTimelineDates Middleware', () => {
  let cveId
  let cnaContainerCopy

  beforeEach(async () => {
    // Reserve a custom CVE-ID
    cveId = await helpers.cveIdReserveHelper(requestLength, cveYear, shortName, batchType)
    cnaContainerCopy = _.cloneDeep(cnaContainer)
  })

  context('Positive Tests', () => {
    it('should allow valid timeline dates', async () => {
      cnaContainerCopy.timeline = [
        {
          time: '2023-10-25T00:00:00.000Z',
          lang: 'en',
          value: 'timeline'
        }
      ]

      const body = {
        cnaContainer: cnaContainerCopy
      }

      const res = await cveRequestAsCna(cveId, constants.nonSecretariatUserHeaders, body)
      expect(res).to.have.status(200)
      expect(res.body.created.containers.cna.timeline[0].time).to.equal('2023-10-25T00:00:00.000Z')
    })
  })

  context('Negative Tests', () => {
    it('should reject invalid timeline date strings', async () => {
      cnaContainerCopy.timeline = [
        {
          time: 'invalid-date',
          lang: 'en',
          value: 'timeline'
        }
      ]

      const body = {
        cnaContainer: cnaContainerCopy
      }

      const res = await cveRequestAsCna(cveId, constants.nonSecretariatUserHeaders, body)
      expect(res).to.have.status(400)
      expect(res.body.error).to.include('INVALID_JSON_SCHEMA')
    })

    it('should reject invalid timezone offsets', async () => {
      cnaContainerCopy.timeline = [
        {
          time: '2026-01-01T00:00:00.123456+25:00',
          lang: 'en',
          value: 'timeline'
        }
      ]

      const body = {
        cnaContainer: cnaContainerCopy
      }

      const res = await cveRequestAsCna(cveId, constants.nonSecretariatUserHeaders, body)
      expect(res).to.have.status(400)
      expect(res.body.error).to.include('BAD_INPUT')
      expect(res.body.details[0].msg).to.include('Invalid date string')
    })
  })
})
