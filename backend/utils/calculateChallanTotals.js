/**
 * Shared challan totals calculation utility (Backend)
 * Mirrors the frontend implementation to ensure consistency
 */

export const round2 = (num) => Math.round(num * 100) / 100;

/**
 * Calculate challan totals from items and global charges
 * Used during challan creation and updates
 * 
 * @param {Array} items - Array of challan items with: { rate, assemblyCharge, quantity }
 * @param {Object} options - Options object:
 *   - packagingChargesOverall: number (default 0)
 *   - discountPct: number 0-100 (default 0)
 *   - taxType: "GST" or "NON_GST" (default "GST")
 * @returns {Object} Complete totals breakdown
 */
export const calculateChallanTotals = (items = [], options = {}) => {
  const {
    packagingChargesOverall = 0,
    discountPct = 0,
    taxType = "GST",
  } = options;

  // Validate inputs
  if (!Array.isArray(items)) {
    items = [];
  }

  // Calculate subtotals by category
  let itemsSubtotal = 0;
  let assemblyTotal = 0;

  items.forEach((item) => {
    const rate = Number(item.rate || 0);
    const assembly = Number(item.assemblyCharge || 0);
    const qty = Number(item.quantity || 0);

    // Items total: rate * qty
    itemsSubtotal += rate * qty;
    // Assembly total: assembly charge * qty
    assemblyTotal += assembly * qty;
  });

  // Round to 2 decimals
  itemsSubtotal = round2(itemsSubtotal);
  assemblyTotal = round2(assemblyTotal);
  const packagingCharges = round2(Number(packagingChargesOverall) || 0);

  // Pre-discount subtotal: items + assembly + packaging
  const preDiscountSubtotal = round2(itemsSubtotal + assemblyTotal + packagingCharges);

  // Calculate discount on pre-discount subtotal
  const discountAmount = round2(
    preDiscountSubtotal * Math.min(Math.max(Number(discountPct) || 0, 0), 100) / 100
  );

  // Taxable amount after discount
  const taxableSubtotal = round2(preDiscountSubtotal - discountAmount);

  // GST calculation (only for GST challans)
  const gstRate = taxType === "NON_GST" ? 0 : 0.05;
  const gstAmount = round2(taxableSubtotal * gstRate);

  // Grand total
  const totalBeforeRound = round2(taxableSubtotal + gstAmount);
  const grandTotal = Math.round(totalBeforeRound);
  const roundOff = round2(grandTotal - totalBeforeRound);

  return {
    // Breakdown of amounts
    itemsSubtotal,
    assemblyTotal,
    packagingCharges,
    
    // Discount
    discountPct: Number(discountPct) || 0,
    discountAmount,
    
    // Before GST
    preDiscountSubtotal,
    taxableSubtotal,
    
    // Tax and totals
    gstRate: gstRate * 100, // As percentage (0 or 5)
    gstAmount,
    
    // Final
    totalBeforeRound,
    roundOff,
    grandTotal,
    
    // For data storage
    taxType,
  };
};
