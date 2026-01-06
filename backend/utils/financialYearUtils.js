/**
 * Calendar Year Range calculation for challan numbering
 * 
 * Uses calendar year logic (Jan-Dec) for year range:
 * - Jan 2026 → "26-27" (current year to next year)
 * - Jan 2027 → "27-28"
 * 
 * This is different from Indian Financial Year (Apr-Mar)
 */

/**
 * Calculate Calendar Year Range from a given date
 * 
 * Rules:
 * - Get current year and next year
 * - Return format: YY-YY (e.g., "26-27" for 2026)
 * 
 * @param {Date|string} date - Date to calculate year range for
 * @returns {string} Year range in format "YY-YY" (e.g., "26-27")
 * 
 * @example
 * getFinancialYear(new Date(2026, 0, 1)) // "26-27" (1 Jan 2026)
 * getFinancialYear(new Date(2026, 11, 31)) // "26-27" (31 Dec 2026)
 * getFinancialYear(new Date(2027, 0, 1)) // "27-28" (1 Jan 2027)
 */
export function getFinancialYear(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  const year = dateObj.getFullYear();
  const nextYear = year + 1;
  
  // Get last two digits of each year
  const yearStr = String(year).slice(-2);
  const nextYearStr = String(nextYear).slice(-2);
  
  return `${yearStr}-${nextYearStr}`;
}

/**
 * Get the actual start and end dates of a given year range
 * 
 * @param {string} fy - Year range label in format "YY-YY" (e.g., "26-27")
 * @returns {object} Object with startDate and endDate
 * 
 * @example
 * getFYDateRange("26-27")
 * // Returns: { startDate: 2026-01-01, endDate: 2026-12-31 }
 */
export function getFYDateRange(fy) {
  const [startYyStr, endYyStr] = fy.split('-');
  
  // Convert YY to full year
  // Assume 20YY for 00-99 range (works for 2000-2099)
  const startYear = parseInt(`20${startYyStr}`, 10);
  const endYear = parseInt(`20${endYyStr}`, 10);
  
  // Validate that end year is start year + 1
  if (endYear !== startYear + 1) {
    throw new Error(`Invalid year range format: ${fy}. End year must be start year + 1`);
  }
  
  return {
    startDate: new Date(startYear, 0, 1), // January 1
    endDate: new Date(startYear, 11, 31), // December 31
  };
}

/**
 * Validate if a given date falls within a year range
 * 
 * @param {Date|string} date - Date to validate
 * @param {string} fy - Year range label in format "YY-YY"
 * @returns {boolean} True if date is within year range
 */
export function isDateInFY(date, fy) {
  const calculatedFY = getFinancialYear(date);
  return calculatedFY === fy;
}

/**
 * Format sequence number to 4 digits with leading zeros
 * 
 * @param {number} seq - Sequence number
 * @returns {string} Padded sequence (e.g., "0001", "1234")
 * 
 * @example
 * formatChallanSequence(1) // "0001"
 * formatChallanSequence(12) // "0012"
 * formatChallanSequence(123) // "0123"
 * formatChallanSequence(1234) // "1234"
 */
export function formatChallanSequence(seq) {
  if (typeof seq !== 'number' || seq < 1 || seq > 9999) {
    throw new Error(`Invalid sequence number: ${seq}. Must be 1-9999`);
  }
  return String(seq).padStart(4, '0');
}

/**
 * Generate GST challan number in format: VPP/YY-YY/SEQQ
 * 
 * @param {string} fy - Year range (e.g., "26-27")
 * @param {number} seq - Sequence number for this year range
 * @returns {string} Challan number (e.g., "VPP/26-27/0001")
 * 
 * @example
 * generateGSTChallanNumber("26-27", 1) // "VPP/26-27/0001"
 * generateGSTChallanNumber("26-27", 123) // "VPP/26-27/0123"
 */
export function generateGSTChallanNumber(fy, seq) {
  const paddedSeq = formatChallanSequence(seq);
  return `VPP/${fy}/${paddedSeq}`;
}

/**
 * Generate Non-GST challan number in format: VPP-NG/YY-YY/SEQQ
 * 
 * @param {string} fy - Year range (e.g., "26-27")
 * @param {number} seq - Sequence number for this year range
 * @returns {string} Challan number (e.g., "VPP-NG/26-27/0001")
 */
export function generateNonGSTChallanNumber(fy, seq) {
  const paddedSeq = formatChallanSequence(seq);
  return `VPP-NG/${fy}/${paddedSeq}`;
}
