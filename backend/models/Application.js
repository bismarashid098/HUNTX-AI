const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  coverLetter: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'rejected', 'interviewed', 'hired'],
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  emailResponse: {
    type: String
  },
  errorMessage: {
    type: String
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate applications
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

// Index for efficient querying
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ appliedAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);