#!/usr/bin/env node

/**
 * Reset system to production state
 * Deletes all test data and keeps only 2 admin users
 * Usage: node scripts/resetToProduction.js
 */

import mongoose from "mongoose";
import User from "../models/User.js";
import Box from "../models/boxModel.js";
import BoxAudit from "../models/boxAuditModel.js";
import Challan from "../models/challanModel.js";
import Counter from "../models/counterModel.js";
import ClientBatch from "../models/clientBatchModel.js";
import dotenv from "dotenv";

dotenv.config();

const adminEmails = ["test@gmail.com", "savlavaibhav99@gmail.com"];

async function resetToProduction() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/box-inventory");
    console.log("✅ Connected to MongoDB");

    console.log("\n⚠️  WARNING: This will delete all test data!");
    console.log("Proceeding with production reset...\n");

    // Step 1: Clear all transactional data
    console.log("[1/4] Clearing transactional data...");
    const challanResult = await Challan.deleteMany({});
    const auditResult = await BoxAudit.deleteMany({});
    const boxResult = await Box.deleteMany({});
    const batchResult = await ClientBatch.deleteMany({});
    console.log(`  ✓ Deleted ${challanResult.deletedCount} challans`);
    console.log(`  ✓ Deleted ${auditResult.deletedCount} audits`);
    console.log(`  ✓ Deleted ${boxResult.deletedCount} boxes`);
    console.log(`  ✓ Deleted ${batchResult.deletedCount} batches`);

    // Step 2: Reset counters to initial values
    console.log("\n[2/4] Resetting counters...");
    await Counter.findOneAndUpdate(
      { name: "gst_challan_counter" },
      { value: 1 },
      { upsert: true, new: true }
    );
    await Counter.findOneAndUpdate(
      { name: "nongst_challan_counter" },
      { value: 2 },
      { upsert: true, new: true }
    );
    await Counter.findOneAndUpdate(
      { name: "stock_receipt_counter" },
      { value: 1 },
      { upsert: true, new: true }
    );
    console.log("  ✓ GST challan counter reset to 1");
    console.log("  ✓ Non-GST challan counter reset to 2");
    console.log("  ✓ Stock receipt counter reset to 1");

    // Step 3: Delete all users except the two admins
    console.log("\n[3/4] Cleaning up users...");
    const usersToDelete = await User.find({ email: { $nin: adminEmails } });
    const deleteUserResult = await User.deleteMany({ email: { $nin: adminEmails } });
    console.log(`  ✓ Deleted ${deleteUserResult.deletedCount} non-admin users`);

    // Step 4: Ensure the two admin users have admin role
    console.log("\n[4/4] Ensuring admin users have correct role...");
    const adminUsers = await User.updateMany(
      { email: { $in: adminEmails } },
      { $set: { role: "admin" } }
    );
    console.log(`  ✓ Updated ${adminUsers.modifiedCount} admin users`);

    // Verify final state
    console.log("\n📊 Verifying production state...");
    const totalUsers = await User.countDocuments();
    const adminUserDocs = await User.find({ email: { $in: adminEmails } });
    const totalChallans = await Challan.countDocuments();
    const totalBoxes = await Box.countDocuments();
    
    console.log(`  ✓ Total users: ${totalUsers}`);
    console.log(`  ✓ Admin users: ${adminUserDocs.map(u => u.email).join(", ")}`);
    console.log(`  ✓ Total challans: ${totalChallans}`);
    console.log(`  ✓ Total boxes: ${totalBoxes}`);

    console.log("\n✨ System successfully reset to production state!");
    console.log("\nReady for commercialization. Next steps:");
    console.log("  1. Login with test@gmail.com or savlavaibhav99@gmail.com");
    console.log("  2. Create new products and generate GST/Non-GST challans");
    console.log("  3. GST challans start from: GST-000001");
    console.log("  4. Non-GST challans start from: NGST-000002");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during reset:", error.message);
    process.exit(1);
  }
}

resetToProduction();
