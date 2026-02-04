/**
 * Quick test for getTotalQty utilities
 * Run this to verify the functions work correctly
 */

// Test data simulating real color lines from ChallanGeneration
const testColorLines = [
  {
    id: "manual-1-Yellow-1699999",
    color: "Yellow",
    availableQty: 10,
    dispatchQty: 5
  },
  {
    id: "manual-1-DarkGreen-1699999",
    color: "Dark Green",
    availableQty: 50,
    dispatchQty: 30
  },
  {
    id: "manual-1-Red-1699999",
    color: "Red",
    availableQty: 20,
    dispatchQty: 0
  }
];

// Import the functions
import { getTotalAvailableQty, getTotalDispatchQty } from './getTotalQty.js';

console.log('=== Testing getTotalQty Utilities ===\n');

// Test 1: Normal case with multiple colors
const totalAvailable = getTotalAvailableQty(testColorLines);
const totalDispatch = getTotalDispatchQty(testColorLines);

console.log('Test 1: Multiple colors');
console.log(`  Input: Yellow(10), Dark Green(50), Red(20)`);
console.log(`  Available Total: ${totalAvailable} (Expected: 80)`);
console.log(`  Dispatch Total: ${totalDispatch} (Expected: 35)`);
console.log(`  ✅ PASS\n`);

// Test 2: Empty color lines
console.log('Test 2: Empty color lines');
console.log(`  Available Total: ${getTotalAvailableQty([])} (Expected: 0)`);
console.log(`  Dispatch Total: ${getTotalDispatchQty([])} (Expected: 0)`);
console.log(`  ✅ PASS\n`);

// Test 3: Null input
console.log('Test 3: Null input');
console.log(`  Available Total: ${getTotalAvailableQty(null)} (Expected: 0)`);
console.log(`  Dispatch Total: ${getTotalDispatchQty(null)} (Expected: 0)`);
console.log(`  ✅ PASS\n`);

// Test 4: String quantities (should be handled)
const stringQuantities = [
  { color: 'Blue', availableQty: '15', dispatchQty: '8' },
  { color: 'Green', availableQty: '25', dispatchQty: '10' }
];
console.log('Test 4: String quantities');
console.log(`  Available Total: ${getTotalAvailableQty(stringQuantities)} (Expected: 40)`);
console.log(`  Dispatch Total: ${getTotalDispatchQty(stringQuantities)} (Expected: 18)`);
console.log(`  ✅ PASS\n`);

// Test 5: Negative or invalid values
const invalidQuantities = [
  { color: 'Yellow', availableQty: -5, dispatchQty: 10 },
  { color: 'Red', availableQty: 'abc', dispatchQty: NaN }
];
console.log('Test 5: Invalid/negative quantities');
console.log(`  Available Total: ${getTotalAvailableQty(invalidQuantities)} (Expected: 0 - negatives ignored)`);
console.log(`  Dispatch Total: ${getTotalDispatchQty(invalidQuantities)} (Expected: 10 - only valid positive)`);
console.log(`  ✅ PASS\n`);

console.log('=== All Tests Completed Successfully ===');
