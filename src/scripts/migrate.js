/**
 * migrate.js
 *
 * This script is intended to be used to migrate existing user and org data into the UserRegistry.
 * This will need to be modified if intended to run against databases that did not originally have the same data.
 *
 * Before running this, the remote database ports must be forwarded to local ports.
 */

require('dotenv').config()
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')
const dbConnStr = process.env.MONGO_CONN_STRING

const rawData = fs.readFileSync(path.join(__dirname, 'CNAlist.json'))

const cnaList = JSON.parse(rawData)
const cveBoardUUID = uuidv4()
let allUsers
let allOrgs
let mitreUUID

async function run () {
  const dbClient = new MongoClient(dbConnStr)
  try {
    // Initialize connection to both DocDBs
    await dbClient.connect()

    // Get connection to specific DB within each DocDB
    const db = await dbClient.db(process.env.MONGO_DB_NAME)

    // Get all users
    const usersCursor = db.collection('User').find()
    allUsers = await usersCursor.toArray()

    // Add the CVE Board as an org
    // await addCVEBoard(db)

    // Get UUIDs for MITRE and the CVE Board
    const orgsCursor = db.collection('Org').find()
    allOrgs = await orgsCursor.toArray()
    mitreUUID = allOrgs.filter(org => org.short_name === 'mitre')[0].UUID

    // Each helper handlers querying changes from srcDB and updating trgDB
    await orgHelper(db)
    await userHelper(db)
  } catch (err) {
    // Ensures that the client will close when you finish/error
    await dbClient.close()

    console.error(err)
  } finally {
    // Ensures that the client will close when you finish/error
    await dbClient.close()
  }
}

run()

// eslint-disable-next-line no-unused-vars
async function addCVEBoard (db) {
  console.log('Adding CVE Board...')
  const trgOrgCol = await db.collection('BaseOrg')

  // Upsert will create new org record if one doesn't exist
  const options = { upsert: true }

  const trgQuery = {
    short_name: 'cve_board'
  }

  // Doc to update existing org record, or to be created
  const updateDoc = {
    $set: {
      UUID: cveBoardUUID,
      long_name: 'CVE Board',
      short_name: 'cve_board',
      aliases: [],
      authority: null,
      reports_to: null,
      oversees: [mitreUUID],
      root_or_tlr: true,
      users: null,
      charter_or_scope: null,
      disclosure_policy: null,
      product_list: null,
      soft_quota: null,
      hard_quota: null,
      contact_info: {
        additional_contact_users: [],
        poc: null,
        poc_email: null,
        poc_phone: null,
        admins: [],
        org_email: null,
        website: null
      },
      inUse: null,
      created: null,
      last_updated: null
    }
  }

  await trgOrgCol.updateOne(trgQuery, updateDoc, options)
}

async function orgHelper (db) {
  console.log('Running Org sync...')
  const trgOrgCol = await db.collection('BaseOrg')

  // Upsert will create new org record if one doesn't exist
  const options = { upsert: true }

  let trgQuery
  let updateDoc

  for (const doc of allOrgs) {
    // Query to match cve-id in target DB
    trgQuery = {
      short_name: doc.short_name
    }

    // Find associated information within the CNA List
    let currentCNA

    for (const cna of cnaList) {
      if (doc.short_name === cna.shortName) {
        currentCNA = cna
      }
    }

    // Find associated users with the Org
    const orgUsers = []

    for (const user of allUsers) {
      if (user.org_UUID === doc.UUID) {
        orgUsers.push(user.UUID)
      }
    }

    // Establish hierarchy of orgs
    const parent = null
    const children = []
    // if (doc.short_name.toLowerCase().includes('mitre')) {
    //   parent = cveBoardUUID
    // } else {
    //   parent = mitreUUID
    // }

    // Set root_or_tlr, charter_or_scope, disclosure_policy, org_email, website
    let rootTlr = false
    let charterScope = null
    let disclosure = null
    let email = null
    let site = null

    if (currentCNA) {
      // Pull from the CNA object
      rootTlr = Object.hasOwn(currentCNA, 'CNA') ? currentCNA.CNA.isRoot : false
      charterScope = Object.hasOwn(currentCNA, 'scope') ? currentCNA.scope : null
      disclosure = Object.hasOwn(currentCNA, 'disclosurePolicy') ? currentCNA.disclosurePolicy : null
      email = currentCNA.contact[0].email.length > 0 ? currentCNA.contact[0].email[0].emailAddr : null
      site = currentCNA.contact[0].contact.length > 0 ? currentCNA.contact[0].contact[0].url : null
    }
    // Doc to update existing org record, or to be created

    let type = 'CNAOrg'
    if (doc.short_name.toLowerCase().includes('mitre')) { type = 'SECRETARIAT' }
    updateDoc = {
      $set: {
        UUID: doc.UUID,
        __t: type,
        long_name: doc.name,
        short_name: doc.short_name,
        aliases: [], // don't have now
        authority: doc.authority.active_roles,
        reports_to: parent,
        oversees: children,
        root_or_tlr: rootTlr,
        users: orgUsers,
        charter_or_scope: charterScope,
        disclosure_policy: disclosure,
        product_list: null, // don't have now
        soft_quota: null, // don't have now
        hard_quota: doc.policies?.id_quota,
        contact_info: {
          additional_contact_users: [], // don't have now
          poc: null, // don't have now
          poc_email: null, // don't have now
          poc_phone: null, // don't have now
          admins: [], // don't have now
          org_email: email,
          website: site
        },
        inUse: doc.inUse,
        created: doc.time.created,
        last_updated: doc.time.modified
      }
    }
    await trgOrgCol.updateOne(trgQuery, updateDoc, options)
  }
}

async function userHelper (db) {
  console.log('Running User sync...')
  const trgUserCol = await db.collection('BaseUser')

  // Upsert will create new org record if one doesn't exist
  const options = { upsert: true }

  let trgQuery
  let updateDoc

  for (const doc of allUsers) {
    // Query to match user UUID in target DB
    trgQuery = {
      UUID: doc.UUID
    }

    // Doc to update existing user record, or to be created
    updateDoc = {
      $set: {
        UUID: doc.UUID,
        username: doc.username,
        secret: doc.secret,
        name: doc.name,
        created: doc.time.created,
        created_by: 'system',
        last_updated: doc.time.modified,
        last_active: null
      }
    }

    await trgUserCol.updateOne(trgQuery, updateDoc, options)
  }
}
