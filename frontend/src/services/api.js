import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updatePassword: (data) => api.put('/auth/password', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, email, password) => api.post('/auth/reset-password', { token, email, password }),
};

// User API
export const userAPI = {
  updateProfile: (data) => api.put('/users/profile', data),
  uploadCV: (formData) => api.post('/users/cv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteCV: () => api.delete('/users/cv'),
  getDashboard: () => api.get('/users/dashboard'),
};

// Jobs API
export const jobsAPI = {
  getJobs: (params) => api.get('/jobs', { params }),
  getJobById: (id) => api.get(`/jobs/${id}`),
  scrapeJobs: (data) => api.post('/jobs/scrape', data),
  createJob: (data) => api.post('/jobs', data),
  updateJob: (id, data) => api.put(`/jobs/${id}`, data),
  deleteJob: (id) => api.delete(`/jobs/${id}`),
};

// Cover Letter API
export const coverLetterAPI = {
  generate: (data) => api.post('/cover-letter/generate', data),
  generateMultiple: (data) => api.post('/cover-letter/generate-multiple', data),
  preview: (data) => api.post('/cover-letter/preview', data),
};

// Email API
export const emailAPI = {
  sendApplication: (data) => api.post('/email/send-application', data),
  testEmail: () => api.post('/email/test'),
};

// Applications API
export const applicationsAPI = {
  getApplications: (params) => api.get('/applications', { params }),
  getApplicationById: (id) => api.get(`/applications/${id}`),
  updateStatus: (id, data) => api.put(`/applications/${id}/status`, data),
  deleteApplication: (id) => api.delete(`/applications/${id}`),
  getStats: () => api.get('/applications/stats'),
};

export default api;