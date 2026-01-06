#!/usr/bin/env node

/**
 * Quick Verification Script for Three-Mode Inventory System
 * 
 * This script verifies that all necessary changes have been implemented correctly
 * Run from the root of the project: node verify-three-modes.js
 */

const fs = require('fs');
const path = require('path');

const checks = {
  passed: [],
  failed: [],
};

function check(description, condition, details = "") {
  if (condition) {
    checks.passed.push(description);
    console.log(`✅ ${description}`);
  } else {
    checks.failed.push({ description, details });
    console.log(`❌ ${description}`);
    if (details) console.log(`   Details: ${details}`);
  }
}

console.log("=== Three-Mode Inventory System Verification ===\n");

// 1. Check backend model has inventory_mode
console.log("1. Backend Model (challanModel.js):");
const challanModelPath = path.join(__dirname, "backend/models/challanModel.js");
if (fs.existsSync(challanModelPath)) {
  const content = fs.readFileSync(challanModelPath, "utf-8");
  check("Has inventory_mode field", content.includes("inventory_mode"));
  check("Has enum with dispatch/inward/record_only", 
    content.includes("enum: [\"dispatch\", \"inward\", \"record_only\"]") ||
    content.includes('enum: ["dispatch", "inward", "record_only"]'));
  check("Has default: record_only", content.includes('default: "record_only"'));
} else {
  checks.failed.push({ description: "challanModel.js not found" });
}

// 2. Check colorNormalization utility exists
console.log("\n2. Color Normalization Utility:");
const colorNormPath = path.join(__dirname, "backend/utils/colorNormalization.js");
if (fs.existsSync(colorNormPath)) {
  const content = fs.readFileSync(colorNormPath, "utf-8");
  check("normalizeColor function exists", content.includes("export") && content.includes("normalizeColor"));
  check("colorsMatch function exists", content.includes("colorsMatch"));
  check("normalizeQuantityMap function exists", content.includes("normalizeQuantityMap"));
} else {
  checks.failed.push({ description: "colorNormalization.js not found" });
}

// 3. Check challanController has proper imports and logic
console.log("\n3. Backend Controller (challanController.js):");
const controllerPath = path.join(__dirname, "backend/controllers/challanController.js");
if (fs.existsSync(controllerPath)) {
  const content = fs.readFileSync(controllerPath, "utf-8");
  check("Imports colorNormalization", 
    content.includes("normalizeColor") && content.includes("colorNormalization"));
  check("Uses inventory_mode parameter", content.includes("inventory_mode"));
  check("Has dispatch mode logic", content.includes('if (invMode === "dispatch")'));
  check("Has inward mode logic", content.includes('if (invMode === "inward")'));
  check("Has record_only mode logic", content.includes('if (invMode === "record_only")'));
  check("Validates before subtraction", 
    content.includes("Validate") || content.includes("validation"));
  check("Normalizes colors in validation", 
    content.includes("normalizeColor"));
} else {
  checks.failed.push({ description: "challanController.js not found" });
}

// 4. Check frontend component updated
console.log("\n4. Frontend Component (ChallanGeneration.jsx):");
const frontendPath = path.join(__dirname, "client/src/pages/admin/ChallanGeneration.jsx");
if (fs.existsSync(frontendPath)) {
  const content = fs.readFileSync(frontendPath, "utf-8");
  check("Uses inventoryMode state", 
    content.includes("const [inventoryMode") || content.includes("inventoryMode"));
  check("Has record_only option", content.includes('value="record_only"'));
  check("Has dispatch option", content.includes('value="dispatch"'));
  check("Has inward option", content.includes('value="inward"'));
  check("Sends inventory_mode in payload", content.includes("inventory_mode:"));
  check("Has warning text for dispatch mode", 
    content.includes("subtract stock") || content.includes("will subtract stock"));
} else {
  checks.failed.push({ description: "ChallanGeneration.jsx not found" });
}

// 5. Summary
console.log("\n=== Summary ===");
console.log(`✅ Passed: ${checks.passed.length}`);
console.log(`❌ Failed: ${checks.failed.length}`);

if (checks.failed.length > 0) {
  console.log("\nFailed Checks:");
  checks.failed.forEach(({ description, details }) => {
    console.log(`  - ${description}`);
    if (details) console.log(`    ${details}`);
  });
  process.exit(1);
} else {
  console.log("\n🎉 All checks passed! System ready for testing.");
  process.exit(0);
}
