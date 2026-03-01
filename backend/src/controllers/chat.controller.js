import ChatSession from '../models/ChatSession.model.js';
import { handleMessage } from '../agents/orchestrator.agent.js';
import { sseConnections } from '../utils/sse.utils.js';

export const createSession = async (req, res, next) => {
  try {
    const session = await ChatSession.create({ userId: req.user.userId });
    res.status(201).json({
      message: 'Session created',
      session: {
        id: session._id,
        title: session.title,
        state: session.state,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSessions = async (req, res, next) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user.userId })
      .select('_id title state createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    res.json({ session });
  } catch (error) {
    next(error);
  }
};

export const deleteSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    res.json({ message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
};

export const streamSSE = (req, res) => {
  const { sessionId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseConnections.set(sessionId, res);

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseConnections.delete(sessionId);
  });
};

export const sendMessage = async (req, res, next) => {
  try {
    const { sessionId, message, cvText } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId is required' });
    }

    const session = await ChatSession.findOne({
      _id: sessionId,
      userId: req.user.userId,
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Acknowledge immediately
    res.json({ message: 'Message received, processing...' });

    // Run orchestrator asynchronously (SSE stream delivers results)
    handleMessage(sessionId, message || '', cvText || null).catch((err) => {
      console.error('[Chat Controller] Orchestrator error:', err.message);
    });
  } catch (error) {
    next(error);
  }
};

