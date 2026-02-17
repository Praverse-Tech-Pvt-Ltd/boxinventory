import mongoose from "mongoose";

/**
 * Challan Counter Model - Manages per-year-range sequence counters
 * 
 * Schema fields:
 * - fy: Year range (e.g., "26-27" for 2026-2027)
 * - gst_next_seq: Next sequence number for GST challans in this year range
 * - nongst_next_seq: Next sequence number for Non-GST challans in this year range
 */

const challanCounterSchema = new mongoose.Schema(
  {
    fy: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\d{2}-\d{2}$/, // Validate format: YY-YY (e.g., "26-27")
    },
    gst_next_seq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 9999,
    },
    nongst_next_seq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 9999,
    },
  },
  { timestamps: true }
);

/**
 * Get or create counter for a specific year range
 * 
 * @param {string} fy - Year range (e.g., "26-27")
 * @param {string} type - Counter type: "gst" or "nongst"
 * @returns {Promise<number>} - Next sequence number
 */
challanCounterSchema.statics.getNextSequence = async function (fy, type = "gst") {
  if (type !== "gst" && type !== "nongst") {
    throw new Error(`Invalid counter type: ${type}. Must be "gst" or "nongst"`);
  }

  const fieldName = type === "gst" ? "gst_next_seq" : "nongst_next_seq";

  const counter = await this.findOneAndUpdate(
    { fy },
    { $inc: { [fieldName]: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return counter[fieldName];
};

/**
 * Get current (unadjusted) sequence for a year range without incrementing
 * 
 * @param {string} fy - Year range
 * @param {string} type - Counter type: "gst" or "nongst"
 * @returns {Promise<number>} - Current raw sequence seed (first issued number is seed+1)
 */
challanCounterSchema.statics.getCurrentSequence = async function (fy, type = "gst") {
  if (type !== "gst" && type !== "nongst") {
    throw new Error(`Invalid counter type: ${type}. Must be "gst" or "nongst"`);
  }

  const fieldName = type === "gst" ? "gst_next_seq" : "nongst_next_seq";

  const counter = await this.findOne({ fy }).select(fieldName);
  
  if (!counter) {
    // If counter doesn't exist, next sequence seed is 0 (first increment returns 1)
    return 0;
  }

  return counter[fieldName];
};

/**
 * Reset counter for a specific year range and type
 * (Use with caution - typically not needed unless recovering from error)
 * 
 * @param {string} fy - Year range
 * @param {string} type - Counter type: "gst" or "nongst"
 * @param {number} newValue - New value to set (default: 0)
 * @returns {Promise<object>} - Updated counter document
 */
challanCounterSchema.statics.resetCounter = async function (fy, type = "gst", newValue = 0) {
  if (type !== "gst" && type !== "nongst") {
    throw new Error(`Invalid counter type: ${type}. Must be "gst" or "nongst"`);
  }

  const fieldName = type === "gst" ? "gst_next_seq" : "nongst_next_seq";

  const counter = await this.findOneAndUpdate(
    { fy },
    { [fieldName]: newValue },
    { new: true, upsert: true }
  );

  return counter;
};

const ChallanCounter = mongoose.model("ChallanCounter", challanCounterSchema);

export default ChallanCounter;
