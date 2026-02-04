/**
 * Shared challan totals calculation utility
 * Used by frontend (ChallanGeneration.jsx) and backend (challanController.js)
 * Ensures single source of truth for all calculations
 */

export const round2 = (num) => Math.round(num * 100) / 100;

/**
 * Calculate challan totals from items and global charges
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
    
    // For display purposes
    taxType,
  };
};

/**
 * Format a totals object for display (e.g., in PDFs, summaries)
 * @param {Object} totals - Result from calculateChallanTotals()
 * @returns {Array} Array of { label, value, isBold } for rendering in order
 */
export const formatTotalsForDisplay = (totals) => {
  const lines = [
    { label: "Items Subtotal", value: totals.itemsSubtotal, isBold: false },
  ];

  // Always show assembly charges, even if 0
  lines.push({
    label: "Assembly Charges",
    value: totals.assemblyTotal,
    isBold: false,
  });

  // Show packaging if > 0
  if (totals.packagingCharges > 0) {
    lines.push({
      label: "Packaging Charges",
      value: totals.packagingCharges,
      isBold: false,
    });
  }

  // Show discount if > 0
  if (totals.discountAmount > 0) {
    const discountLabel =
      totals.discountPct > 0
        ? `Discount (${totals.discountPct}%)`
        : "Discount";
    lines.push({
      label: discountLabel,
      value: -totals.discountAmount,
      isBold: false,
      isDiscount: true,
    });
  }

  // Taxable subtotal
  lines.push({
    label: "Taxable Subtotal",
    value: totals.taxableSubtotal,
    isBold: true,
  });

  // GST
  if (totals.gstRate > 0) {
    lines.push({
      label: `GST @ ${totals.gstRate}%`,
      value: totals.gstAmount,
      isBold: false,
    });
  } else {
    lines.push({
      label: "GST (0% - Non-GST)",
      value: 0,
      isBold: false,
    });
  }

  // Round off if applicable
  if (totals.roundOff !== 0) {
    const roundOffLabel =
      totals.roundOff > 0
        ? "Round Off (Added)"
        : "Round Off (Deducted)";
    lines.push({
      label: roundOffLabel,
      value: totals.roundOff,
      isBold: false,
    });
  }

  // Grand total
  lines.push({
    label: "Grand Total",
    value: totals.grandTotal,
    isBold: true,
    isGrandTotal: true,
  });

  return lines;
};
