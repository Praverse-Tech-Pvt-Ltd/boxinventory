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
  challanTaxType,
  payment_mode,
  remarks,
  packaging_charges_overall,
  discount_pct,
  challanDate,
  inventory_mode,
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
  if (typeof challanTaxType === "string" && challanTaxType.trim()) {
    payload.challanTaxType = challanTaxType.trim();
  }

  if (Array.isArray(lineItems)) {
    payload.lineItems = lineItems;
  }
  if (Array.isArray(manualItems) && manualItems.length > 0) {
    payload.manualItems = manualItems;
  }

  if (payment_mode && payment_mode.trim()) {
    payload.payment_mode = payment_mode.trim();
  }
  if (remarks && remarks.trim()) {
    payload.remarks = remarks.trim();
  }
  
  // Include packaging and discount (CRITICAL FIX)
  if (typeof packaging_charges_overall === 'number') {
    payload.packaging_charges_overall = packaging_charges_overall;
  }
  if (typeof discount_pct === 'number') {
    payload.discount_pct = discount_pct;
  }
  if (challanDate) {
    payload.challanDate = challanDate;
  }
  if (inventory_mode) {
    payload.inventory_mode = inventory_mode;
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

export const editChallan = async (id, editData) => {
  const res = await axiosInstance.put(`/api/challans/${id}`, editData);
  return res.data;
};

export const cancelChallan = async (id, reason) => {
  const res = await axiosInstance.post(`/api/challans/${id}/cancel`, { reason });
  return res.data;
};

export const searchBoxes = async (query) => {
  const res = await axiosInstance.get('/api/boxes/search', {
    params: { q: query },
  });
  return res.data;
};

