import axiosInstance from '../utils/axiosInstance';

// Get all boxes (public route)
export const getAllBoxes = async () => {
  const res = await axiosInstance.get('/api/boxes');
  return res.data;
};

// Get box by ID (public route)
export const getBoxById = async (boxId) => {
  const res = await axiosInstance.get(`/api/boxes/${boxId}`);
  return res.data;
};

// Get box color availability by code (for challan generation)
export const getBoxAvailability = async (boxCode) => {
  const res = await axiosInstance.get(`/api/boxes/availability/${boxCode}`);
  return res.data;
};

// Create a new box (admin only - requires authentication)
// boxData should be a FormData object with the image file and other fields
// Example usage:
//   const formData = new FormData();
//   formData.append('image', imageFile);
//   formData.append('title', 'Box Title');
//   formData.append('code', 'BOX001');
//   formData.append('price', '100');
//   formData.append('bagSize', '6 x 5 x 1.75 inch');
//   formData.append('boxInnerSize', '4 x 4 x 1.5 inch');
//   formData.append('boxOuterSize', '4.74 x 4.75 x 1.5 inch');
//   formData.append('moq', '30 - 150PC (10pc single colour packing)');
//   formData.append('assemblyCharge', '5');
//   formData.append('additionalShippingCharges', 'true');
export const createBox = async (boxData) => {
  // For FormData, axios will automatically set Content-Type with boundary
  // We need to delete the default Content-Type header for FormData
  let config = {};
  if (boxData instanceof FormData) {
    config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
  }
  
  const res = await axiosInstance.post('/api/boxes', boxData, config);
  return res.data;
};

// Update a box (admin only - requires authentication)
// boxData can be either:
//   - FormData object (if updating with new image)
//   - Plain object (if updating without image)
// Example usage with image:
//   const formData = new FormData();
//   if (newImage) formData.append('image', newImage);
//   formData.append('title', 'Updated Title');
//   formData.append('price', '150');
// Example usage without image:
//   const data = { title: 'Updated Title', price: 150 };
export const updateBox = async (boxId, boxData) => {
  // For FormData, axios will automatically set Content-Type with boundary
  // We need to set Content-Type header for FormData
  let config = {};
  if (boxData instanceof FormData) {
    config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
  }
  
  const res = await axiosInstance.put(`/api/boxes/${boxId}`, boxData, config);
  return res.data;
};

// Delete a box (admin only - requires authentication)
export const deleteBox = async (boxId) => {
  const res = await axiosInstance.delete(`/api/boxes/${boxId}`);
  return res.data;
};

// Add quantity to a box (authenticated users)
export const addBoxQuantity = async (boxId, payload) => {
  // payload: { quantity: number, color: string, note?: string }
  const res = await axiosInstance.post(`/api/boxes/${boxId}/add`, payload);
  return res.data;
};

// Subtract quantity from a box (authenticated users)
export const subtractBoxQuantity = async (boxId, payload) => {
  // payload: { quantity: number, note?: string }
  const res = await axiosInstance.post(`/api/boxes/${boxId}/subtract`, payload);
  return res.data;
};

// Admin: get audits for a specific box
export const getBoxAudits = async (boxId) => {
  const res = await axiosInstance.get(`/api/boxes/${boxId}/audits`);
  return res.data;
};

// Admin: get all audits
export const getAllAudits = async () => {
  const res = await axiosInstance.get(`/api/boxes/audits`);
  return res.data;
};

// Admin: add a new color to a box
export const addColorToBox = async (boxId, colorName) => {
  const res = await axiosInstance.post(`/api/boxes/${boxId}/add-color`, { color: colorName });
  return res.data;
};

