/**
 * Calculate total quantity from various data structures
 * Handles color-wise quantities, quantity maps, and fallback values
 */

export const getTotalQty = (data) => {
  if (!data) return 0;

  // If it's a colorLines array (from manual rows in ChallanGeneration)
  if (Array.isArray(data.colorLines)) {
    // Sum availableQty from all color lines
    return data.colorLines.reduce((sum, line) => {
      const qty = Number(line.availableQty || 0);
      return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
    }, 0);
  }

  // If it's a box object with quantityByColor Map (converted to object in API response)
  if (data.quantityByColor && typeof data.quantityByColor === "object") {
    return Object.values(data.quantityByColor).reduce((sum, qty) => {
      const num = Number(qty || 0);
      return sum + (Number.isFinite(num) && num > 0 ? num : 0);
    }, 0);
  }

  // If it has totalQuantity field (computed by backend)
  if (Number.isFinite(Number(data.totalQuantity))) {
    return Number(data.totalQuantity);
  }

  // If it has a direct quantity field
  if (Number.isFinite(Number(data.quantity))) {
    return Number(data.quantity);
  }

  // If it's a colours array with quantity property
  if (Array.isArray(data.colours)) {
    return data.colours.reduce((sum, color) => {
      if (typeof color === "object" && color.quantity) {
        const qty = Number(color.quantity || 0);
        return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
      }
      return sum;
    }, 0);
  }

  return 0;
};

/**
 * Get available total quantity (sum of availableQty from color lines)
 * Used specifically for showing available stock in dispatch context
 */
export const getTotalAvailableQty = (colorLines) => {
  if (!Array.isArray(colorLines)) return 0;

  return colorLines.reduce((sum, line) => {
    const qty = Number(line.availableQty || 0);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
};

/**
 * Get total dispatch quantity (sum of dispatchQty from color lines)
 * Used for calculating actual dispatch amounts
 */
export const getTotalDispatchQty = (colorLines) => {
  if (!Array.isArray(colorLines)) return 0;

  return colorLines.reduce((sum, line) => {
    const qty = Number(line.dispatchQty || 0);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
};
