import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

export const clearStoredAuth = () => {
  localStorage.removeItem('sweety_token');
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sweety_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !window.location.pathname.startsWith('/auth')) {
      clearStoredAuth();
      window.location.assign('/auth');
    }

    return Promise.reject(error);
  }
);

export const getApiError = (error) => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};

export default api;
