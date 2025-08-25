const config = require('config')
const logger = require('../middleware/logger')

/* constructs MongoDB connection string
 * assumes that host, port, database are always defined in default config, but
 * that username and password may not be
 */
function getMongoConnectionString () {
  const appEnv = process.env.NODE_ENV
  let dbUser, dbPassword
  if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
    dbUser = process.env.MONGO_USER
    dbPassword = process.env.MONGO_PASSWORD
  } else {
    dbUser = config.has(`${appEnv}.username`) ? config.get(`${appEnv}.username`) : false
    dbPassword = config.has(`${appEnv}.password`) ? config.get(`${appEnv}.password`) : false
  }

  const dbHost = process.env.MONGO_HOST ? process.env.MONGO_HOST : config.get(`${appEnv}.host`)
  const dbPort = process.env.MONGO_PORT ? process.env.MONGO_PORT : config.get(`${appEnv}.port`)
  const dbName = config.get(`${appEnv}.database`)
  const dbLoginPrepend = (dbUser && dbPassword) ? `${dbUser}:${dbPassword}@` : ''

  logger.info(`Using NODE_ENV '${process.env.NODE_ENV}' and app environment '${appEnv}'`)
  logger.info('Using dbName = ' + config.get(`${appEnv}.database`))
  logger.info(`Will try to connect to database ${dbName} at ${dbHost}:${dbPort}`)

  if (process.env.useAWS) {
    return `mongodb://${dbLoginPrepend}${dbHost}:${dbPort}/${dbName}?retryWrites=false`
  } else {
    return `mongodb://${dbLoginPrepend}${dbHost}:${dbPort}/${dbName}`
  }
}

function getMongoConnectionOptions () {
  logger.info(`On AWS: ${process.env.useAWS}`)
  if (process.env.useAWS) {
    return {
      authMechanism: 'SCRAM-SHA-1',
      tls: false
    }
  }
  return {
    tls: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
}

module.exports = {
  getMongoConnectionString,
  getMongoConnectionOptions
}
