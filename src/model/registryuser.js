const mongoose = require('mongoose')
const BaseUser = require('./baseuser')

const RegistryUser = mongoose.model('RegistryUser', BaseUser.schema)

module.exports = RegistryUser
