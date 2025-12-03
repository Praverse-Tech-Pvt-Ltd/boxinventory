import axiosInstance from "../utils/axiosInstance";

export const listClientBatches = async () => {
  const res = await axiosInstance.get("/api/client-batches");
  return res.data;
};

export const createClientBatch = async (payload) => {
  const res = await axiosInstance.post("/api/client-batches", payload);
  return res.data;
};

export const appendClientBatch = async (batchId, payload) => {
  const res = await axiosInstance.post(`/api/client-batches/${batchId}/append`, payload);
  return res.data;
};

export const removeClientBatch = async (batchId) => {
  const res = await axiosInstance.delete(`/api/client-batches/${batchId}`);
  return res.data;
};

export const removeAuditFromBatch = async (batchId, auditId) => {
  const res = await axiosInstance.post(`/api/client-batches/${batchId}/remove-audit`, {
    auditId,
  });
  return res.data;
};

export const moveAuditBetweenBatches = async ({ auditId, fromBatchId, toBatchId }) => {
  const res = await axiosInstance.post("/api/client-batches/move-audit", {
    auditId,
    fromBatchId,
    toBatchId,
  });
  return res.data;
};


