import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Fail fast instead of spinning forever if the API is unreachable
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let redirecting = false;

/** Reset the 401 redirect guard — call on fresh login */
export function resetRedirectFlag() {
  redirecting = false;
}

apiClient.interceptors.response.use(
  (response) => {
    // Unwrap the { status, data } envelope from the backend
    if (response.data && typeof response.data === 'object' && response.data.status === 'success' && response.data.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !redirecting) {
      redirecting = true;
      localStorage.removeItem('auth_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
