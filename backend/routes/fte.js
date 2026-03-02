/**
 * FTE (Digital Full-Time Employee) Routes
 * Conversational API: upload CV → capture role → search → generate CVs → approve → send emails
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const fteAgent = require('../agents/fte');

// ─── Multer for CV upload ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/cvs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cv_${req.user._id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/fte/chat
 * Main conversational entry point. Accepts optional CV file upload.
 */
router.post(
  '/chat',
  authMiddleware,
  (req, res, next) => {
    upload.single('cv')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const userId = req.user._id;
      const message = req.body.message || '';
      const uploadedFile = req.file || null;

      const result = await fteAgent.chat(userId, message, uploadedFile);

      res.json({
        success: true,
        botMessage: result.botMessage,
        state: result.state,
        data: result.data || null,
      });
    } catch (error) {
      console.error('FTE chat error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/fte/state
 * Returns current FTE state (used for polling during async operations)
 */
router.get('/state', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const state = await fteAgent.getStateForUser(userId);
    res.json({ success: true, ...state });
  } catch (error) {
    console.error('FTE state error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fte/approve-cvs
 * User approves generated CVs → trigger email finding
 * Body: { approvalId, selectedJobIds? }
 */
router.post('/approve-cvs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { approvalId, selectedJobIds } = req.body;

    if (!approvalId) {
      return res.status(400).json({ success: false, error: 'approvalId is required' });
    }

    const result = await fteAgent.approveCVs(userId, approvalId, selectedJobIds);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('FTE approve-cvs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fte/approve-emails
 * User approves email drafts → send all emails
 * Body: { approvalId, modifiedEmails? }
 */
router.post('/approve-emails', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { approvalId, modifiedEmails } = req.body;

    if (!approvalId) {
      return res.status(400).json({ success: false, error: 'approvalId is required' });
    }

    const result = await fteAgent.approveEmails(userId, approvalId, modifiedEmails);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('FTE approve-emails error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fte/history
 * Returns list of past completed sessions
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const history = await fteAgent.getHistory(userId);
    res.json({ success: true, history });
  } catch (error) {
    console.error('FTE history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fte/history/:key
 * Returns a specific history session with full conversation messages
 */
router.get('/history/:key', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { key } = req.params;
    const session = await fteAgent.getHistorySession(userId, key);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error) {
    console.error('FTE history session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fte/cv/download/:jobId
 * Download the tailored PDF CV for a specific job
 */
router.get('/cv/download/:jobId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { jobId } = req.params;

    const cvPdfPath = await fteAgent.getCVPdfPath(userId, jobId);

    if (!cvPdfPath) {
      return res.status(404).json({ success: false, error: 'Tailored CV PDF not found for this job.' });
    }
    if (!fs.existsSync(cvPdfPath)) {
      return res.status(404).json({ success: false, error: 'CV PDF file no longer exists on disk.' });
    }

    // Extract a clean filename from the path
    const baseName = path.basename(cvPdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}"`);
    fs.createReadStream(cvPdfPath).pipe(res);
  } catch (error) {
    console.error('FTE cv download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fte/reset
 * Reset FTE state to start over
 */
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    await fteAgent.resetUser(userId);
    res.json({
      success: true,
      botMessage: 'Reset complete! Please upload your CV (PDF) to begin.',
      state: 'waiting_cv',
    });
  } catch (error) {
    console.error('FTE reset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fte/settings
 * Returns user's settings (with defaults merged)
 */
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await fteAgent.getUserSettings(req.user._id);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('FTE get-settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/fte/settings
 * Update user settings
 * Body: partial settings object
 */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const allowed = ['maxJobs','defaultRole','defaultCity','jobType','emailSignature','ccMyself','emailLanguage','minAtsScore','autoApproveCvs','autoApproveAts'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const settings = await fteAgent.updateUserSettings(req.user._id, updates);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('FTE save-settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
