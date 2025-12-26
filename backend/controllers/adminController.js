import User from "../models/User.js";
import Box from "../models/boxModel.js";
import BoxAudit from "../models/boxAuditModel.js";
import Challan from "../models/challanModel.js";
import Counter from "../models/counterModel.js";
import ClientBatch from "../models/clientBatchModel.js";

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { name, email, role, isAdmin } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update name and email if provided
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    
    // Handle role update - support both 'role' and 'isAdmin' for backwards compatibility
    if (role && (role === "user" || role === "admin")) {
      user.role = role;
    } else if (typeof isAdmin === "boolean") {
      // Convert isAdmin boolean to role string
      user.role = isAdmin ? "admin" : "user";
    }

    const updatedUser = await user.save();
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Reset system to production state
// Only works in development mode or with correct admin secret
export const resetToProduction = async (req, res) => {
  try {
    // Safety check: only allow in development or with admin secret
    const isDevelopment = process.env.NODE_ENV !== "production";
    const adminSecret = process.env.ADMIN_RESET_SECRET;
    const providedSecret = req.body?.adminSecret;

    if (!isDevelopment && (!adminSecret || providedSecret !== adminSecret)) {
      return res.status(403).json({ message: "Unauthorized: Reset only allowed in development or with valid admin secret" });
    }

    // Step 1: Clear all transactional data
    console.log("[RESET] Clearing transactional data...");
    await Challan.deleteMany({});
    await BoxAudit.deleteMany({});
    await Box.deleteMany({});
    await ClientBatch.deleteMany({});
    
    // Step 2: Reset counters to initial values
    console.log("[RESET] Resetting counters...");
    await Counter.findOneAndUpdate(
      { name: "gst_challan_counter" },
      { value: 1 },
      { upsert: true }
    );
    await Counter.findOneAndUpdate(
      { name: "nongst_challan_counter" },
      { value: 2 },
      { upsert: true }
    );
    await Counter.findOneAndUpdate(
      { name: "stock_receipt_counter" },
      { value: 1 },
      { upsert: true }
    );

    // Step 3: Keep only the two production admin users
    const adminEmails = ["test@gmail.com", "savlavaibhav99@gmail.com"];
    const adminUsers = await User.find({ email: { $in: adminEmails } });
    
    if (adminUsers.length < 2) {
      console.warn("[RESET] Warning: Could not find both admin users. Proceeding with reset...");
    }

    // Delete all users except the two admins
    await User.deleteMany({ email: { $nin: adminEmails } });

    // Ensure the two admin users have admin role
    await User.updateMany(
      { email: { $in: adminEmails } },
      { $set: { role: "admin" } }
    );

    console.log("[RESET] System reset to production state complete");
    
    res.status(200).json({
      message: "System reset to production state successfully",
      details: {
        transactionalDataCleared: true,
        countersReset: true,
        adminUsersRetained: 2,
        retainedAdmins: adminEmails,
      },
    });
  } catch (error) {
    console.error("[RESET] Error during reset:", error);
    res.status(500).json({ message: "Server error during reset", error: error.message });
  }
};