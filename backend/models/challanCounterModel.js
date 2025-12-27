import mongoose from "mongoose";

/**
 * Challan Counter Model - Manages per-FY sequence counters
 * 
 * Schema fields:
 * - fy: Financial Year (e.g., "25-26")
 * - gst_next_seq: Next sequence number for GST challans in this FY
 * - nongst_next_seq: Next sequence number for Non-GST challans in this FY
 */

const challanCounterSchema = new mongoose.Schema(
  {
    fy: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\d{2}-\d{2}$/, // Validate format: YY-YY (e.g., "25-26")
    },
    gst_next_seq: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 9999,
    },
    nongst_next_seq: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 9999,
    },
  },
  { timestamps: true }
);

/**
 * Get or create counter for a specific FY
 * 
 * @param {string} fy - Financial Year (e.g., "25-26")
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
 * Get current (unadjusted) sequence for a FY without incrementing
 * 
 * @param {string} fy - Financial Year
 * @param {string} type - Counter type: "gst" or "nongst"
 * @returns {Promise<number>} - Current sequence number
 */
challanCounterSchema.statics.getCurrentSequence = async function (fy, type = "gst") {
  if (type !== "gst" && type !== "nongst") {
    throw new Error(`Invalid counter type: ${type}. Must be "gst" or "nongst"`);
  }

  const fieldName = type === "gst" ? "gst_next_seq" : "nongst_next_seq";

  const counter = await this.findOne({ fy }).select(fieldName);
  
  if (!counter) {
    // If counter doesn't exist, next sequence will be 1
    return 1;
  }

  return counter[fieldName];
};

/**
 * Reset counter for a specific FY and type
 * (Use with caution - typically not needed unless recovering from error)
 * 
 * @param {string} fy - Financial Year
 * @param {string} type - Counter type: "gst" or "nongst"
 * @param {number} newValue - New value to set (default: 1)
 * @returns {Promise<object>} - Updated counter document
 */
challanCounterSchema.statics.resetCounter = async function (fy, type = "gst", newValue = 1) {
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
