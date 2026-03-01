// Shared SSE connections map: sessionId -> res
export const sseConnections = new Map();

export const sendSSEEvent = (sessionId, eventType, data) => {
  const res = sseConnections.get(sessionId);
  if (!res) return false;

  try {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    sseConnections.delete(sessionId);
    return false;
  }
};

export const sendSSEMessage = (sessionId, content, agentName = 'orchestrator') => {
  return sendSSEEvent(sessionId, 'message', { role: 'assistant', content, agentName });
};

export const sendSSEProgress = (sessionId, message, percent = null) => {
  return sendSSEEvent(sessionId, 'progress', { message, percent });
};

export const sendSSEApprovalRequest = (sessionId, applicationIds, message) => {
  return sendSSEEvent(sessionId, 'approval_request', { applicationIds, message });
};

export const sendSSEComplete = (sessionId, message) => {
  return sendSSEEvent(sessionId, 'complete', { message });
};

export const sendSSEError = (sessionId, message) => {
  return sendSSEEvent(sessionId, 'error', { message });
};
