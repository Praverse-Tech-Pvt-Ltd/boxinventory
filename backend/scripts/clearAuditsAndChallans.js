import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Challan from '../models/challanModel.js';
import ChallanCounter from '../models/challanCounterModel.js';
import BoxAudit from '../models/boxAuditModel.js';

dotenv.config();

const clearAuditsAndChallans = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Count existing data
    const challanCount = await Challan.countDocuments();
    const counterCount = await ChallanCounter.countDocuments();
    const auditCount = await BoxAudit.countDocuments();

    console.log('\n📊 Current State:');
    console.log(`   - Challans: ${challanCount}`);
    console.log(`   - Challan Counters: ${counterCount}`);
    console.log(`   - Box Audits: ${auditCount}`);

    console.log('\n🗑️  Starting complete cleanup...');

    // Delete all challans
    const deletedChallans = await Challan.deleteMany({});
    console.log(`✅ Deleted ${deletedChallans.deletedCount} challans`);

    // Reset all challan counters
    const deletedCounters = await ChallanCounter.deleteMany({});
    console.log(`✅ Deleted ${deletedCounters.deletedCount} challan counters`);

    // Delete all audit entries (dispatch/subtract records)
    const deletedAudits = await BoxAudit.deleteMany({});
    console.log(`✅ Deleted ${deletedAudits.deletedCount} audit entries`);

    console.log('\n✅ Complete cleanup done!');
    console.log('📦 Box inventory remains intact.');
    console.log('🔄 Audit history cleared - ready for fresh dispatch records.');
    console.log('🔄 Challan numbering will restart from 0001.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
};

clearAuditsAndChallans();
