/**
 * Script to remove all test data from the database
 * 
 * Removes:
 * - Test users (test@gmail.com)
 * - Test boxes (TEST_BOX_001)
 * - Test challans
 * - Test audit records
 * - Test stock receipts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Box from '../models/boxModel.js';
import Challan from '../models/challanModel.js';
import BoxAudit from '../models/boxAuditModel.js';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/box-inventory';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

async function cleanupTestData() {
  try {
    console.log('\n========== CLEANUP: Removing test data ==========\n');

    // 1. Find test user
    console.log('🔍 Finding test users...');
    const testUser = await User.findOne({ email: 'test@gmail.com' });
    
    if (!testUser) {
      console.log('   ℹ️  No test user found');
    } else {
      console.log(`   ✓ Found test user: ${testUser.email}`);
    }

    // 2. Find test box
    console.log('\n🔍 Finding test boxes...');
    const testBox = await Box.findOne({ code: 'TEST_BOX_001' });
    
    if (!testBox) {
      console.log('   ℹ️  No test box found');
    } else {
      console.log(`   ✓ Found test box: ${testBox.code} (${testBox.title})`);
    }

    // 3. Find test challans
    console.log('\n🔍 Finding test challans...');
    let testChallanIds = [];
    
    if (testUser) {
      const testChallans = await Challan.find().lean();
      const challansByTestUser = testChallans.filter(c => 
        c.createdBy === testUser._id.toString() || 
        c.challanNumber?.includes('TEST')
      );
      testChallanIds = challansByTestUser.map(c => c._id);
      
      if (testChallanIds.length > 0) {
        console.log(`   ✓ Found ${testChallanIds.length} test challan(s)`);
      } else {
        console.log('   ℹ️  No test challans found');
      }
    }

    // 4. Find test audit records
    console.log('\n🔍 Finding test audit records...');
    let deleteAuditQuery = {};
    
    if (testUser) {
      deleteAuditQuery.user = testUser._id;
    }
    if (testBox) {
      deleteAuditQuery.box = testBox._id;
    }
    
    const testAudits = await BoxAudit.find(deleteAuditQuery).lean();
    const auditCount = testAudits.length;
    
    if (auditCount > 0) {
      console.log(`   ✓ Found ${auditCount} test audit record(s)`);
    } else {
      console.log('   ℹ️  No test audit records found');
    }

    // Summary
    console.log('\n========== SUMMARY ==========\n');
    console.log(`📊 Items to remove:`);
    console.log(`   - Users: ${testUser ? 1 : 0}`);
    console.log(`   - Boxes: ${testBox ? 1 : 0}`);
    console.log(`   - Challans: ${testChallanIds.length}`);
    console.log(`   - Audit Records: ${auditCount}`);

    const totalItems = (testUser ? 1 : 0) + (testBox ? 1 : 0) + testChallanIds.length + auditCount;

    if (totalItems === 0) {
      console.log('\n✅ No test data found. Database is clean!');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Confirm before deletion
    console.log(`\n⚠️  This will permanently delete ${totalItems} item(s)`);
    console.log('Proceed with deletion? (This will actually delete the data)');
    console.log('Run with --force flag to confirm deletion');

    // Check for --force flag
    const isForce = process.argv.includes('--force');

    if (!isForce) {
      console.log('\n❌ Deletion cancelled. Run again with --force to confirm deletion.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Execute deletions
    console.log('\n========== DELETING DATA ==========\n');

    // Delete audit records first (references)
    if (auditCount > 0) {
      const auditResult = await BoxAudit.deleteMany(deleteAuditQuery);
      console.log(`✅ Deleted ${auditResult.deletedCount} audit record(s)`);
    }

    // Delete challans (references)
    if (testChallanIds.length > 0) {
      const challanResult = await Challan.deleteMany({ _id: { $in: testChallanIds } });
      console.log(`✅ Deleted ${challanResult.deletedCount} challan(s)`);
    }

    // Delete test box
    if (testBox) {
      const boxResult = await Box.deleteMany({ code: 'TEST_BOX_001' });
      console.log(`✅ Deleted ${boxResult.deletedCount} box(es)`);
    }

    // Delete test user
    if (testUser) {
      const userResult = await User.deleteMany({ email: 'test@gmail.com' });
      console.log(`✅ Deleted ${userResult.deletedCount} user(s)`);
    }

    console.log(`\n✅ Successfully removed all ${totalItems} test data item(s)!`);
    console.log('\nDatabase is now clean of test data.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the cleanup
connectDB().then(() => cleanupTestData());
