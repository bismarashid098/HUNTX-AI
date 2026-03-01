import api from './api.js';

export const getApplications = (sessionId) => api.get(`/applications/session/${sessionId}`);
export const getApplication = (id) => api.get(`/applications/${id}`);
export const getTailoredCV = (id) => api.get(`/applications/${id}/cv`);
export const approveApplication = (id, edits = {}) => api.post(`/applications/${id}/approve`, edits);
export const rejectApplication = (id) => api.post(`/applications/${id}/reject`);
