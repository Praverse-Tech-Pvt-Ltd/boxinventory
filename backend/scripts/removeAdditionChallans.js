/**
 * Migration script to remove all "addition" mode challans (Stock Inward/Add to Inventory)
 * 
 * This script safely deletes challans where inventory_mode = "inward" which represent
 * stock additions. It does NOT affect the actual inventory (stock remains intact).
 * Only challan records are deleted.
 * 
 * Usage:
 *   node backend/scripts/removeAdditionChallans.js
 * 
 * Safety features:
 *   - Requires manual confirmation (CONFIRM=YES env var)
 *   - Shows what will be deleted before execution
 *   - Logs deletion details for audit trail
 *   - Non-blocking (won't crash on errors)
 */

import mongoose from 'mongoose';
import Challan from '../models/challanModel.js';
import BoxAudit from '../models/boxAuditModel.js';
import dotenv from 'dotenv';

dotenv.config();

const main = async () => {
  try {
    // Connect to MongoDB
    console.log('[removeAdditionChallans] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/boxinventory');
    console.log('[removeAdditionChallans] ✅ Connected to MongoDB');

    // Find all "inward" mode challans
    console.log('[removeAdditionChallans] Searching for Stock Inward (addition) challans...');
    const additionChallans = await Challan.find({ 
      inventory_mode: 'inward' 
    }).select('_id number inventory_mode challan_tax_type createdAt').lean();

    if (additionChallans.length === 0) {
      console.log('[removeAdditionChallans] ✅ No addition mode challans found. Nothing to delete.');
      process.exit(0);
    }

    console.log(`[removeAdditionChallans] Found ${additionChallans.length} addition mode challans:`);
    additionChallans.forEach(c => {
      console.log(`  - ${c.number} (${c.challan_tax_type}, created: ${c.createdAt})`);
    });

    // Require manual confirmation
    if (process.env.CONFIRM !== 'YES') {
      console.log('\n[removeAdditionChallans] ⚠️  DRY RUN MODE');
      console.log('[removeAdditionChallans] To actually delete these challans, run with CONFIRM=YES:');
      console.log('   CONFIRM=YES node backend/scripts/removeAdditionChallans.js\n');
      process.exit(0);
    }

    console.log('\n[removeAdditionChallans] 🔄 Proceeding with deletion (CONFIRM=YES)...\n');

    // Delete the challans
    const challanIds = additionChallans.map(c => c._id);
    const deleteResult = await Challan.deleteMany({ 
      _id: { $in: challanIds }
    });

    console.log(`[removeAdditionChallans] ✅ Deleted ${deleteResult.deletedCount} addition mode challans`);

    // Also delete related audits (if any reference these challans)
    // This is non-blocking - continue even if audit deletion fails
    try {
      const auditDeleteResult = await BoxAudit.deleteMany({ 
        challan: { $in: challanIds }
      });
      console.log(`[removeAdditionChallans] ✅ Deleted ${auditDeleteResult.deletedCount} related audit entries`);
    } catch (auditError) {
      console.warn('[removeAdditionChallans] ⚠️  Could not delete related audits:', auditError.message);
      // Continue anyway - main task is complete
    }

    console.log('\n[removeAdditionChallans] ✅ Migration complete!');
    console.log('[removeAdditionChallans] - All Stock Inward (addition) challans have been removed');
    console.log('[removeAdditionChallans] - Inventory stock records remain intact');
    console.log('[removeAdditionChallans] - System will no longer show these challans in any listings\n');

    process.exit(0);
  } catch (error) {
    console.error('[removeAdditionChallans] ❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

main();
