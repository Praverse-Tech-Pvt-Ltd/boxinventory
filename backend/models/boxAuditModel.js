import mongoose from "mongoose";

const boxAuditSchema = new mongoose.Schema(
  {
    box: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Box",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    challan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challan",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

const BoxAudit = mongoose.model("BoxAudit", boxAuditSchema);
export default BoxAudit;


