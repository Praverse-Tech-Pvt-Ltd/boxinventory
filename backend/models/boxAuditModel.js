import mongoose from "mongoose";

const boxAuditSchema = new mongoose.Schema(
  {
    box: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Box",
      required: false,
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quantity: {
      type: Number,
      required: false,
      default: 0,
    },
    color: {
      type: String,
      required: false,
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
    action: {
      type: String,
      enum: ["add", "subtract", "dispatch", "password_change", "create_challan", "create_stock_receipt", "create_box", "update_box"],
      default: "subtract",
      index: true,
    },
    doc_type: {
      type: String,
      enum: ["OUTWARD_CHALLAN", "STOCK_INWARD_RECEIPT"],
      default: "OUTWARD_CHALLAN",
      index: true,
    },
  },
  { timestamps: true }
);

const BoxAudit = mongoose.model("BoxAudit", boxAuditSchema);
export default BoxAudit;


