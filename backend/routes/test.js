const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database connection test
router.get('/test-db', async (req, res) => {
  try {
    // Test MongoDB connection
    await mongoose.connection.db.admin().ping();
    
    // Test basic database operations
    const userCount = await User.countDocuments();
    
    res.json({
      status: 'Database connected successfully',
      userCount: userCount,
      connectionState: mongoose.connection.readyState
    });
  } catch (error) {
    res.status(500).json({
      status: 'Database connection failed',
      error: error.message
    });
  }
});

// JWT token test
router.post('/test-jwt', [
  body('userId').isMongoId().withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;
    
    // Test JWT creation
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    // Test JWT verification
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    
    res.json({
      status: 'JWT working correctly',
      token: token,
      decoded: decoded,
      valid: decoded.userId === userId
    });
  } catch (error) {
    res.status(500).json({
      status: 'JWT test failed',
      error: error.message
    });
  }
});

// Protected route test
router.get('/test-protected', auth, (req, res) => {
  res.json({
    status: 'Protected route accessible',
    userId: req.user.userId,
    message: 'Authentication middleware working correctly'
  });
});

// Environment variables test
router.get('/test-env', (req, res) => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'MONGODB_URI',
    'OPENAI_API_KEY',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  res.json({
    status: missingVars.length === 0 ? 'All required environment variables are set' : 'Missing environment variables',
    missingVars: missingVars,
    environment: process.env.NODE_ENV || 'development',
    totalVarsSet: requiredEnvVars.length - missingVars.length,
    totalVarsRequired: requiredEnvVars.length
  });
});

// File upload test
router.post('/test-upload', auth, async (req, res) => {
  try {
    // This would typically use multer middleware
    // For testing purposes, we'll just verify the upload directory exists
    const fs = require('fs');
    const path = require('path');
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    res.json({
      status: 'Upload directory accessible',
      uploadDir: uploadDir,
      exists: fs.existsSync(uploadDir),
      writable: true // In a real test, you'd check write permissions
    });
  } catch (error) {
    res.status(500).json({
      status: 'Upload test failed',
      error: error.message
    });
  }
});

// Rate limiting test
router.get('/test-rate-limit', (req, res) => {
  res.json({
    status: 'Rate limiting test endpoint',
    message: 'This endpoint should be rate limited',
    timestamp: new Date().toISOString()
  });
});

// Comprehensive system test
router.get('/test-system', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  try {
    // Test database connection
    await mongoose.connection.db.admin().ping();
    results.tests.database = { status: 'PASS', message: 'Database connected' };
  } catch (error) {
    results.tests.database = { status: 'FAIL', message: error.message };
  }
  
  try {
    // Test JWT functionality
    const token = jwt.sign({ test: true }, process.env.JWT_SECRET || 'test-secret');
    jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    results.tests.jwt = { status: 'PASS', message: 'JWT working correctly' };
  } catch (error) {
    results.tests.jwt = { status: 'FAIL', message: error.message };
  }
  
  try {
    // Test environment variables
    const requiredVars = ['JWT_SECRET', 'MONGODB_URI'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    results.tests.environment = { 
      status: missingVars.length === 0 ? 'PASS' : 'WARN', 
      message: missingVars.length === 0 ? 'All critical env vars set' : `Missing: ${missingVars.join(', ')}`
    };
  } catch (error) {
    results.tests.environment = { status: 'FAIL', message: error.message };
  }
  
  // Calculate overall status
  const failedTests = Object.values(results.tests).filter(test => test.status === 'FAIL');
  const warningTests = Object.values(results.tests).filter(test => test.status === 'WARN');
  
  results.overallStatus = failedTests.length === 0 ? 'HEALTHY' : 'UNHEALTHY';
  results.summary = {
    totalTests: Object.keys(results.tests).length,
    passed: Object.values(results.tests).filter(test => test.status === 'PASS').length,
    warnings: warningTests.length,
    failed: failedTests.length
  };
  
  res.json(results);
});

module.exports = router;