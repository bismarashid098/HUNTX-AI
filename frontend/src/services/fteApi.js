import api from './api';

export const fteApi = {
  /**
   * Main chat endpoint — send a message and optionally a CV file
   */
  chat: (message, cvFile = null) => {
    const form = new FormData();
    if (message) form.append('message', message);
    if (cvFile) form.append('cv', cvFile);
    return api.post('/fte/chat', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60s for PDF parse + LLM
    });
  },

  /**
   * Get current FTE state (for polling)
   */
  getState: () => api.get('/fte/state'),

  /**
   * Approve generated CVs
   */
  approveCVs: (approvalId, selectedJobIds = null) =>
    api.post('/fte/approve-cvs', { approvalId, selectedJobIds }),

  /**
   * Approve email drafts (with optional edits)
   */
  approveEmails: (approvalId, modifiedEmails = null) =>
    api.post('/fte/approve-emails', { approvalId, modifiedEmails }),

  /**
   * Get past session history list
   */
  getHistory: () => api.get('/fte/history'),

  /**
   * Get a specific history session with full messages
   */
  getHistorySession: (key) => api.get(`/fte/history/${key}`),

  /**
   * Reset and start over
   */
  reset: () => api.post('/fte/reset'),

  /**
   * Download the tailored PDF CV for a specific job
   */
  downloadCV: (jobId) => api.get(`/fte/cv/download/${jobId}`, { responseType: 'blob' }),

  /**
   * Chat with local Ollama LLM
   * history: [{role:'user'|'bot', content:string}]
   */
  ollamaChat: (message, history = [], model = '') =>
    api.post('/ollama/chat', { message, history, ...(model && { model }) }, { timeout: 120000 }),

  /**
   * Check Ollama status + available models
   */
  ollamaStatus: () => api.get('/ollama/status'),

  /**
   * Get user settings
   */
  getSettings: () => api.get('/fte/settings'),

  /**
   * Save user settings (partial update)
   */
  saveSettings: (data) => api.put('/fte/settings', data),
};
