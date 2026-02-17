/**
 * Inventory Management Utilities
 * Centralized logic for stock validation, availability checks, and dispatch deductions
 * Source of truth: quantityByColor Map in Box model
 */

import { normalizeColor, normalizeQuantityMap } from "./colorNormalization.js";

/**
 * Strict color normalizer - consolidates multiple spaces
 * "Dark  Green" -> "dark green"
 * @param {string} s - Raw color string
 * @returns {string} Normalized: lowercase, trimmed, single spaces
 */
const strictNormColor = (s) => {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " "); // Replace multiple spaces with single space
};

/**
 * Get stock map from a box document
 * Returns a normalized Map<normalizedColor, number>
 * Treats missing quantities as 0
 * 
 * @param {Object} boxDoc - Box document from MongoDB
 * @param {Object} options - { debug: boolean }
 * @returns {Map<string, number>} Normalized stock map
 */
export const getStockMap = (boxDoc, options = {}) => {
  const { debug = false } = options;
  
  if (!boxDoc || !boxDoc.quantityByColor) {
    if (debug) console.log("[getStockMap] No quantityByColor found");
    return new Map();
  }
  
  const normalized = new Map();
  const boxCode = boxDoc?.code || "UNKNOWN";
  
  if (boxDoc.quantityByColor instanceof Map) {
    boxDoc.quantityByColor.forEach((qty, rawColor) => {
      const normalizedColor = strictNormColor(rawColor);
      if (normalizedColor) {
        normalized.set(normalizedColor, Number(qty) || 0);
        if (debug) {
          console.log(`[getStockMap] Box ${boxCode}: "${rawColor}" -> "${normalizedColor}" = ${Number(qty) || 0}`);
        }
      }
    });
  } else if (typeof boxDoc.quantityByColor === "object") {
    Object.entries(boxDoc.quantityByColor).forEach(([rawColor, qty]) => {
      const normalizedColor = strictNormColor(rawColor);
      if (normalizedColor) {
        normalized.set(normalizedColor, Number(qty) || 0);
        if (debug) {
          console.log(`[getStockMap] Box ${boxCode}: "${rawColor}" -> "${normalizedColor}" = ${Number(qty) || 0}`);
        }
      }
    });
  }
  
  if (debug) {
    const keys = Array.from(normalized.keys());
    console.log(`[getStockMap] Box ${boxCode}: Final normalized keys: [${keys.join(", ")}]`);
  }
  
  return normalized;
};

/**
 * Calculate total stock across all colors
 * 
 * @param {Object} boxDoc - Box document
 * @param {Object} options - { debug: boolean }
 * @returns {number} Total quantity
 */
