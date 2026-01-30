/**
 * Script to create a test admin user for development/testing
 * 
 * Test Credentials:
 * Email: test@gmail.com
 * Password: 1234
 * Role: Admin
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

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

async function createTestUser() {
  try {
    console.log('\n========== CREATE TEST ADMIN USER ==========\n');

    const email = 'test@gmail.com';
    const password = '1234';
    const name = 'Test Admin';

    // Check if user already exists
    console.log(`🔍 Checking if user ${email} already exists...`);
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(`\n⚠️  User ${email} already exists!`);
      console.log(`\n📋 Existing User Details:`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Status: Active`);
      
      if (existingUser.role === 'admin') {
        console.log(`\n✅ User is already an admin. Ready to use!`);
      } else {
        console.log(`\n⚠️  User exists but is not an admin. Updating role...`);
        existingUser.role = 'admin';
        await existingUser.save();
        console.log(`✅ User role updated to admin`);
      }
      
      await mongoose.connection.close();
      process.exit(0);
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    console.log('\n👤 Creating test user...');
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
    });

    console.log('\n✅ Test admin user created successfully!\n');
    console.log('========== TEST CREDENTIALS ==========\n');
    console.log(`📧 Email: ${newUser.email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Name: ${newUser.name}`);
    console.log(`🎯 Role: ${newUser.role.toUpperCase()}`);
    console.log(`\n========== LOGIN INSTRUCTIONS ==========\n`);
    console.log('1. Go to http://localhost:5173 (or your frontend URL)');
    console.log('2. Click on "Admin Login" or navigate to login page');
    console.log(`3. Enter Email: ${newUser.email}`);
    console.log(`4. Enter Password: ${password}`);
    console.log('5. Click Login');
    console.log('\n✨ You will have full admin access!\n');

  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the script
connectDB().then(() => createTestUser());
