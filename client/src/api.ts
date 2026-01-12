import axios from 'axios';

const API_URL = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('drafter_key');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
