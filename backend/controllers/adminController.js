import User from "../models/User.js";
import Box from "../models/boxModel.js";
import BoxAudit from "../models/boxAuditModel.js";
import Challan from "../models/challanModel.js";
import ChallanCounter from "../models/challanCounterModel.js";
import Counter from "../models/counterModel.js";
import ClientBatch from "../models/clientBatchModel.js";
import mongoose from "mongoose";
import os from "os";
import path from "path";
import fsPromises from "fs/promises";

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

// Admin: Clean up stock inward/addition challans and related audits
export const cleanupAdditionChallans = async (req, res) => {
  try {
    const dryRun = req.query.dryRun !== "false"; // default to true for safety
    
    console.log(`[CLEANUP] Starting ${dryRun ? "DRY-RUN" : "REAL"} cleanup of addition challans...`);

    // Find all stock inward/addition challans
    // Check for challans with inventory_mode === "inward" or doc_type === "STOCK_INWARD_RECEIPT"
    const additionChallans = await Challan.find({
      $or: [
        { inventory_mode: "inward" },
        { doc_type: "STOCK_INWARD_RECEIPT" }
      ]
    }).select("_id number inventory_mode doc_type createdAt");

    console.log(`[CLEANUP] Found ${additionChallans.length} addition challans to process`);

    if (additionChallans.length === 0) {
      return res.status(200).json({
        message: "No addition challans found",
        mode: dryRun ? "dryRun" : "delete",
        deletedChallansCount: 0,
        deletedAuditCount: 0,
        deletedChallanIds: [],
      });
    }

    const additionChallanIds = additionChallans.map((c) => c._id);

    // Find related audits
    // Delete audits that:
    // 1. Reference these challans via challan field
    // 2. Have action indicating inward/addition
    // 3. Have doc_type STOCK_INWARD_RECEIPT
    const relatedAudits = await BoxAudit.find({
      $or: [
        { challan: { $in: additionChallanIds } },
        { action: { $in: ["add", "create_stock_receipt"] } },
        { doc_type: "STOCK_INWARD_RECEIPT" }
      ]
    }).select("_id action challan createdAt");

    console.log(`[CLEANUP] Found ${relatedAudits.length} related audits to process`);

    if (dryRun) {
      // DRY RUN: Report without deleting
      const sampleChallanIds = additionChallans.slice(0, 20).map((c) => ({
        id: c._id,
        number: c.number,
        type: c.doc_type,
        mode: c.inventory_mode,
      }));

      const sampleAuditIds = relatedAudits.slice(0, 20).map((a) => ({
        id: a._id,
        action: a.action,
      }));

      console.log(`[CLEANUP] DRY-RUN REPORT: Would delete ${additionChallans.length} challans and ${relatedAudits.length} audits`);

      return res.status(200).json({
        message: "Dry run completed - no data deleted",
        mode: "dryRun",
        deletedChallansCount: additionChallans.length,
        deletedAuditCount: relatedAudits.length,
        deletedChallanIds: sampleChallanIds,
        deletedAuditIds: sampleAuditIds,
        warning: "This is a dry run. Set ?dryRun=false to actually delete.",
      });
    } else {
      // REAL DELETE: Remove challans and audits
      console.log(`[CLEANUP] Starting real deletion...`);

      // Delete the addition challans
      const challanDeleteResult = await Challan.deleteMany({
        _id: { $in: additionChallanIds }
      });

      // Delete related audits
      const auditDeleteResult = await BoxAudit.deleteMany({
        $or: [
          { challan: { $in: additionChallanIds } },
          { action: { $in: ["add", "create_stock_receipt"] } },
          { doc_type: "STOCK_INWARD_RECEIPT" }
        ]
      });

      console.log(`[CLEANUP] Deleted ${challanDeleteResult.deletedCount} challans and ${auditDeleteResult.deletedCount} audits`);

      const sampleChallanIds = additionChallans.slice(0, 20).map((c) => ({
        id: c._id,
        number: c.number,
        type: c.doc_type,
        mode: c.inventory_mode,
      }));

      return res.status(200).json({
        message: "Addition challans and related audits deleted successfully",
        mode: "delete",
        deletedChallansCount: challanDeleteResult.deletedCount,
        deletedAuditCount: auditDeleteResult.deletedCount,
        deletedChallanIds: sampleChallanIds,
        success: true,
      });
    }
  } catch (error) {
    console.error("[CLEANUP] Error during cleanup:", error);
    res.status(500).json({
      message: "Server error during cleanup",
      error: error.message,
    });
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

// Admin maintenance: delete all challans and reset challan counters to restart at 001
export const resetChallansMaintenance = async (req, res) => {
  const REQUIRED_CONFIRM = "DELETE_ALL_CHALLANS_AND_RESET_001";

  try {
    const { confirm, backup = false } = req.body || {};
    if (confirm !== REQUIRED_CONFIRM) {
      return res.status(400).json({
        ok: false,
        message: "Invalid confirmation token",
      });
    }

    const runReset = async (session = null) => {
      let backupPath = null;

      if (backup) {
        const snapshotQuery = Challan.find({}).lean();
        if (session) snapshotQuery.session(session);
        const challansSnapshot = await snapshotQuery;
        backupPath = path.join(os.tmpdir(), `challans-backup-${Date.now()}.json`);
        await fsPromises.writeFile(
          backupPath,
          JSON.stringify(
            {
              createdAt: new Date().toISOString(),
              count: challansSnapshot.length,
              data: challansSnapshot,
            },
            null,
            2
          ),
          "utf8"
        );
      }

      const challanDelete = await Challan.deleteMany({}, { session });

      // Reset FY-based challan counters so next generated sequence becomes 1 => 001
      await ChallanCounter.updateMany(
        {},
        {
          $set: {
            gst_next_seq: 0,
            nongst_next_seq: 0,
          },
        },
        { session }
      );

      // Keep legacy counter compatibility in case older code paths still read these keys
      await Counter.updateOne(
        { name: "gst_challan_counter" },
        { $set: { value: 0 } },
        { upsert: true, session }
      );
      await Counter.updateOne(
        { name: "nongst_challan_counter" },
        { $set: { value: 0 } },
        { upsert: true, session }
      );

      return {
        backupPath,
        deletedChallans: challanDelete.deletedCount || 0,
      };
    };

    let result;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        result = await runReset(session);
      });
    } catch (txError) {
      const msg = String(txError?.message || "");
      const unsupportedTransaction =
        msg.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        msg.includes("transactions are not supported");

      if (!unsupportedTransaction) {
        throw txError;
      }

      console.warn("[MAINTENANCE] Transaction unavailable, running without transaction:", msg);
      result = await runReset(null);
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      ok: true,
      deleted_challans: result.deletedChallans,
      reset: ["GST", "NON_GST"],
      deleted_audits: null,
      backup_path: result.backupPath,
    });
  } catch (error) {
    console.error("[MAINTENANCE] resetChallansMaintenance error:", error);
    return res.status(500).json({
      ok: false,
      message: "Server error during challan reset",
      error: error.message,
    });
  }
};
