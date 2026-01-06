/**
 * Color Normalization Utility
 * Ensures consistent color matching across inventory and challan operations
 */

/**
 * Normalize color string for storage and comparison
 * @param {string} color - Raw color string
 * @returns {string} Normalized color (trimmed, lowercase)
 */
export const normalizeColor = (color) => {
  if (!color || typeof color !== "string") return "";
  return color.trim().toLowerCase();
};

/**
 * Check if two colors match (case-insensitive, whitespace-insensitive)
 * @param {string} color1 - First color
 * @param {string} color2 - Second color
 * @returns {boolean} True if colors match
 */
export const colorsMatch = (color1, color2) => {
  return normalizeColor(color1) === normalizeColor(color2);
};

/**
 * Normalize a color quantity map/object keys
 * Converts all color keys to normalized form
 * @param {Map|Object} quantityByColor - Map or object with color keys
 * @returns {Map} New map with normalized color keys
 */
export const normalizeQuantityMap = (quantityByColor) => {
  if (!quantityByColor) return new Map();

  const normalized = new Map();

  if (quantityByColor instanceof Map) {
    quantityByColor.forEach((qty, color) => {
      const normalizedColor = normalizeColor(color);
      if (normalizedColor) {
        normalized.set(normalizedColor, Number(qty) || 0);
      }
    });
  } else if (typeof quantityByColor === "object") {
    Object.entries(quantityByColor).forEach(([color, qty]) => {
      const normalizedColor = normalizeColor(color);
      if (normalizedColor) {
        normalized.set(normalizedColor, Number(qty) || 0);
      }
    });
  }

  return normalized;
};

export default {
  normalizeColor,
  colorsMatch,
  normalizeQuantityMap,
};
