// Filename: initMongoReplicaSet.js
// Purpose: Initiates a MongoDB replica set on a mongod instance
//          that was started with the --replSet option.
// Uses directConnection=true for the initial connection to simplify
// connecting to a node that is not yet part of an initialized replica set.

const { MongoClient } = require('mongodb')

// Configuration
const MONGODB_HOST_IP = '127.0.0.1' // Explicitly use 127.0.0.1
const MONGODB_PORT = '27017'
// Added ?directConnection=true to the URI
const MONGODB_URI = `mongodb://${MONGODB_HOST_IP}:${MONGODB_PORT}/admin?directConnection=true`
const REPLICA_SET_NAME = 'rs0' // Must match the --replSet name used when starting mongod
const HOST_ADDRESS = `${MONGODB_HOST_IP}:${MONGODB_PORT}` // The address of this mongod instance
const SERVER_SELECTION_TIMEOUT_MS = 35000 // Slightly increased timeout

async function initiateReplicaSet () {
  // serverSelectionTimeoutMS might be less relevant with directConnection=true, but kept for consistency
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS })

  try {
    console.log(`Attempting to connect to MongoDB at ${MONGODB_URI} ...`)
    await client.connect()
    console.log('Successfully connected to MongoDB (using directConnection).')

    const adminDb = client.db('admin') // Ensure we are using the admin database

    // Check current replica set status
    let status
    try {
      console.log('Checking replica set status...')
      // With directConnection, replSetGetStatus might behave differently or even fail if not on a replSet member.
      // However, our mongod IS configured as a replSet member, just not initiated.
      status = await adminDb.command({ replSetGetStatus: 1 })

      if (status.ok && status.set === REPLICA_SET_NAME && status.myState === 1) {
        console.log(`Replica set '${REPLICA_SET_NAME}' is already initialized and this node is PRIMARY.`)
        return
      }
      if (status.ok && status.members && status.members.length > 0) {
        console.log(`Replica set '${status.set || REPLICA_SET_NAME}' seems to be already configured or in a specific state.`)
        console.log('Current status:', JSON.stringify(status, null, 2))
        return
      }
      if (status.ok === 0 && status.codeName !== 'NotYetInitialized' && !status.errmsg?.includes('no replset config')) {
        console.warn('Replica set status check returned an unexpected error:', JSON.stringify(status, null, 2))
      }
    } catch (err) {
      if (err.codeName === 'NotYetInitialized' || err.message.includes('no replset config') || err.message.includes('NotYetInitialized')) {
        console.log('Replica set not yet initialized (as expected from rs.status() in mongosh). Proceeding with initialization.')
      } else if (err.code === 94 || err.message.includes('No replica set name has been specified')) { // Error code for replSetGetStatus on non-replset node
        console.log('replSetGetStatus failed, likely because directConnection is on and it is not fully initialized. This is okay if mongod was started with --replSet. Proceeding with initiation attempt.')
      } else {
        console.warn(`Warning during replica set status check: ${err.message}. Attempting initialization anyway.`)
        console.log('Error details:', JSON.stringify(err, null, 2))
      }
    }

    // Define the replica set configuration
    const replicaSetConfig = {
      _id: REPLICA_SET_NAME,
      members: [
        { _id: 0, host: HOST_ADDRESS }
      ]
    }

    console.log(`Attempting to initiate replica set '${REPLICA_SET_NAME}' with config:`, JSON.stringify(replicaSetConfig, null, 2))

    const result = await adminDb.command({ replSetInitiate: replicaSetConfig })

    if (result.ok === 1) {
      console.log(`Replica set '${REPLICA_SET_NAME}' initiated successfully!`)
      console.log('It might take a few moments for the node to become PRIMARY.')
      console.log('You can verify with `mongosh` and `rs.status()`.')
    } else {
      console.error('Failed to initiate replica set.', result)
      if (result.codeName === 'InvalidReplicaSetConfig') {
        console.error('Detail: The replica set configuration was invalid. This can happen if the host address is not resolvable from the perspective of the mongod server itself.')
      } else if (result.codeName === 'AlreadyInitialized') {
        console.log(`Replica set '${REPLICA_SET_NAME}' is already initialized.`)
      }
    }
  } catch (error) {
    console.error('An error occurred during the process:', error)
    if (error.message && error.message.includes('already initialized')) {
      console.log(`It seems the replica set '${REPLICA_SET_NAME}' is already initialized.`)
    } else if (error.codeName === 'ConfigurationInProgress') {
      console.log('Replica set configuration is already in progress or node is recovering. Try again in a moment.')
    }
  } finally {
    if (client) {
      await client.close()
      console.log('MongoDB connection closed.')
    }
  }
}

initiateReplicaSet()
