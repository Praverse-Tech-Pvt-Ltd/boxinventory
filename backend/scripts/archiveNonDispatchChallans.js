/**
 * Migration Script: Archive non-dispatch challans
 * 
 * Purpose: Clean up ADD/inward/record_only challans from production
 * These should not appear in sales/summary reports
 * 
 * Usage:
 *   node scripts/archiveNonDispatchChallans.js          # Dry-run mode (shows count)
 *   CONFIRM=YES node scripts/archiveNonDispatchChallans.js  # Actually archive
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Challan from '../models/challanModel.js';

dotenv.config();

const confirmMode = process.env.CONFIRM === 'YES';

async function archiveNonDispatchChallans() {
  try {
    // Connect to MongoDB
    console.log('[Archive] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('[Archive] ✅ Connected to MongoDB');

    // Find non-dispatch challans
    console.log('[Archive] Searching for non-dispatch challans (inward/record_only/ADD)...');
    const nonDispatchChallans = await Challan.find({
      inventory_mode: { $ne: 'dispatch' }
    }).select('_id number inventory_mode chalk_tax_type createdAt');

    console.log(`[Archive] Found ${nonDispatchChallans.length} non-dispatch challans to archive`);

    if (nonDispatchChallans.length === 0) {
      console.log('[Archive] ✅ No non-dispatch challans found. Database is clean.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Show summary before archiving
    console.log('\n[Archive] Summary of challans to be archived:');
    const groupedByMode = {};
    nonDispatchChallans.forEach((c) => {
      if (!groupedByMode[c.inventory_mode]) {
        groupedByMode[c.inventory_mode] = [];
      }
      groupedByMode[c.inventory_mode].push(c);
    });

    for (const [mode, challans] of Object.entries(groupedByMode)) {
      console.log(`  - ${mode}: ${challans.length} challan(s)`);
      if (challans.length <= 5) {
        challans.forEach((c) => {
          console.log(`    • ${c.number} (created: ${new Date(c.createdAt).toLocaleDateString()})`);
        });
      } else {
        console.log(`    (showing first 5 of ${challans.length})`);
        challans.slice(0, 5).forEach((c) => {
          console.log(`    • ${c.number}`);
        });
      }
    }

    if (!confirmMode) {
      console.log('\n[Archive] 🔍 DRY-RUN MODE: No changes made.');
      console.log('[Archive] To actually archive these challans, run:');
      console.log('[Archive]   CONFIRM=YES node scripts/archiveNonDispatchChallans.js');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Archive
    console.log('\n[Archive] 🚀 ARCHIVING in progress...');
    const result = await Challan.updateMany(
      { inventory_mode: { $ne: 'dispatch' } },
      {
        $set: {
          archived: true,
          archivedAt: new Date(),
        }
      }
    );

    console.log(`[Archive] ✅ Archived ${result.modifiedCount} challan(s)`);
    console.log('[Archive] Archived challans will no longer appear in:');
    console.log('  - All Challans list');
    console.log('  - Recent Challans');
    console.log('  - Client-wise Summary');
    console.log('  - Total Sales calculations');

    await mongoose.disconnect();
    console.log('[Archive] ✅ Completed. MongoDB disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('[Archive] ❌ ERROR:', error.message);
    console.error('[Archive] Stack:', error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

archiveNonDispatchChallans();
