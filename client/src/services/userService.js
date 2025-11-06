import axiosInstance from '../utils/axiosInstance';

export const getAllUsers = async () => {
  const res = await axiosInstance.get('/api/admin/users');
  return res.data;
};

export const deleteUser = async (userId) => {
  const res = await axiosInstance.delete(`/api/admin/users/${userId}`);
  return res.data;
};

export const updateUser = async (userId, payload) => {
  const res = await axiosInstance.put(`/api/admin/users/${userId}`, payload);
  return res.data;
};

export const updateUserProfile = async (data) => {
  const res = await axiosInstance.put('/api/user/update-profile', data);
  return res.data;
};