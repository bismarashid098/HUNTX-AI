/**
 * Approval Model
 * Tracks human-in-the-loop approvals for agent actions
 */

const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  approvalId: {
    type: String,
    required: true,
    unique: true,
  },
  approvalType: {
    type: String,
    required: true,
    enum: ['cv_modification', 'cv_review', 'email_send', 'application_submit', 'follow_up', 'general'],
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'modified', 'expired'],
    default: 'pending',
  },
  taskId: {
    type: String,
    required: true,
  },
  agentId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  content: {
    original: mongoose.Schema.Types.Mixed,
    modified: mongoose.Schema.Types.Mixed,
    changes: [{
      field: String,
      originalValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      description: String,
    }],
  },
  comparison: {
    type: mongoose.Schema.Types.Mixed, // For side-by-side diffs
    default: null,
  },
  metadata: {
    urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    deadline: { type: Date, default: null },
    autoExpire: { type: Boolean, default: false },
    expireAfter: { type: Number, default: 24 * 60 }, // minutes
  },
  userComment: {
    type: String,
    default: null,
  },
  modifiedContent: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
  }],
  traceId: {
    type: String,
    default: null,
  },
  traceUrl: {
    type: String,
    default: null,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  respondedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
approvalSchema.index({ userId: 1, status: 1 });
approvalSchema.index({ approvalId: 1 });
approvalSchema.index({ taskId: 1 });

// Generate unique approval ID
approvalSchema.statics.generateApprovalId = function() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `approval_${timestamp}_${random}`;
};

// Pre-save middleware to set expiration
approvalSchema.pre('save', function(next) {
  if (this.isNew && this.metadata.autoExpire) {
    this.expiresAt = new Date(Date.now() + this.metadata.expireAfter * 60 * 1000);
  }
  next();
});

// Static methods
approvalSchema.statics.createPending = async function(data) {
  const approvalId = await this.generateApprovalId();
  return this.create({
    ...data,
    approvalId,
    status: 'pending',
    requestedAt: new Date(),
  });
};

approvalSchema.statics.getPending = function(userId) {
  return this.find({
    userId,
    status: 'pending',
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ requestedAt: 1 });
};

const Approval = mongoose.model('Approval', approvalSchema);

module.exports = Approval;
