/**
 * Memory Model
 * Stores short-term and long-term memory for agents
 */

const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  memoryType: {
    type: String,
    required: true,
    enum: ['short_term', 'long_term', 'session', 'context'],
  },
  category: {
    type: String,
    enum: ['conversation', 'preferences', 'history', 'knowledge', 'templates', 'company', 'custom', 'pending_plan', 'pipeline', 'resume', 'fte_state', 'fte_history'],
    default: 'conversation',
  },
  key: {
    type: String,
    required: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  metadata: {
    source: { type: String, default: 'user' },
    tags: [String],
    expiresAt: { type: Date, default: null },
  },
  context: {
    agentId: String,
    taskId: String,
    sessionId: String,
  },
  relevance: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 1,
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
memorySchema.index({ userId: 1, memoryType: 1 });
memorySchema.index({ userId: 1, category: 1 });
// Unique across userId + memoryType + category + key (not just userId+key)
memorySchema.index({ userId: 1, memoryType: 1, category: 1, key: 1 }, { unique: true });
// TTL index: MongoDB will delete docs when metadata.expiresAt is reached
memorySchema.index({ 'metadata.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Static methods for memory operations
memorySchema.statics.getShortTerm = function(userId, sessionId) {
  return this.find({
    userId,
    memoryType: 'short_term',
    'context.sessionId': sessionId,
  }).sort({ createdAt: -1 });
};

memorySchema.statics.getLongTerm = function(userId, category = null) {
  const query = { userId, memoryType: 'long_term' };
  if (category) query.category = category;
  return this.find(query).sort({ updatedAt: -1 });
};

memorySchema.statics.savePreference = function(userId, key, value) {
  return this.findOneAndUpdate(
    { userId, memoryType: 'long_term', category: 'preferences', key },
    { 
      value,
      $setOnInsert: { userId, memoryType: 'long_term', category: 'preferences', key }
    },
    { upsert: true, new: true }
  );
};

memorySchema.statics.saveConversation = function(userId, sessionId, messages) {
  return this.findOneAndUpdate(
    { userId, memoryType: 'session', 'context.sessionId': sessionId, key: 'conversation' },
    { 
      value: messages,
      $setOnInsert: { 
        userId, 
        memoryType: 'session', 
        key: 'conversation',
        'metadata.expiresAt': new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        'context.sessionId': sessionId,
      }
    },
    { upsert: true, new: true }
  );
};

memorySchema.statics.getConversation = function(userId, sessionId) {
  return this.findOne({
    userId,
    memoryType: 'session',
    'context.sessionId': sessionId,
    key: 'conversation',
  });
};

const Memory = mongoose.model('Memory', memorySchema);

module.exports = Memory;
