import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';
import connectDB from '../config/db.js';

// Import models
import User from '../models/User.js';
import Box from '../models/boxModel.js';
import BoxAudit from '../models/boxAuditModel.js';
import Challan from '../models/challanModel.js';
import ChallanCounter from '../models/challanCounterModel.js';
import Counter from '../models/counterModel.js';
import StockReceipt from '../models/stockReceiptModel.js';
import ClientBatch from '../models/clientBatchModel.js';

// Load environment variables
dotenv.config({ path: '../.env' });

// Admin accounts to preserve
const ADMIN_ACCOUNTS = [
  {
    email: 'test@gmail.com',
    defaultPassword: 'Admin@1234',
    name: 'Test Admin',
  },
  {
    email: 'savlavaibhav99@gmail.com',
    defaultPassword: 'Admin@1234',
    name: 'Vaibhav Admin',
  },
];

/**
 * Main reset function
 */
async function resetProductionData() {
  // Safety check
  if (process.env.RESET_CONFIRM !== 'YES') {
    console.error('❌ SAFETY CHECK FAILED');
    console.error('Refusing to reset data. Set environment variable: RESET_CONFIRM=YES');
    process.exit(1);
  }

  console.log('\n🔄 Starting Production Data Reset...');
  console.log('========================================\n');

  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Database connected\n');

    // Get initial counts
    console.log('📊 Initial Database State:');
    const initialState = await getCollectionCounts();
    printCollectionCounts('Initial', initialState);

    // Step 1: Delete all data from non-user collections
    console.log('\n🗑️  Deleting test data...');
    await deleteTestData();

    // Step 2: Delete non-admin users
    console.log('\n👥 Managing user accounts...');
    await manageAdminAccounts();

    // Step 3: Reset counters
    console.log('\n🔢 Resetting counters and sequences...');
    await resetCounters();

    // Step 4: Get final state
    const finalState = await getCollectionCounts();

    // Print final report
    console.log('\n\n📋 RESET COMPLETION REPORT');
    console.log('========================================');
    printCollectionCounts('Final', finalState);

    // Print admin accounts
    console.log('\n👤 Remaining Admin Accounts:');
    const admins = await User.find({ role: 'admin' });
    admins.forEach((admin, index) => {
      console.log(`  ${index + 1}. ${admin.email} (ID: ${admin._id})`);
    });

    console.log('\n✅ RESET COMPLETED SUCCESSFULLY!');
    console.log('\n📝 Notes:');
    console.log('  - New challan numbering starts from 0001');
    console.log('  - All test data has been removed');
    console.log('  - Only 2 admin accounts remain');
    console.log('  - System is ready for fresh data entry\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR DURING RESET:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Delete all test data from collections
 */
async function deleteTestData() {
  const deletions = {};

  try {
    // Delete Boxes
    const boxResult = await Box.deleteMany({});
    deletions.boxes = boxResult.deletedCount;
    console.log(`  • Deleted ${boxResult.deletedCount} boxes`);

    // Delete BoxAudits
    const auditResult = await BoxAudit.deleteMany({});
    deletions.audits = auditResult.deletedCount;
    console.log(`  • Deleted ${auditResult.deletedCount} audit logs`);

    // Delete Challans
    const challanResult = await Challan.deleteMany({});
    deletions.challans = challanResult.deletedCount;
    console.log(`  • Deleted ${challanResult.deletedCount} challans`);

    // Delete StockReceipts
    const receiptResult = await StockReceipt.deleteMany({});
    deletions.receipts = receiptResult.deletedCount;
    console.log(`  • Deleted ${receiptResult.deletedCount} stock receipts`);

    // Delete ClientBatches
    const batchResult = await ClientBatch.deleteMany({});
    deletions.batches = batchResult.deletedCount;
    console.log(`  • Deleted ${batchResult.deletedCount} client batches`);

    return deletions;
  } catch (error) {
    console.error('❌ Error deleting test data:', error.message);
    throw error;
  }
}

/**
 * Manage admin accounts - delete non-admin users, ensure admin accounts exist
 */
async function manageAdminAccounts() {
  try {
    // Delete all non-admin users
    const deleteResult = await User.deleteMany({ role: { $ne: 'admin' } });
    console.log(`  • Deleted ${deleteResult.deletedCount} non-admin users`);

    // Ensure admin accounts exist
    for (const adminConfig of ADMIN_ACCOUNTS) {
      const existingAdmin = await User.findOne({ email: adminConfig.email });

      if (existingAdmin) {
        console.log(`  • Admin account exists: ${adminConfig.email}`);
      } else {
        // Create new admin account
        const hashedPassword = await bcryptjs.hash(adminConfig.defaultPassword, 10);
        const newAdmin = new User({
          name: adminConfig.name,
          email: adminConfig.email,
          password: hashedPassword,
          role: 'admin',
        });

        await newAdmin.save();
        console.log(`  • Created new admin: ${adminConfig.email}`);
        console.log(`    📝 Default password: ${adminConfig.defaultPassword} (please change on first login)`);
      }
    }
  } catch (error) {
    console.error('❌ Error managing admin accounts:', error.message);
    throw error;
  }
}

/**
 * Reset all counters and sequences
 */
async function resetCounters() {
  try {
    // Get current financial year
    const now = new Date();
    const currentYear = now.getFullYear();
    const nextYear = currentYear + 1;

    // Get last 2 digits of year
    const currentFY = `${String(currentYear).slice(-2)}-${String(nextYear).slice(-2)}`;

    // Reset ChallanCounter for current FY
    const counterResult = await ChallanCounter.findOneAndUpdate(
      { fy: currentFY },
      {
        fy: currentFY,
        gst_next_seq: 1,
        nongst_next_seq: 1,
      },
      { upsert: true, new: true }
    );
    console.log(`  • Reset challan counter for FY ${currentFY}`);
    console.log(`    - GST sequence: 1`);
    console.log(`    - Non-GST sequence: 1`);

    // Reset generic Counter (if used)
    await Counter.deleteMany({});
    console.log(`  • Cleared generic counters`);

    return counterResult;
  } catch (error) {
    console.error('❌ Error resetting counters:', error.message);
    throw error;
  }
}

/**
 * Get collection counts
 */
async function getCollectionCounts() {
  try {
    return {
      users: await User.countDocuments(),
      boxes: await Box.countDocuments(),
      audits: await BoxAudit.countDocuments(),
      challans: await Challan.countDocuments(),
      receipts: await StockReceipt.countDocuments(),
      batches: await ClientBatch.countDocuments(),
    };
  } catch (error) {
    console.error('❌ Error getting collection counts:', error.message);
    throw error;
  }
}

/**
 * Print collection counts in formatted table
 */
function printCollectionCounts(label, counts) {
  console.log(`\n${label} State:`);
  console.log('  ┌─────────────────────┬──────┐');
  console.log(`  │ Collection          │ Count│`);
  console.log('  ├─────────────────────┼──────┤');
  console.log(`  │ Users               │ ${String(counts.users).padStart(4)}  │`);
  console.log(`  │ Boxes               │ ${String(counts.boxes).padStart(4)}  │`);
  console.log(`  │ Audit Logs          │ ${String(counts.audits).padStart(4)}  │`);
  console.log(`  │ Challans            │ ${String(counts.challans).padStart(4)}  │`);
  console.log(`  │ Stock Receipts      │ ${String(counts.receipts).padStart(4)}  │`);
  console.log(`  │ Client Batches      │ ${String(counts.batches).padStart(4)}  │`);
  console.log('  └─────────────────────┴──────┘');
}

// Run the reset
resetProductionData();