export const getTotalStock = (boxDoc, options = {}) => {
  const stockMap = getStockMap(boxDoc, options);
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
 * @param {Object} options - { debug: boolean }
 * @returns {number} Available quantity for that color (0 if not found)
 */
export const getColorStock = (boxDoc, rawColor, options = {}) => {
  const normalizedColor = strictNormColor(rawColor);
  if (!normalizedColor) return 0;
  
  const stockMap = getStockMap(boxDoc, options);
  const qty = Number(stockMap.get(normalizedColor) || 0);
  
  if (options.debug) {
    console.log(`[getColorStock] rawColor="${rawColor}" -> normalized="${normalizedColor}" = ${qty}`);
  }
  
  return qty;
};

/**
 * Validate dispatch request against available inventory
 * Throws error if insufficient stock
 * 
 * @param {Object} boxDoc - Box document
 * @param {Array} dispatchList - Array of { color, qty } to dispatch
 * @param {Object} options - { debug: boolean }
 * @throws {Error} If any item has insufficient stock
 * @returns {boolean} true if valid
 */
export const validateDispatch = (boxDoc, dispatchList, options = {}) => {
  const { debug = true } = options; // Enable debug by default
  
  if (!Array.isArray(dispatchList) || dispatchList.length === 0) {
    return true; // Empty dispatch is valid
  }
  
  const stockMap = getStockMap(boxDoc, { debug });
  const boxCode = boxDoc?.code || "UNKNOWN";
  
  if (debug) {
    console.log(`\n[validateDispatch] ====== VALIDATION START ======`);
    console.log(`[validateDispatch] Box Code: ${boxCode}`);
    console.log(`[validateDispatch] Stock Map Keys: [${Array.from(stockMap.keys()).join(", ")}]`);
    console.log(`[validateDispatch] Stock Map Values: [${Array.from(stockMap.values()).join(", ")}]`);
  }
  
  for (const item of dispatchList) {
    const rawColor = item.color || "";
    const normColor = strictNormColor(rawColor);
    const requestedQty = Number(item.qty || 0);
    
    if (debug) {
      console.log(`[validateDispatch] Item: rawColor="${rawColor}" -> normalized="${normColor}", qty=${requestedQty}`);
    }
    
    if (!normColor || requestedQty <= 0) {
      if (debug) console.log(`[validateDispatch]   SKIP: invalid color or qty`);
      continue; // Skip invalid items
    }
    
    const availableQty = Number(stockMap.get(normColor) || 0);
    
    if (debug) {
      console.log(`[validateDispatch]   Available: ${availableQty}, Requested: ${requestedQty}`);
    }
    
    if (availableQty < requestedQty) {
      if (debug) console.log(`[validateDispatch] ====== VALIDATION FAILED ======\n`);
      throw new Error(
        `Insufficient stock for box "${boxCode}" color "${normColor}". ` +
        `Available: ${availableQty}, Required: ${requestedQty}`
      );
    }
  }
  
  if (debug) console.log(`[validateDispatch] ====== VALIDATION PASSED ======\n`);
  return true;
};

/**
 * Apply dispatch changes to box document (deduct from inventory)
 * Updates the quantityByColor Map in place
 * 
 * @param {Object} boxDoc - Box document (will be modified in place)
 * @param {Array} dispatchList - Array of { color, qty } to dispatch
 * @param {Object} options - Optional config { logFn: function, updateTotal: boolean, debug: boolean }
 * @returns {Map} Updated stock map
 */
export const applyDispatch = (boxDoc, dispatchList, options = {}) => {
  const { logFn = console.log, updateTotal = true, debug = true } = options;
  
  if (!Array.isArray(dispatchList) || dispatchList.length === 0) {
    return getStockMap(boxDoc, { debug });
  }
  
  const stockMap = getStockMap(boxDoc, { debug });
  const boxCode = boxDoc?.code || "UNKNOWN";
  
  if (debug) {
    logFn(`\n[applyDispatch] ====== DISPATCH START ======`);
    logFn(`[applyDispatch] Box Code: ${boxCode}`);
  }
  
  for (const item of dispatchList) {
    const rawColor = item.color || "";
    const normColor = strictNormColor(rawColor);
    const dispatchQty = Number(item.qty || 0);
    
    if (debug) {
      logFn(`[applyDispatch] Item: rawColor="${rawColor}" -> normalized="${normColor}", qty=${dispatchQty}`);
    }
    
    if (!normColor || dispatchQty <= 0) {
      if (debug) logFn(`[applyDispatch]   SKIP: invalid color or qty`);
      continue; // Skip invalid items
    }
    
    const currentQty = Number(stockMap.get(normColor) || 0);
    const newQty = Math.max(0, currentQty - dispatchQty);
    
    stockMap.set(normColor, newQty);
    
    logFn(
      `[applyDispatch] Box: ${boxCode}, Color: ${normColor}, ` +
      `Before: ${currentQty}, After: ${newQty}, Dispatched: ${dispatchQty}`
    );
  }
  
  // Write back to box document in original schema format
  boxDoc.quantityByColor = stockMap;
  
  // Update totalQuantity field if requested (for backward compatibility)
  if (updateTotal) {
    boxDoc.totalQuantity = getTotalStock(boxDoc, { debug: false });
    logFn(`[applyDispatch] Updated totalQuantity: ${boxDoc.totalQuantity}`);
  }
  
  if (debug) logFn(`[applyDispatch] ====== DISPATCH COMPLETE ======\n`);
  
  return stockMap;
};

/**
 * Get color availability array for API response
 * Returns array of { color, available } with normalized color names
 * 
 * @param {Object} boxDoc - Box document
 * @param {Object} options - { debug: boolean }
 * @returns {Array} Array of color availability objects
 */
export const getColorAvailabilityArray = (boxDoc, options = {}) => {
  const stockMap = getStockMap(boxDoc, options);
  const colors = [];
  
  stockMap.forEach((qty, color) => {
    if (color && color.trim()) {
      colors.push({
        color: color, // Already normalized
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
