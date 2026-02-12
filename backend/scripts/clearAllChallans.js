import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Challan from '../models/challanModel.js';
import ChallanCounter from '../models/challanCounterModel.js';
import BoxAudit from '../models/boxAuditModel.js';

dotenv.config();

const clearAllChallans = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Count existing data
    const challanCount = await Challan.countDocuments();
    const counterCount = await ChallanCounter.countDocuments();
    const usedAuditsCount = await BoxAudit.countDocuments({ used: true });

    console.log('\n📊 Current State:');
    console.log(`   - Challans: ${challanCount}`);
    console.log(`   - Challan Counters: ${counterCount}`);
    console.log(`   - Used Audits: ${usedAuditsCount}`);

    if (challanCount === 0 && counterCount === 0) {
      console.log('\n✨ No challans to delete. Database is already clean.');
      process.exit(0);
    }

    console.log('\n🗑️  Starting cleanup...');

    // Delete all challans
    const deletedChallans = await Challan.deleteMany({});
    console.log(`✅ Deleted ${deletedChallans.deletedCount} challans`);

    // Reset all challan counters
    const deletedCounters = await ChallanCounter.deleteMany({});
    console.log(`✅ Deleted ${deletedCounters.deletedCount} challan counters`);

    // Reset all audits to unused (so they can be used again for new challans)
    const resetAudits = await BoxAudit.updateMany(
      { used: true },
      { $set: { used: false } }
    );
    console.log(`✅ Reset ${resetAudits.modifiedCount} audits to unused`);

    console.log('\n✅ Cleanup complete! All challans removed.');
    console.log('📦 Box inventory remains intact.');
    console.log('🔄 You can now create fresh challans.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
};

clearAllChallans();
