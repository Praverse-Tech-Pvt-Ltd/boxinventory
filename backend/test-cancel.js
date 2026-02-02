import axios from "axios";
import dotenv from "dotenv";
import Challan from "./models/challanModel.js";
import User from "./models/User.js";
import mongoose from "mongoose";

dotenv.config();

const API_BASE = "http://localhost:5000/api";

async function testCancel() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Find a test challan
    const challan = await Challan.findOne({ status: "ACTIVE" }).limit(1);
    if (!challan) {
      console.log("No active challan found for testing");
      return;
    }

    console.log("\nFound challan:", challan.number, "ID:", challan._id);

    // Find an admin user for auth
    const adminUser = await User.findOne({ role: "admin" }).limit(1);
    if (!adminUser) {
      console.log("No admin user found");
      return;
    }

    console.log("Using admin user:", adminUser.email);

    // Try to cancel without token first to see the error
    console.log("\n--- Testing cancel endpoint ---");
    try {
      const response = await axios.post(
        `${API_BASE}/challans/${challan._id}/cancel`,
        { reason: "Test cancellation" },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Response:", response.status, response.data);
    } catch (error) {
      console.log("Error (expected - no auth):", error.response?.status, error.response?.data);
    }

    // Disconnect
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Test error:", error.message);
  }
}

testCancel();
