import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage as fallback (httpOnly cookie is primary)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('huntx_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('huntx_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
