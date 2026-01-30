import axios from 'axios';

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // First check Vite env variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Fallback for production (Vercel): use relative path or infer from window.location
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // On Vercel or other production domain, use the same origin
    // assuming the frontend and backend share the same domain or the backend is available at /api
    return '';
  }
  
  // Fallback for local development
  return 'http://localhost:5000';
};

const axiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // If you're using cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;
