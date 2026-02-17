/**
 * Inventory Management Utilities
 * Centralized logic for stock validation, availability checks, and dispatch deductions
 * Source of truth: quantityByColor Map in Box model (color keys normalized)
 */

import { normalizeColor, normalizeQuantityMap } from "./colorNormalization.js";

/**
 * Get stock map from a box document
 * Returns a normalized Map<normalizedColor, number>
 * Treats missing quantities as 0
 * 
 * @param {Object} boxDoc - Box document from MongoDB
 * @returns {Map<string, number>} Normalized stock map
 */
export const getStockMap = (boxDoc) => {
  if (!boxDoc || !boxDoc.quantityByColor) {
    return new Map();
  }
  
  // Use existing normalization utility which handles Map/Object conversion
  return normalizeQuantityMap(boxDoc.quantityByColor);
};

/**
 * Calculate total stock across all colors
 * 
 * @param {Object} boxDoc - Box document
 * @returns {number} Total quantity
 */
export const getTotalStock = (boxDoc) => {
  const stockMap = getStockMap(boxDoc);
  let total = 0;
  
  stockMap.forEach((qty) => {
    const num = Number(qty);
    if (Number.isFinite(num) && num > 0) {
      total += num;
    }
  });
  
  return total;
};

/**
 * Get available quantity for a specific color
 * 
 * @param {Object} boxDoc - Box document
 * @param {string} rawColor - Color name (will be normalized)
 * @returns {number} Available quantity for that color (0 if not found)
 */
export const getColorStock = (boxDoc, rawColor) => {
  const normalizedColor = normalizeColor(rawColor);
  if (!normalizedColor) return 0;
  
  const stockMap = getStockMap(boxDoc);
  return Number(stockMap.get(normalizedColor) || 0);
};

/**
 * Validate dispatch request against available inventory
 * Throws error if insufficient stock
 * 
 * @param {Object} boxDoc - Box document
 * @param {Array} dispatchList - Array of { color, qty } to dispatch
 * @throws {Error} If any item has insufficient stock
 * @returns {boolean} true if valid
 */
export const validateDispatch = (boxDoc, dispatchList) => {
  if (!Array.isArray(dispatchList) || dispatchList.length === 0) {
    return true; // Empty dispatch is valid
  }
  
  const stockMap = getStockMap(boxDoc);
  const boxCode = boxDoc?.code || "UNKNOWN";
  
  for (const item of dispatchList) {
    const normalizedColor = normalizeColor(item.color);
    const requestedQty = Number(item.qty || 0);
    
    if (!normalizedColor || requestedQty <= 0) {
      continue; // Skip invalid items
    }
    
    const availableQty = Number(stockMap.get(normalizedColor) || 0);
    
    if (availableQty < requestedQty) {
      throw new Error(
        `Insufficient stock for box "${boxCode}" color "${normalizedColor}". ` +
        `Available: ${availableQty}, Required: ${requestedQty}`
      );
    }
  }
  
  return true;
};

/**
 * Apply dispatch changes to box document (deduct from inventory)
 * Updates the quantityByColor Map in place
 * 
 * @param {Object} boxDoc - Box document (will be modified in place)
 * @param {Array} dispatchList - Array of { color, qty } to dispatch
 * @param {Object} options - Optional config { logFn: function, updateTotal: boolean }
 * @returns {Map} Updated stock map
 */
export const applyDispatch = (boxDoc, dispatchList, options = {}) => {
  const { logFn = console.log, updateTotal = true } = options;
  
  if (!Array.isArray(dispatchList) || dispatchList.length === 0) {
    return getStockMap(boxDoc);
  }
  
  const stockMap = getStockMap(boxDoc);
  const boxCode = boxDoc?.code || "UNKNOWN";
  
  for (const item of dispatchList) {
    const normalizedColor = normalizeColor(item.color);
    const dispatchQty = Number(item.qty || 0);
    
    if (!normalizedColor || dispatchQty <= 0) {
      continue; // Skip invalid items
    }
    
    const currentQty = Number(stockMap.get(normalizedColor) || 0);
    const newQty = currentQty - dispatchQty;
    
    stockMap.set(normalizedColor, Math.max(0, newQty));
    
    logFn(
      `[inventory-subtract] Box: ${boxCode}, Color: ${normalizedColor}, ` +
      `Before: ${currentQty}, After: ${Math.max(0, newQty)}, Dispatched: ${dispatchQty}`
    );
  }
  
  // Write back to box document in original schema format
  boxDoc.quantityByColor = stockMap;
  
  // Update totalQuantity field if requested (for backward compatibility)
  if (updateTotal) {
    boxDoc.totalQuantity = getTotalStock(boxDoc);
    logFn(
      `[inventory-total-updated] Box: ${boxCode}, New Total: ${boxDoc.totalQuantity}`
    );
  }
  
  return stockMap;
};

/**
 * Get color availability array for API response
 * Returns array of { color, available } with normalized color names
 * 
 * @param {Object} boxDoc - Box document
 * @returns {Array} Array of color availability objects
 */
export const getColorAvailabilityArray = (boxDoc) => {
  const stockMap = getStockMap(boxDoc);
  const colors = [];
  
  stockMap.forEach((qty, color) => {
    if (color && color.trim()) {
      colors.push({
        color: color, // Already normalized (lowercase, trimmed)
        available: Number(qty) || 0
      });
    }
  });
  
  // Sort by color name for consistent output
  colors.sort((a, b) => a.color.localeCompare(b.color));
  
  return colors;
};

export default {
  getStockMap,
  getTotalStock,
  getColorStock,
  validateDispatch,
  applyDispatch,
  getColorAvailabilityArray,
};
