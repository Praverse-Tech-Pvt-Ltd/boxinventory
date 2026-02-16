import mongoose from "mongoose";
import User from "../backend/models/User.js";
import Challan from "../backend/models/challanModel.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const removeChallansByUser = async (userName) => {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/boxinventory");
    console.log("✅ Connected to MongoDB");

    // Find user by name
    console.log(`\n🔍 Searching for user: "${userName}"...`);
    const user = await User.findOne({ name: new RegExp(userName, "i") });
    
    if (!user) {
      console.log(`❌ User "${userName}" not found`);
      return;
    }

    console.log(`✅ Found user: ${user.name} (ID: ${user._id})`);

    // Find all challans created by this user
    console.log(`\n📋 Finding challans created by this user...`);
    const challans = await Challan.find({ createdBy: user._id });
    
    if (challans.length === 0) {
      console.log(`ℹ️  No challans found created by this user`);
      return;
    }

    console.log(`Found ${challans.length} challan(s):`);
    challans.forEach((challan, idx) => {
      console.log(`  ${idx + 1}. Challan #${challan.number} (Created: ${challan.createdAt})`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  WARNING: This will DELETE all ${challans.length} challan(s) created by ${user.name}`);
    console.log(`Press Ctrl+C to cancel, or wait 5 seconds to proceed...`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete challans
    console.log(`\n🗑️  Deleting challans...`);
    const result = await Challan.deleteMany({ createdBy: user._id });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} challan(s)`);
    console.log(`\nDone! Removed all challans created by ${user.name}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Get user name from command line argument
const userName = process.argv[2] || "Pratham Shrivastav";
console.log(`\n========================================`);
console.log(`  Remove Challans by User Script`);
console.log(`========================================\n`);

removeChallansByUser(userName);
