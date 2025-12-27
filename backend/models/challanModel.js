import mongoose from "mongoose";

const challanItemSchema = new mongoose.Schema(
  {
    audit: { type: mongoose.Schema.Types.ObjectId, ref: "BoxAudit" },
    box: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "Box", required: true },
      title: String,
      code: String,
      category: String,
      colours: [String],
    },
    cavity: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    rate: { type: Number, default: 0 },
    assemblyCharge: { type: Number, default: 0 },
    packagingCharge: { type: Number, default: 0 },
    color: { type: String, default: "" },
    colours: { type: [String], default: [] },
    user: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      email: String,
    },
    auditedAt: { type: Date },
    manualEntry: { type: Boolean, default: false },
  },
  { _id: false }
);

const challanSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true }, // Format: VPP/25-26/0001 or NGST/25-26/0001
    challan_seq: { type: Number, required: true, index: true }, // Sequence within FY (1-9999)
    challan_fy: { type: String, required: true, index: true }, // Financial Year (e.g., "25-26")
    challan_tax_type: {
      type: String,
      enum: ["GST", "NON_GST"],
      default: "GST",
      required: true,
      index: true,
    },
    doc_type: {
      type: String,
      enum: ["OUTWARD_CHALLAN", "STOCK_INWARD_RECEIPT"],
      default: "OUTWARD_CHALLAN",
      index: true,
    },
    items: { type: [challanItemSchema], default: [] },
    notes: { type: String, trim: true },
    includeGST: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hsnCode: { type: String, trim: true },
    inventoryType: { 
      type: String, 
      enum: ["add", "subtract", "dispatch"], 
      default: "dispatch",
      required: true 
    },
    clientDetails: {
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      mobile: { type: String, trim: true },
      gstNumber: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

const Challan = mongoose.model("Challan", challanSchema);
export default Challan;


