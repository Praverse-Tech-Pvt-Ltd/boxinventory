import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'test@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'; // Change as needed

(async () => {
  try {
    console.log('🔄 Testing Challan Reset Maintenance Operation...\n');

    // Step 1: Login as admin
    console.log('📝 Step 1: Logging in as admin...');
    const loginRes = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
      { withCredentials: true }
    );

    const token = loginRes.data.token;
    console.log(`✅ Login successful. Token: ${token.substring(0, 20)}...`);

    // Step 2: Get current challans count
    console.log('\n📊 Step 2: Getting current challans count...');
    const challengesRes = await axios.get(
      `${API_BASE_URL}/api/challans`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );

    const currentCount = Array.isArray(challengesRes.data) ? challengesRes.data.length : 0;
    console.log(`✅ Current challans: ${currentCount}`);
    
    if (currentCount > 0) {
      console.log('Sample challans:');
      challengesRes.data.slice(0, 3).forEach(c => {
        console.log(`   - ${c.number} (${c.status})`);
      });
    }

    // Step 3: Call reset endpoint
    console.log('\n🗑️  Step 3: Calling reset endpoint...');
    const resetRes = await axios.post(
      `${API_BASE_URL}/api/admin/maintenance/reset-challans`,
      {
        confirm: 'DELETE_ALL_CHALLANS_AND_RESET_001',
        backup: true,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );

    console.log(`✅ Reset successful!`);
    console.log(`   Deleted challans: ${resetRes.data.deleted_challans}`);
    console.log(`   Reset counters: ${resetRes.data.reset.join(', ')}`);
    console.log(`   Backup path: ${resetRes.data.backup_path || 'N/A'}`);

    // Step 4: Verify deletion
    console.log('\n✔️  Step 4: Verifying deletion...');
    const verifyRes = await axios.get(
      `${API_BASE_URL}/api/challans`,
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );

    const finalCount = Array.isArray(verifyRes.data) ? verifyRes.data.length : 0;
    console.log(`✅ Final challans count: ${finalCount}`);

    if (finalCount === 0) {
      console.log('\n🎉 SUCCESS! All challans have been deleted and counters reset to 001.');
      console.log('Next created challan will start from VPP/25-26/001 (GST) or VPP-NG/25-26/001 (Non-GST)');
    } else {
      console.log('\n⚠️  WARNING: Challans still exist after reset!');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
})();
