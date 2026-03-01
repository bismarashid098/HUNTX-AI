import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';
import { uploadCV } from '../controllers/cv.controller.js';

const router = Router();

router.post('/upload', authMiddleware, upload.single('cv'), uploadCV);

export default router;
