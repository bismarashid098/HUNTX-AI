import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: {
    agentName: String,
    applicationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication' }],
    type: {
      type: String,
      enum: ['text', 'approval_request', 'progress', 'complete', 'error'],
      default: 'text',
    },
  },
});

const JobResultSchema = new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  description: String,
  applyLink: String,
  sourceUrl: String,
});

const ChatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'New Job Hunt',
    },
    state: {
      type: String,
      enum: [
        'INTAKE',
        'CONFIRMATION',
        'JOB_SEARCH',
        'CV_TAILOR',
        'APPROVAL',
        'EMAIL_SEND',
        'COMPLETE',
        'ERROR',
      ],
      default: 'INTAKE',
    },
    context: {
      cvText: String,
      cvSummary: mongoose.Schema.Types.Mixed,
      confirmedJobTitle: String,
      confirmedLocation: String,
      pendingJobTitle: String,
      pendingLocation: String,
      jobResults: [JobResultSchema],
      searchHistory: [
        new mongoose.Schema(
          {
            jobTitle: String,
            location: String,
            timestamp: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      totalEmailsSent: { type: Number, default: 0 },
      lastError: String,
    },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

ChatSessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ChatSession', ChatSessionSchema);
