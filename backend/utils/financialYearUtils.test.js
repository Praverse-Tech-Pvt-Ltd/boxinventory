/**
 * Test cases for Financial Year (FY) utilities
 */

import { 
  getFinancialYear, 
  formatChallanSequence, 
  generateGSTChallanNumber,
  generateNonGSTChallanNumber 
} from './financialYearUtils.js';

// Test FY calculation
const testCases = [
  // Apr-Dec = same year FY
  { date: new Date(2025, 3, 1), expectedFY: '25-26', description: '1 Apr 2025' },
  { date: new Date(2025, 11, 21), expectedFY: '25-26', description: '21 Dec 2025' },
  
  // Jan-Mar = previous year FY
  { date: new Date(2026, 0, 15), expectedFY: '25-26', description: '15 Jan 2026' },
  { date: new Date(2026, 1, 15), expectedFY: '25-26', description: '15 Feb 2026' },
  { date: new Date(2026, 2, 31), expectedFY: '25-26', description: '31 Mar 2026' },
  
  // New FY starts Apr 1
  { date: new Date(2026, 3, 1), expectedFY: '26-27', description: '1 Apr 2026' },
  { date: new Date(2026, 11, 25), expectedFY: '26-27', description: '25 Dec 2026' },
  
  // String dates
  { date: '2025-04-01', expectedFY: '25-26', description: 'String: 2025-04-01' },
  { date: '2026-03-31', expectedFY: '25-26', description: 'String: 2026-03-31' },
  { date: '2026-04-01', expectedFY: '26-27', description: 'String: 2026-04-01' },
];

console.log('🧪 Testing Financial Year Calculation\n');

testCases.forEach(({ date, expectedFY, description }) => {
  try {
    const result = getFinancialYear(date);
    const passed = result === expectedFY;
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${description}`);
    if (!passed) {
      console.log(`   Expected: ${expectedFY}, Got: ${result}`);
    }
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
  }
});

// Test sequence formatting
console.log('\n🧪 Testing Sequence Formatting\n');

const seqTests = [
  { seq: 1, expected: '001' },
  { seq: 12, expected: '012' },
  { seq: 123, expected: '123' },
  { seq: 1234, expected: '1234' },
];

seqTests.forEach(({ seq, expected }) => {
  try {
    const result = formatChallanSequence(seq);
    const passed = result === expected;
    const status = passed ? '✅' : '❌';
    console.log(`${status} Seq ${seq} → ${result} (expected ${expected})`);
  } catch (error) {
    console.log(`❌ Seq ${seq}: ${error.message}`);
  }
});

// Test challan number generation
console.log('\n🧪 Testing Challan Number Generation\n');

const genTests = [
  { fy: '25-26', seq: 1, prefix: 'VPP', expected: 'VPP/25-26/001' },
  { fy: '25-26', seq: 123, prefix: 'VPP', expected: 'VPP/25-26/123' },
  { fy: '26-27', seq: 1, prefix: 'VPP', expected: 'VPP/26-27/001' },
  { fy: '25-26', seq: 1, prefix: 'NGST', expected: 'VPP-NG/25-26/001' },
];

genTests.forEach(({ fy, seq, prefix, expected }) => {
  try {
    const result = prefix === 'VPP' 
      ? generateGSTChallanNumber(fy, seq)
      : generateNonGSTChallanNumber(fy, seq);
    const passed = result === expected;
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${prefix}/${fy}/${String(seq).padStart(4, '0')} → ${result}`);
  } catch (error) {
    console.log(`❌ ${prefix}/${fy}/seq${seq}: ${error.message}`);
  }
});

console.log('\n✨ All tests completed!');
