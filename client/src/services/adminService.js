// src/services/adminService.js
import axiosInstance from '../utils/axiosInstance';

export const resetChallansMaintenance = async ({ confirm, backup = false }) => {
  const res = await axiosInstance.post('/api/admin/maintenance/reset-challans', {
    confirm,
    backup,
  });
  return res.data;
};
