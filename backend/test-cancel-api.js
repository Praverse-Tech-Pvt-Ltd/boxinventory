import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import jwt from 'jsonwebtoken';

dotenv.config();

async function testCancelAPI() {
  let mongoConn;
  try {
    // Connect to MongoDB to get an admin user
    mongoConn = await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB for getting admin user\n');

    // Find an admin user
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('✗ No admin user found');
      return;
    }
    console.log('✓ Found admin user:', adminUser.email, '\n');

    // Create a JWT token for this user
    const token = jwt.sign(
      { userId: adminUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('✓ Created JWT token\n');
    console.log('Token (use in Cookie header):', token, '\n');

    // Test instructions
    console.log('=== Testing Cancel Endpoint ===\n');
    console.log('Endpoint: POST /api/challans/{id}/cancel');
    console.log('Method: POST');
    console.log('Headers: {"Content-Type": "application/json", "Cookie": "token=' + token.substring(0, 50) + '..."}');
    console.log('Body: {"reason": "Test cancellation"}\n');

    console.log('To manually test:');
    console.log('1. Navigate to http://localhost:5173');
    console.log('2. Create or find a challan (copy its ID)');
    console.log('3. Open browser DevTools Console');
    console.log('4. Run:\n');
    console.log('fetch("http://localhost:5000/api/challans/{CHALLAN_ID}/cancel", {');
    console.log('  method: "POST",');
    console.log('  headers: {"Content-Type": "application/json"},');
    console.log('  credentials: "include",');
    console.log('  body: JSON.stringify({reason: "Test cancellation"})');
    console.log('}).then(r => r.json()).then(d => console.log("Response:", d));');
    console.log('\nWatch the backend terminal for [cancelChallan] logs.\n');

  } catch (error) {
    console.error('✗ Test error:', error.message);
  } finally {
    if (mongoConn) {
      await mongoose.disconnect();
      console.log('✓ Disconnected from MongoDB');
    }
  }
}

testCancelAPI();
