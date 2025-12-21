import axiosInstance from '../utils/axiosInstance';

export const getChallanCandidates = async () => {
  const res = await axiosInstance.get('/api/challans/candidates');
  return res.data;
};

export const createChallan = async ({
  auditIds,
  notes,
  terms,
  lineItems,
  manualItems,
  clientDetails,
  hsnCode,
  inventoryType,
}) => {
  const payload = {
    auditIds,
  };

  if (typeof terms === "string") {
    payload.terms = terms;
  } else if (typeof notes === "string") {
    payload.terms = notes;
  }

  if (clientDetails) {
    payload.clientDetails = clientDetails;
  }
  if (typeof hsnCode === "string" && hsnCode.trim()) {
    payload.hsnCode = hsnCode.trim();
  }
  if (typeof inventoryType === "string" && inventoryType.trim()) {
    payload.inventoryType = inventoryType.trim();
  }

  if (Array.isArray(lineItems)) {
    payload.lineItems = lineItems;
  }
  if (Array.isArray(manualItems) && manualItems.length > 0) {
    payload.manualItems = manualItems;
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

export const downloadChallanPdf = async (id) => {
  const res = await axiosInstance.get(`/api/challans/${id}/download`, {
    responseType: "blob",
  });
  return res.data;
};

export const searchClients = async (query) => {
  const res = await axiosInstance.get('/api/challans/search/clients', {
    params: { query },
  });
  return res.data;
};


