import api from './api.js';

export const createSession = () => api.post('/chat/session');
export const getSessions = () => api.get('/chat/sessions');
export const getSession = (id) => api.get(`/chat/session/${id}`);
export const deleteSession = (id) => api.delete(`/chat/session/${id}`);
export const sendMessage = (data) => api.post('/chat/message', data);
