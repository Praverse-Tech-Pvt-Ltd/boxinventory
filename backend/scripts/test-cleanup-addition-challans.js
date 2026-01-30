/**
 * Test script for cleaning up addition/inward challans
 * 
 * Creates 2 stock inward challans + 1 dispatch challan
 * Tests dry-run mode → verifies 2 would be deleted
 * Tests real delete mode → deletes 2
 * Verifies challans list contains only dispatch challan
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Challan from "../models/challanModel.js";
import BoxAudit from "../models/boxAuditModel.js";
import Box from "../models/boxModel.js";
import User from "../models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/boxinventory";

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.connection.close();
  console.log("✅ MongoDB disconnected");
}

async function createTestData() {
  try {
    console.log("\n========== SETUP: Creating test data ==========\n");

    // Get or create a test admin user
    let adminUser = await User.findOne({ email: "test@gmail.com" });
    if (!adminUser) {
      adminUser = await User.create({
        name: "Test Admin",
        email: "test@gmail.com",
        password: "hashed_password",
        role: "admin",
      });
      console.log("✅ Created test admin user");
    }

    // Create a test box
    let testBox = await Box.findOne({ code: "TEST_BOX_001" });
    if (!testBox) {
      testBox = await Box.create({
        title: "Test Box",
        code: "TEST_BOX_001",
        category: "Test Category",
        price: 100,
        colours: ["Red", "Blue"],
      });
      console.log("✅ Created test box");
    }

    // Create Stock Inward Challan #1
    const inwardChallan1 = await Challan.create({
      number: "VPP-NG/26-27/INWARD-001",
      challan_seq: 1001,
      challan_fy: "26-27",
      challan_tax_type: "GST",
      doc_type: "STOCK_INWARD_RECEIPT",
      inventory_mode: "inward",
      items: [
        {
          box: {
            _id: testBox._id,
            title: testBox.title,
            code: testBox.code,
            category: testBox.category,
          },
          quantity: 100,
          rate: 100,
          assemblyCharge: 0,
          color: "Red",
        },
      ],
      createdBy: adminUser._id,
      clientDetails: {
        name: "Inward Client 1",
        address: "Test Address 1",
        mobile: "9999999991",
        gstNumber: "GST001",
      },
    });
    console.log(`✅ Created stock inward challan #1: ${inwardChallan1.number}`);

    // Create audit for inward challan #1
    const audit1 = await BoxAudit.create({
      box: testBox._id,
      user: adminUser._id,
      quantity: 100,
      color: "Red",
      action: "add",
      doc_type: "STOCK_INWARD_RECEIPT",
      challan: inwardChallan1._id,
      note: `Stock inward for ${inwardChallan1.number}`,
    });
    console.log(`✅ Created audit for inward challan #1`);

    // Create Stock Inward Challan #2
    const inwardChallan2 = await Challan.create({
      number: "VPP-NG/26-27/INWARD-002",
      challan_seq: 1002,
      challan_fy: "26-27",
      challan_tax_type: "GST",
      doc_type: "STOCK_INWARD_RECEIPT",
      inventory_mode: "inward",
      items: [
        {
          box: {
            _id: testBox._id,
            title: testBox.title,
            code: testBox.code,
            category: testBox.category,
          },
          quantity: 50,
          rate: 100,
          assemblyCharge: 0,
          color: "Blue",
        },
      ],
      createdBy: adminUser._id,
      clientDetails: {
        name: "Inward Client 2",
        address: "Test Address 2",
        mobile: "9999999992",
        gstNumber: "GST002",
      },
    });
    console.log(`✅ Created stock inward challan #2: ${inwardChallan2.number}`);

    // Create audit for inward challan #2
    const audit2 = await BoxAudit.create({
      box: testBox._id,
      user: adminUser._id,
      quantity: 50,
      color: "Blue",
      action: "add",
      doc_type: "STOCK_INWARD_RECEIPT",
      challan: inwardChallan2._id,
      note: `Stock inward for ${inwardChallan2.number}`,
    });
    console.log(`✅ Created audit for inward challan #2`);

    // Create Dispatch Challan #1 (should NOT be deleted)
    const dispatchChallan = await Challan.create({
      number: "VPP-NG/26-27/OUT-001",
      challan_seq: 2001,
      challan_fy: "26-27",
      challan_tax_type: "GST",
      doc_type: "OUTWARD_CHALLAN",
      inventory_mode: "dispatch",
      items: [
        {
          box: {
            _id: testBox._id,
            title: testBox.title,
            code: testBox.code,
            category: testBox.category,
          },
          quantity: 25,
          rate: 100,
          assemblyCharge: 0,
          color: "Red",
        },
      ],
      createdBy: adminUser._id,
      clientDetails: {
        name: "Dispatch Client",
        address: "Test Address 3",
        mobile: "9999999993",
        gstNumber: "GST003",
      },
    });
    console.log(`✅ Created dispatch challan: ${dispatchChallan.number}`);

    // Create audit for dispatch challan
    const auditDispatch = await BoxAudit.create({
      box: testBox._id,
      user: adminUser._id,
      quantity: 25,
      color: "Red",
      action: "dispatch",
      doc_type: "OUTWARD_CHALLAN",
      challan: dispatchChallan._id,
      note: `Dispatch for ${dispatchChallan.number}`,
    });
    console.log(`✅ Created audit for dispatch challan`);

    console.log("\n✅ Test data created successfully\n");

    return {
      inwardChallan1,
      inwardChallan2,
      dispatchChallan,
      adminUser,
      testBox,
    };
  } catch (error) {
    console.error("❌ Error creating test data:", error);
    throw error;
  }
}

async function verifyBefore(testData) {
  console.log("\n========== VERIFY: Before cleanup ==========\n");

  const totalChallans = await Challan.countDocuments();
  const inwardChallans = await Challan.countDocuments({
    $or: [
      { inventory_mode: "inward" },
      { doc_type: "STOCK_INWARD_RECEIPT" }
    ]
  });
  const dispatchChallans = await Challan.countDocuments({
    inventory_mode: "dispatch"
  });
  const totalAudits = await BoxAudit.countDocuments();
  const inwardAudits = await BoxAudit.countDocuments({
    $or: [
      { action: { $in: ["add", "create_stock_receipt"] } },
      { doc_type: "STOCK_INWARD_RECEIPT" }
    ]
  });

  console.log(`📊 Total Challans: ${totalChallans}`);
  console.log(`   - Inward/Addition: ${inwardChallans}`);
  console.log(`   - Dispatch: ${dispatchChallans}`);
  console.log(`📊 Total Audits: ${totalAudits}`);
  console.log(`   - Inward/Addition: ${inwardAudits}`);
  console.log(`\n✅ Expected: 3 challans (2 inward + 1 dispatch), ~3-4 audits\n`);
}

async function testDryRun() {
  console.log("\n========== TEST 1: DRY-RUN mode ==========\n");

  try {
    // Simulate the cleanup endpoint logic
    const additionChallans = await Challan.find({
      $or: [
        { inventory_mode: "inward" },
        { doc_type: "STOCK_INWARD_RECEIPT" }
      ]
    }).select("_id number inventory_mode doc_type createdAt");

    const additionChallanIds = additionChallans.map((c) => c._id);

    const relatedAudits = await BoxAudit.find({
      $or: [
        { challan: { $in: additionChallanIds } },
        { action: { $in: ["add", "create_stock_receipt"] } },
        { doc_type: "STOCK_INWARD_RECEIPT" }
      ]
    }).select("_id action challan createdAt");

    console.log(`📊 DRY-RUN Report:`);
    console.log(`   - Would delete ${additionChallans.length} addition challans`);
    console.log(`   - Would delete ${relatedAudits.length} related audits`);
    console.log(`\n📋 Sample challans to be deleted:`);
    additionChallans.slice(0, 20).forEach((c) => {
      console.log(`   - ${c.number} (ID: ${c._id})`);
    });

    if (additionChallans.length !== 2) {
      throw new Error(`❌ Expected 2 addition challans, but found ${additionChallans.length}`);
    }

    console.log(`\n✅ DRY-RUN test PASSED\n`);
    return true;
  } catch (error) {
    console.error(`❌ DRY-RUN test FAILED:`, error.message);
    throw error;
  }
}

async function testRealDelete() {
  console.log("\n========== TEST 2: REAL DELETE mode ==========\n");

  try {
    // Get addition challans before deletion
    const additionChallans = await Challan.find({
      $or: [
        { inventory_mode: "inward" },
        { doc_type: "STOCK_INWARD_RECEIPT" }
      ]
    });

    const additionChallanIds = additionChallans.map((c) => c._id);

    console.log(`🗑️  Deleting ${additionChallans.length} addition challans...`);

    // Delete addition challans
    const challanDeleteResult = await Challan.deleteMany({
      _id: { $in: additionChallanIds }
    });

    console.log(`✅ Deleted ${challanDeleteResult.deletedCount} challans`);

    // Delete related audits
    const auditDeleteResult = await BoxAudit.deleteMany({
      $or: [
        { challan: { $in: additionChallanIds } },
        { action: { $in: ["add", "create_stock_receipt"] } },
        { doc_type: "STOCK_INWARD_RECEIPT" }
      ]
    });

    console.log(`✅ Deleted ${auditDeleteResult.deletedCount} audits`);

    if (challanDeleteResult.deletedCount !== 2) {
      throw new Error(`❌ Expected to delete 2 challans, but deleted ${challanDeleteResult.deletedCount}`);
    }

    console.log(`\n✅ REAL DELETE test PASSED\n`);
    return true;
  } catch (error) {
    console.error(`❌ REAL DELETE test FAILED:`, error.message);
    throw error;
  }
}

async function verifyAfter() {
  console.log("\n========== VERIFY: After cleanup ==========\n");

  const totalChallans = await Challan.countDocuments();
  const remainingChallans = await Challan.find({}).select("number inventory_mode");
  const totalAudits = await BoxAudit.countDocuments();
  const remainingAudits = await BoxAudit.find({}).select("action doc_type challan");

  console.log(`📊 Total Challans after cleanup: ${totalChallans}`);
  console.log(`   Remaining challans:`);
  remainingChallans.forEach((c) => {
    console.log(`   - ${c.number} (${c.inventory_mode || "unknown"})`);
  });

  console.log(`\n📊 Total Audits after cleanup: ${totalAudits}`);
  if (remainingAudits.length > 0) {
    console.log(`   Remaining audits:`);
    remainingAudits.forEach((a) => {
      console.log(`   - Action: ${a.action}, Doc Type: ${a.doc_type}`);
    });
  }

  if (totalChallans !== 1) {
    throw new Error(`❌ Expected 1 challan remaining, but found ${totalChallans}`);
  }

  if (remainingChallans[0].inventory_mode !== "dispatch") {
    throw new Error(`❌ Expected remaining challan to be dispatch, but got ${remainingChallans[0].inventory_mode}`);
  }

  console.log(`\n✅ Post-cleanup verification PASSED\n`);
}

async function cleanup() {
  console.log("\n========== CLEANUP: Removing test data ==========\n");

  try {
    const deleteChallans = await Challan.deleteMany({});
    const deleteAudits = await BoxAudit.deleteMany({});
    const deleteBoxes = await Box.deleteMany({ code: "TEST_BOX_001" });

    console.log(`✅ Deleted ${deleteChallans.deletedCount} test challans`);
    console.log(`✅ Deleted ${deleteAudits.deletedCount} test audits`);
    console.log(`✅ Deleted ${deleteBoxes.deletedCount} test boxes`);
    console.log(`\n✅ Test data cleaned up\n`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  }
}

async function runTests() {
  try {
    await connectDB();

    const testData = await createTestData();
    await verifyBefore(testData);

    // Test 1: Dry-run
    await testDryRun();

    // Test 2: Real delete
    await testRealDelete();

    // Verify after
    await verifyAfter();

    // Clean up test data
    await cleanup();

    console.log("========== ✅ ALL TESTS PASSED ==========\n");
  } catch (error) {
    console.error("========== ❌ TEST SUITE FAILED ==========\n", error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

runTests();
