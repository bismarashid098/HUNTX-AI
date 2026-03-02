require('dotenv').config(); // Must be FIRST — loads env vars before anything else

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/job-application-agent', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/fte', require('./routes/fte'));
app.use('/api/test', require('./routes/test'));

// File upload handling
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // ── Verify email service on startup ────────────────────────────────────────
  try {
    const { emailService } = require('./services/emailService');
    const ok = await emailService.verifyConnection();
    if (ok) {
      console.log(`✅ Email service ready — ${process.env.EMAIL_USER}`);
    } else {
      console.warn(`⚠️  Email service NOT connected — check EMAIL_USER / EMAIL_PASS in .env`);
    }
  } catch (e) {
    console.warn(`⚠️  Email service error: ${e.message}`);
  }

  // ── Confirm API keys ────────────────────────────────────────────────────────
  console.log(`🔑 SERPAPI_KEY: ${process.env.SERPAPI_KEY ? '✅ set' : '❌ MISSING'}`);
  console.log(`🔑 GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ set' : '❌ MISSING'}`);
  console.log(`🔑 EMAIL_USER: ${process.env.EMAIL_USER || '❌ MISSING'}`);
});

module.exports = app;