/**
 * Financial Year (FY) calculation and management utilities for Indian FY system
 * 
 * FY runs from 1 April to 31 March
 * Example: 01-Apr-2025 to 31-Mar-2026 = FY 25-26
 */

/**
 * Calculate Financial Year from a given date
 * 
 * Rules:
 * - If month is Apr (4) to Dec (12): FY start year = current year
 * - If month is Jan (1) to Mar (3): FY start year = current year - 1
 * - FY label = last two digits of start year + "-" + last two digits of (start year + 1)
 * 
 * @param {Date|string} date - Date to calculate FY for
 * @returns {string} FY in format "YY-YY" (e.g., "25-26")
 * 
 * @example
 * getFinancialYear(new Date(2025, 3, 1)) // "25-26" (1 Apr 2025)
 * getFinancialYear(new Date(2025, 11, 21)) // "25-26" (21 Dec 2025)
 * getFinancialYear(new Date(2026, 1, 15)) // "25-26" (15 Feb 2026)
 * getFinancialYear(new Date(2026, 2, 31)) // "25-26" (31 Mar 2026)
 * getFinancialYear(new Date(2026, 3, 1)) // "26-27" (1 Apr 2026)
 */
export function getFinancialYear(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
  
  // If month is Apr (4) to Dec (12), FY starts in current year
  // If month is Jan (1) to Mar (3), FY started in previous year
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  
  // Get last two digits of each year
  const fyStartYearStr = String(fyStartYear).slice(-2);
  const fyEndYearStr = String(fyEndYear).slice(-2);
  
  return `${fyStartYearStr}-${fyEndYearStr}`;
}

/**
 * Get the actual start and end dates of a given FY
 * 
 * @param {string} fy - FY label in format "YY-YY" (e.g., "25-26")
 * @returns {object} Object with startDate and endDate
 * 
 * @example
 * getFYDateRange("25-26")
 * // Returns: { startDate: 2025-04-01, endDate: 2026-03-31 }
 */
export function getFYDateRange(fy) {
  const [startYyStr, endYyStr] = fy.split('-');
  
  // Convert YY to full year
  // Assume 20YY for 00-99 range (works for 2000-2099)
  const startYear = parseInt(`20${startYyStr}`, 10);
  const endYear = parseInt(`20${endYyStr}`, 10);
  
  // Validate that end year is start year + 1
  if (endYear !== startYear + 1) {
    throw new Error(`Invalid FY format: ${fy}. End year must be start year + 1`);
  }
  
  return {
    startDate: new Date(startYear, 3, 1), // April 1
    endDate: new Date(endYear, 2, 31), // March 31 (last day of Mar)
  };
}

/**
 * Validate if a given date falls within a FY range
 * 
 * @param {Date|string} date - Date to validate
 * @param {string} fy - FY label in format "YY-YY"
 * @returns {boolean} True if date is within FY
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
 * Generate GST challan number in format: VPP/FY/SEQQ
 * 
 * @param {string} fy - Financial Year (e.g., "25-26")
 * @param {number} seq - Sequence number for this FY
 * @returns {string} Challan number (e.g., "VPP/25-26/0001")
 * 
 * @example
 * generateGSTChallanNumber("25-26", 1) // "VPP/25-26/0001"
 * generateGSTChallanNumber("25-26", 123) // "VPP/25-26/0123"
 */
export function generateGSTChallanNumber(fy, seq) {
  const paddedSeq = formatChallanSequence(seq);
  return `VPP/${fy}/${paddedSeq}`;
}

/**
 * Generate Non-GST challan number in format: NGST/FY/SEQQ
 * 
 * @param {string} fy - Financial Year (e.g., "25-26")
 * @param {number} seq - Sequence number for this FY
 * @returns {string} Challan number (e.g., "NGST/25-26/0001")
 */
export function generateNonGSTChallanNumber(fy, seq) {
  const paddedSeq = formatChallanSequence(seq);
  return `NGST/${fy}/${paddedSeq}`;
}
