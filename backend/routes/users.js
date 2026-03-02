const express = require('express');
const { body } = require('express-validator');
const { updateProfile, uploadCV, deleteCV, getDashboardStats, upload } = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  body('experience')
    .optional(),
  body('projects')
    .optional(),
  body('education')
    .optional(),
  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords must be an array')
];

// Routes
router.put('/profile', authMiddleware, updateProfileValidation, updateProfile);
router.post('/cv', authMiddleware, upload.single('cv'), uploadCV);
router.delete('/cv', authMiddleware, deleteCV);
router.get('/dashboard', authMiddleware, getDashboardStats);

module.exports = router;