import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import rateLimit from 'express-rate-limit';
import {
  createSession,
  getSessions,
  getSession,
  deleteSession,
  sendMessage,
  streamSSE,
} from '../controllers/chat.controller.js';

const router = Router();

const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { message: 'Too many messages. Please try again later.' },
});

router.use(authMiddleware);

router.post('/session', createSession);
router.get('/sessions', getSessions);
router.get('/session/:id', getSession);
router.delete('/session/:id', deleteSession);
router.post('/message', messageLimiter, sendMessage);
router.get('/stream/:sessionId', streamSSE);

export default router;
