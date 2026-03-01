import mongoose from 'mongoose';

const JobApplicationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    job: {
      title: { type: String, required: true },
      company: { type: String, required: true },
      location: String,
      description: String,
      applyLink: String,
      sourceUrl: String,
    },
    tailoredCV: {
      type: String,
      required: true,
    },
    emailDraft: {
      subject: { type: String, required: true },
      body: { type: String, required: true },
      hrEmail: String,
      hrEmailConfidence: {
        type: String,
        enum: ['found_in_text', 'inferred', 'not_found'],
        default: 'not_found',
      },
    },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SENT', 'FAILED'],
      default: 'PENDING_REVIEW',
    },
    userEdits: {
      emailBody: String,
      emailSubject: String,
    },
    sentAt: Date,
    errorMessage: String,
  },
  { timestamps: true }
);

JobApplicationSchema.index({ sessionId: 1, status: 1 });

export default mongoose.model('JobApplication', JobApplicationSchema);
