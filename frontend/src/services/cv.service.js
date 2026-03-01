import api from './api.js';

export const uploadCV = (file) => {
  const formData = new FormData();
  formData.append('cv', file);
  return api.post('/cv/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
