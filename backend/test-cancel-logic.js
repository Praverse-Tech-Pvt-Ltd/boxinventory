import mongoose from "mongoose";
import dotenv from "dotenv";
import Challan from "./models/challanModel.js";
import User from "./models/User.js";
import Box from "./models/boxModel.js";
import jwt from "jsonwebtoken";

dotenv.config();

async function testCancelChallan() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✓ Connected to MongoDB\n");

    // Find an admin user
    const adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) {
      console.log("✗ No admin user found in database");
      await mongoose.disconnect();
      return;
    }

    console.log("✓ Found admin user:", adminUser.email, "\n");

    // Find an active challan
    const challan = await Challan.findOne({ status: "ACTIVE" });
    if (!challan) {
      console.log("✗ No active challan found for testing");
      await mongoose.disconnect();
      return;
    }

    console.log("✓ Found active challan:", challan.number, "(ID: " + challan._id + ")\n");

    // Simulate what the backend would do
    console.log("=== Simulating cancelChallan logic ===\n");

    // Check inventory mode
    console.log("Inventory mode:", challan.inventory_mode);
    console.log("Current status:", challan.status);
    console.log("Items count:", challan.items.length);

    if (challan.inventory_mode === "dispatch" || challan.inventory_mode === "DISPATCH") {
      console.log("\n→ This is a DISPATCH challan, will reverse inventory\n");

      // Simulate reversal
      for (const item of challan.items) {
        const boxId = item.box?._id || item.box;
        if (!boxId) {
          console.log("  ⚠ Skipping item with no boxId");
          continue;
        }

        const box = await Box.findById(boxId);
        if (!box) {
          console.log("  ✗ Box not found:", boxId);
          continue;
        }

        console.log("  Box:", box.code, "| Qty to reverse:", item.quantity);
      }
    } else {
      console.log("\n→ Not a DISPATCH challan, skipping inventory reversal\n");
    }

    // Simulate the update
    console.log("\n→ Would update challan with:");
    console.log("   status: 'CANCELLED'");
    console.log("   cancelledAt:", new Date());
    console.log("   cancelledBy:", adminUser._id);
    console.log("   cancelReason: 'Test cancellation'");

    // Try the actual update
    console.log("\n→ Attempting actual database update...\n");
    const updateData = {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: adminUser._id,
      cancelReason: "Test cancellation",
      reversalApplied: false,
    };

    const updatedChallan = await Challan.findByIdAndUpdate(challan._id, updateData, { new: true })
      .populate("createdBy", "name email")
      .populate("cancelledBy", "name email");

    console.log("✓ Update successful!\n");
    console.log("Updated challan:");
    console.log("  Number:", updatedChallan.number);
    console.log("  Status:", updatedChallan.status);
    console.log("  CancelledBy:", updatedChallan.cancelledBy?.email);

    // Rollback the test (change status back to ACTIVE)
    console.log("\n→ Rolling back test update...");
    await Challan.findByIdAndUpdate(challan._id, { status: "ACTIVE", cancelledAt: null, cancelledBy: null, cancelReason: null });
    console.log("✓ Rollback complete\n");

    await mongoose.disconnect();
    console.log("✓ Test completed successfully!");
  } catch (error) {
    console.error("✗ Test error:", error.message);
    console.error("Stack:", error.stack);
    await mongoose.disconnect();
  }
}

testCancelChallan();
