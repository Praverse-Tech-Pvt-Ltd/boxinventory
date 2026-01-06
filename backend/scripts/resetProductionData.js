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
dotenv.config();

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
    console.error('\n❌ SAFETY CHECK FAILED');
    console.error('Refusing to reset data. Set environment variable: RESET_CONFIRM=YES');
    console.error('\nUsage: RESET_CONFIRM=YES npm run reset:data\n');
    process.exit(1);
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('  🔄 PRODUCTION DATA RESET - COMMERCIAL FRESH START');
  console.log('='.repeat(60) + '\n');

  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Database connected\n');

    // Get initial counts
    console.log('📊 Initial Database State:');
    const initialState = await getCollectionCounts();
    printCollectionCounts('Initial', initialState);

    // Step 1: Delete all data from non-user collections
    console.log('\n🗑️  Deleting test data...');
    const deletions = await deleteTestData();

    // Step 2: Delete non-admin users
    console.log('\n👥 Managing user accounts...');
    const adminResult = await manageAdminAccounts();
    deletions.nonAdminUsers = adminResult.nonAdminUsers;

    // Step 3: Reset counters
    console.log('\n🔢 Resetting challan counters...');
    await resetCounters();

    // Step 4: Get final state
    const finalState = await getCollectionCounts();

    // Print final report
    console.log('\n\n' + '='.repeat(60));
    console.log('  ✅ RESET COMPLETION REPORT');
    console.log('='.repeat(60) + '\n');
    
    printCollectionCounts('Final', finalState);

    // Print admin accounts
    console.log('\n👤 Remaining Admin Accounts:');
    const admins = await User.find({ role: 'admin' }).sort({ email: 1 });
    if (admins.length > 0) {
      admins.forEach((admin, index) => {
        console.log(`  ${index + 1}. ${admin.email} (ID: ${admin._id})`);
      });
    } else {
      console.log('  ⚠️  No admin accounts found!');
    }

    // Print summary
    console.log('\n📋 Summary:');
    console.log(`  ✓ Deleted ${deletions.boxes} boxes`);
    console.log(`  ✓ Deleted ${deletions.audits} audit logs`);
    console.log(`  ✓ Deleted ${deletions.challans} challans`);
    console.log(`  ✓ Deleted ${deletions.receipts} stock receipts`);
    console.log(`  ✓ Deleted ${deletions.batches} client batches`);
    console.log(`  ✓ Deleted ${deletions.nonAdminUsers} non-admin users`);
    console.log(`  ✓ Preserved 2 admin accounts`);

    console.log('\n✨ SYSTEM READY FOR COMMERCIAL USE');
    console.log('  - Challan numbering starts from 0001');
    console.log('  - Inventory is empty');
    console.log('  - Only 2 admins can login');
    console.log('  - All test data removed\n');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR DURING RESET:');
    console.error(error.message);
    console.error(error.stack);
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
    console.log(`  • Boxes: ${boxResult.deletedCount} deleted`);

    // Delete BoxAudits
    const auditResult = await BoxAudit.deleteMany({});
    deletions.audits = auditResult.deletedCount;
    console.log(`  • Audit logs: ${auditResult.deletedCount} deleted`);

    // Delete Challans (both GST and NON-GST)
    const challanResult = await Challan.deleteMany({});
    deletions.challans = challanResult.deletedCount;
    console.log(`  • Challans: ${challanResult.deletedCount} deleted`);

    // Delete StockReceipts
    const receiptResult = await StockReceipt.deleteMany({});
    deletions.receipts = receiptResult.deletedCount;
    console.log(`  • Stock receipts: ${receiptResult.deletedCount} deleted`);

    // Delete ClientBatches
    const batchResult = await ClientBatch.deleteMany({});
    deletions.batches = batchResult.deletedCount;
    console.log(`  • Client batches: ${batchResult.deletedCount} deleted`);

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
    console.log(`  • Non-admin users deleted: ${deleteResult.deletedCount}`);

    let newAdminsCreated = 0;

    // Ensure admin accounts exist
    for (const adminConfig of ADMIN_ACCOUNTS) {
      const existingAdmin = await User.findOne({ email: adminConfig.email });

      if (existingAdmin) {
        // Ensure admin still has correct role
        if (existingAdmin.role !== 'admin') {
          existingAdmin.role = 'admin';
          await existingAdmin.save();
          console.log(`  • Updated ${adminConfig.email} to admin role`);
        } else {
          console.log(`  • Admin already exists: ${adminConfig.email}`);
        }
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
        newAdminsCreated++;
        console.log(`  • Created new admin: ${adminConfig.email}`);
        console.log(`    Default password: ${adminConfig.defaultPassword} (⚠️  change on first login)`);
      }
    }

    return { nonAdminUsers: deleteResult.deletedCount, newAdminsCreated };
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
    // Get current financial year (India FY: Apr to Mar)
    const now = new Date();
    let currentYear = now.getFullYear();
    
    // If before April, use previous year as fiscal year start
    if (now.getMonth() < 3) {
      currentYear = currentYear - 1;
    }
    
    const nextYear = currentYear + 1;
    const currentFY = `${String(currentYear).slice(-2)}-${String(nextYear).slice(-2)}`;

    console.log(`  • Current Financial Year: ${currentFY}`);

    // Reset ChallanCounter for current FY (GST)
    const gstCounter = await ChallanCounter.findOneAndUpdate(
      { fy: currentFY },
      {
        fy: currentFY,
        gst_next_seq: 1,
        nongst_next_seq: 1,
      },
      { upsert: true, new: true }
    );
    console.log(`  • GST challan counter reset to 1`);
    console.log(`  • Non-GST challan counter reset to 1`);

    // Clear any other year's counters
    const deletedCounters = await ChallanCounter.deleteMany({
      fy: { $ne: currentFY }
    });
    if (deletedCounters.deletedCount > 0) {
      console.log(`  • Cleared ${deletedCounters.deletedCount} old year counters`);
    }

    // Clear generic Counter collection (if any)
    const deletedGeneric = await Counter.deleteMany({});
    if (deletedGeneric.deletedCount > 0) {
      console.log(`  • Cleared ${deletedGeneric.deletedCount} generic counters`);
    }

    return gstCounter;
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
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userCount = await User.countDocuments();

    return {
      totalUsers: userCount,
      adminUsers: adminCount,
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
  console.log('  ┌─────────────────────────┬───────┐');
  console.log('  │ Collection              │ Count │');
  console.log('  ├─────────────────────────┼───────┤');
  console.log(`  │ Total Users             │ ${String(counts.totalUsers).padStart(5)} │`);
  console.log(`  │ Admin Users             │ ${String(counts.adminUsers).padStart(5)} │`);
  console.log(`  │ Boxes                   │ ${String(counts.boxes).padStart(5)} │`);
  console.log(`  │ Audit Logs              │ ${String(counts.audits).padStart(5)} │`);
  console.log(`  │ Challans                │ ${String(counts.challans).padStart(5)} │`);
  console.log(`  │ Stock Receipts          │ ${String(counts.receipts).padStart(5)} │`);
  console.log(`  │ Client Batches          │ ${String(counts.batches).padStart(5)} │`);
  console.log('  └─────────────────────────┴───────┘');
}

// Run the reset
resetProductionData();
