import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import {
  getApplications,
  getApplication,
  approveApplication,
  rejectApplication,
  getTailoredCV,
} from '../controllers/application.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/session/:sessionId', getApplications);
router.get('/:id', getApplication);
router.get('/:id/cv', getTailoredCV);
router.post('/:id/approve', approveApplication);
router.post('/:id/reject', rejectApplication);

export default router;
