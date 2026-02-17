/**
 * Indian Financial Year Range calculation for challan numbering
 * 
 * Uses Indian Financial Year logic (Apr-Mar):
 * - Apr 2025 to Mar 2026 → "25-26"
 * - Apr 2026 to Mar 2027 → "26-27"
 * 
 * @param {Date|string} date - Date to calculate financial year for
 * @returns {string} Financial year in format "YY-YY" (e.g., "25-26")
 * 
 * @example
 * getFinancialYear(new Date(2026, 0, 15)) // "25-26" (15 Jan 2026, within Apr 2025 - Mar 2026)
 * getFinancialYear(new Date(2026, 3, 15)) // "26-27" (15 Apr 2026, start of new FY)
 * getFinancialYear(new Date(2025, 11, 31)) // "25-26" (31 Dec 2025, within Apr 2025 - Mar 2026)
 */
export function getFinancialYear(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0 = January, 3 = April, 11 = December
  
  // Financial year starts in April (month 3, since 0-indexed)
  // If current month is April (3) or later: FY = year-(year+1)
  //   e.g., May 2025 (month=4, year=2025) → 2025-2026 → "25-26"
  // If current month is before April (Jan-Mar): FY = (year-1)-year
  //   e.g., Jan 2026 (month=0, year=2026) → 2025-2026 → "25-26"
  let fyStart, fyEnd;
  
  if (month >= 3) { // April (3) onwards
    fyStart = year;
    fyEnd = year + 1;
  } else { // January to March (before April)
    fyStart = year - 1;
    fyEnd = year;
  }
  
  // Get last two digits of each year
  const fyStartStr = String(fyStart).slice(-2);
  const fyEndStr = String(fyEnd).slice(-2);
  
  return `${fyStartStr}-${fyEndStr}`;
}

/**
 * Get the actual start and end dates of a given financial year
 * 
 * Indian Financial Year: April 1 to March 31
 * 
 * @param {string} fy - Financial year label in format "YY-YY" (e.g., "25-26")
 * @returns {object} Object with startDate and endDate
 * 
 * @example
 * getFYDateRange("25-26")
 * // Returns: { startDate: 2025-04-01, endDate: 2026-03-31 }
 * 
 * getFYDateRange("26-27")
 * // Returns: { startDate: 2026-04-01, endDate: 2027-03-31 }
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
    startDate: new Date(startYear, 3, 1), // April 1 (month 3)
    endDate: new Date(endYear, 2, 31), // March 31 (month 2, day 31)
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
 * Format sequence number to 3 digits with leading zeros
 * 
 * @param {number} seq - Sequence number
 * @returns {string} Padded sequence (e.g., "001", "123")
 * 
 * @example
 * formatChallanSequence(1) // "001"
 * formatChallanSequence(12) // "012"
 * formatChallanSequence(123) // "123"
 * formatChallanSequence(1234) // "1234"
 */
export function formatChallanSequence(seq) {
  if (typeof seq !== 'number' || seq < 1 || seq > 9999) {
    throw new Error(`Invalid sequence number: ${seq}. Must be 1-9999`);
  }
  return String(seq).padStart(3, '0');
}

/**
 * Generate GST challan number in format: VPP/YY-YY/SEQQ
 * 
 * @param {string} fy - Year range (e.g., "26-27")
 * @param {number} seq - Sequence number for this year range
 * @returns {string} Challan number (e.g., "VPP/26-27/001")
 * 
 * @example
 * generateGSTChallanNumber("26-27", 1) // "VPP/26-27/001"
 * generateGSTChallanNumber("26-27", 123) // "VPP/26-27/123"
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
 * @returns {string} Challan number (e.g., "VPP-NG/26-27/001")
 */
export function generateNonGSTChallanNumber(fy, seq) {
  const paddedSeq = formatChallanSequence(seq);
  return `VPP-NG/${fy}/${paddedSeq}`;
}
