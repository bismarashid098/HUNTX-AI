/**
 * Agent State Model
 * Tracks the state and activity of all agents
 */

const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  agentId: {
    type: String,
    required: true,
    enum: ['orchestrator', 'jobSearch', 'resumeBuilder', 'apply', 'prep'],
  },
  agentName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['idle', 'initializing', 'working', 'waiting_approval', 'completed', 'error'],
    default: 'idle',
  },
  currentTask: {
    type: String,
    default: null,
  },
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 100 },
    message: { type: String, default: '' },
  },
  activityLog: [{
    timestamp: { type: Date, default: Date.now },
    action: String,
    details: mongoose.Schema.Types.Mixed,
  }],
  lastActive: {
    type: Date,
    default: Date.now,
  },
  traceId: {
    type: String,
    default: null,
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  stats: {
    totalTasks: { type: Number, default: 0 },
    successfulTasks: { type: Number, default: 0 },
    failedTasks: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
agentSchema.index({ userId: 1, agentId: 1 }, { unique: true });

// Update lastActive on save
agentSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

const Agent = mongoose.model('Agent', agentSchema);

module.exports = Agent;
