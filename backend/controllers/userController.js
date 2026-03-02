const { validationResult } = require('express-validator');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/cvs';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  }
});

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const allowedUpdates = ['name', 'skills', 'keywords', 'phone', 'location', 'bio'];
    const updates = {};
    
    // Filter allowed updates
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        // Convert skills string to array if it's a string
        if (key === 'skills' && typeof req.body[key] === 'string') {
          updates[key] = req.body[key].split(',').map(s => s.trim()).filter(s => s);
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    // Update user profile
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        skills: user.skills,
        experience: user.experience,
        projects: user.projects,
        education: user.education,
        keywords: user.keywords,
        cvPath: user.cvPath,
        phone: user.phone,
        location: user.location,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    
    // Delete old CV if exists
    if (user.cvPath) {
      const oldPath = path.join(__dirname, '..', user.cvPath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update user with new CV path
    user.cvPath = req.file.path;
    await user.save();

    res.json({
      message: 'CV uploaded successfully',
      cvPath: req.file.path,
      cvUrl: `${req.protocol}://${req.get('host')}/${req.file.path}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        cvPath: user.cvPath
      }
    });
  } catch (error) {
    console.error('CV upload error:', error);
    
    // Clean up uploaded file if error occurred
    if (req.file) {
      const filePath = path.join(__dirname, '..', req.file.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.status(500).json({ error: 'Failed to upload CV' });
  }
};

const deleteCV = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.cvPath) {
      return res.status(404).json({ error: 'No CV found' });
    }

    // Delete CV file
    const cvPath = path.join(__dirname, '..', user.cvPath);
    if (fs.existsSync(cvPath)) {
      fs.unlinkSync(cvPath);
    }

    // Remove CV path from user
    user.cvPath = undefined;
    await user.save();

    res.json({ message: 'CV deleted successfully' });
  } catch (error) {
    console.error('Delete CV error:', error);
    res.status(500).json({ error: 'Failed to delete CV' });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const Application = require('../models/Application');
    
    const totalApplications = await Application.countDocuments({ userId: req.user._id });
    const pendingApplications = await Application.countDocuments({ 
      userId: req.user._id, 
      status: 'pending' 
    });
    const sentApplications = await Application.countDocuments({ 
      userId: req.user._id, 
      status: 'sent' 
    });
    const failedApplications = await Application.countDocuments({ 
      userId: req.user._id, 
      status: 'failed' 
    });

    const recentApplications = await Application.find({ userId: req.user._id })
      .populate('jobId', 'title company email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: {
        totalApplications,
        pendingApplications,
        sentApplications,
        failedApplications
      },
      recentApplications,
      emailLimit: {
        dailyLimit: parseInt(process.env.MAX_EMAILS_PER_DAY) || 20,
        sentToday: req.user.emailSentCount,
        lastSent: req.user.lastEmailSent
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

module.exports = {
  updateProfile,
  uploadCV,
  deleteCV,
  getDashboardStats,
  upload
};