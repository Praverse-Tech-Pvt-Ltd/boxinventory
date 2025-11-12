import axiosInstance from '../utils/axiosInstance';

export const getChallanCandidates = async () => {
  const res = await axiosInstance.get('/api/challans/candidates');
  return res.data;
};

export const createChallan = async ({ auditIds, notes, lineItems, includeGST = true }) => {
  const payload = {
    auditIds,
    notes,
    includeGST,
  };
  if (Array.isArray(lineItems)) {
    payload.lineItems = lineItems;
  }
  const res = await axiosInstance.post('/api/challans', payload);
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

export const downloadChallanPdf = async (id, includeGST = true) => {
  const res = await axiosInstance.get(`/api/challans/${id}/download`, {
    params: { includeGST },
    responseType: "blob",
  });
  return res.data;
};


