import axiosInstance from '../utils/axiosInstance';

export const getChallanCandidates = async () => {
  const res = await axiosInstance.get('/api/challans/candidates');
  return res.data;
};

export const createChallan = async ({ auditIds, notes }) => {
  const res = await axiosInstance.post('/api/challans', { auditIds, notes });
  return res.data;
};

export const listChallans = async () => {
  const res = await axiosInstance.get('/api/challans');
  return res.data;
};

export const getChallanById = async (id) => {
  const res = await axiosInstance.get(`/api/challans/${id}`);
  return res.data;
};

export const downloadChallanCsv = async (id) => {
  // Returns a Blob for download
  const res = await axiosInstance.get(`/api/challans/${id}/download`, {
    responseType: 'blob',
  });
  return res.data;
};


