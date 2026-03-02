const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [200, 'Job title cannot exceed 200 characters']
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  email: {
    type: String,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [50000, 'Job description cannot exceed 50000 characters']
  },
  location: {
    type: String,
    trim: true
  },
  salary: {
    type: String,
    trim: true
  },
  jobType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
    default: 'full-time'
  },
  source: {
    type: String,
    enum: ['scraper', 'manual', 'api', 'linkedin', 'indeed', 'glassdoor', 'company_website'],
    default: 'scraper'
  },
  sourceUrl: {
    type: String,
    trim: true
  },
  companyApplyUrl: {
    type: String,
    trim: true,
    default: null,
  },
  requirements: {
    type: [String],
    default: [],
  },
  niceToHave: {
    type: [String],
    default: [],
  },
  benefits: {
    type: [String],
    default: [],
  },
  matchScore: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1,
  },
  matchedSkills: {
    type: [String],
    default: [],
  },
  missingSkills: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ['new', 'saved', 'applied', 'rejected', 'interview', 'offer'],
    default: 'new',
  },
  appliedAt: {
    type: Date,
    default: null,
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  postedDate: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound unique per user to allow same job from different users
jobSchema.index({ userId: 1, sourceUrl: 1 }, { unique: true, sparse: true });
jobSchema.index({ userId: 1, matchScore: -1 });
jobSchema.index({ userId: 1, status: 1 });
jobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
