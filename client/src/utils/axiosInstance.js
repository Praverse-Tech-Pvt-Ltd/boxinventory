import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // If you're using cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;
