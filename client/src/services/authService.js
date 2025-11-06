import axiosInstance from '../utils/axiosInstance';

export const registerUser = async (userData) => {
  const response = await axiosInstance.post('/api/auth/register', userData);
  return response.data;
};

export const loginUser = async (userData) => {
  const response = await axiosInstance.post('/api/auth/login', userData);
  return response.data;
};

export const getProfile = async () => {
  const response = await axiosInstance.get('/api/auth/profile');
  return response.data;
};


export const logoutUser = async () => {
  const res = await axiosInstance.post('/api/auth/logout');
  return res.data;
};