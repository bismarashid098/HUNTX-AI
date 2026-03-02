/**
 * Task Model
 * Tracks individual tasks executed by agents
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  taskId: {
    type: String,
    required: true,
    unique: true,
  },
  parentTaskId: {
    type: String,
    default: null,
  },
  agentId: {
    type: String,
    required: true,
    enum: ['orchestrator', 'jobSearch', 'resumeBuilder', 'apply', 'prep'],
  },
  taskType: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'waiting_approval', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  input: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  output: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  dependsOn: [{
    type: String,
  }],
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 100 },
    message: { type: String, default: '' },
  },
  approvalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Approval',
    default: null,
  },
  traceId: {
    type: String,
    default: null,
  },
  error: {
    message: { type: String, default: null },
    stack: { type: String, default: null },
    timestamp: { type: Date, default: null },
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  estimatedDuration: {
    type: Number, // in seconds
    default: null,
  },
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, agentId: 1 });
taskSchema.index({ taskId: 1 });

// Generate unique task ID
taskSchema.statics.generateTaskId = function(agentId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${agentId}_${timestamp}_${random}`;
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
