const uuid = require('uuid')
const ConversationModel = require('../model/conversation')
const BaseRepository = require('./baseRepository')

class ConversationRepository extends BaseRepository {
  constructor () {
    super(ConversationModel)
  }

  async findOneByUUID (UUID, options = {}) {
    const result = await ConversationModel.findOne(
      { UUID: UUID },
      null,
      options
    )
    return result || null
  }

  async getAll (options = {}) {
    const agt = [
      {
        $match: {}
      }
    ]
    const pg = await this.aggregatePaginate(agt, options)
    const data = { conversations: pg.itemsList }
    if (pg.itemCount >= options.limit) {
      data.totalCount = pg.itemCount
      data.itemsPerPage = pg.itemsPerPage
      data.pageCount = pg.pageCount
      data.currentPage = pg.currentPage
      data.prevPage = pg.prevPage
      data.nextPage = pg.nextPage
    }
    return data
  }

  async getAllByTargetUUID (targetUUID, isSecretariat, options = {}) {
    const conversations = await ConversationModel.find({ target_uuid: targetUUID }, null, {
      ...options,
      sort: {
        posted_at: 1,
        UUID: 1
      }
    })
    return conversations.map(convo => convo.toObject()).filter(conv => isSecretariat || conv.visibility === 'public')
  }

  async findByTargetUUIDAndIndex (targetUUID, index, options = {}) {
    const conversation = await ConversationModel.find({ target_uuid: targetUUID }, null, {
      ...options,
      sort: {
        posted_at: 1,
        UUID: 1
      }
    }).skip(index).limit(1)
    return conversation[0]
  }

  async createConversation (targetUUID, body, user, isSecretariat, options = {}) {
    const { getUserFullName } = require('../utils/utils')
    const newUUID = uuid.v4()
    // Find latest message in chain for target
    const latestConversation = await ConversationModel.findOne({ target_uuid: targetUUID, next_conversation_uuid: null }, null, options)
    if (latestConversation) {
      latestConversation.next_conversation_uuid = newUUID
      await latestConversation.save(options)
    }
    const conversationObj = {
      UUID: newUUID,
      target_uuid: targetUUID,
      previous_conversation_uuid: latestConversation?.UUID || null,
      next_conversation_uuid: null,
      author_id: user.UUID,
      author_name: getUserFullName(user),
      author_role: isSecretariat ? 'Secretariat' : 'Partner',
      editor_id: null,
      edited_at: null,
      visibility: !isSecretariat ? 'public' : (['public', 'private'].includes(body.visibility?.toLowerCase()) ? body.visibility.toLowerCase() : 'private'),
      body: body.body
    }
    const newConversation = new ConversationModel(conversationObj)
    const result = await newConversation.save(options)
    return result.toObject()
  }

  async editConversation (UUID, incomingParameters, userUUID, options = {}) {
    const conversation = await this.findOneByUUID(UUID, options)
    if (incomingParameters?.body) {
      conversation.body = incomingParameters.body
    }
    if (incomingParameters?.visibility) {
      conversation.visibility = incomingParameters.visibility
    }
    conversation.editor_id = userUUID
    conversation.edited_at = Date.now()
    const result = await conversation.save(options)
    return result.toObject()
  }
}

module.exports = ConversationRepository
