import mongoose from "mongoose";

const clientDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    mobile: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
  },
  { _id: false }
);

const boxSnapshotSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    code: { type: String, trim: true },
    category: { type: String, trim: true },
  },
  { _id: false }
);

const colorLineSchema = new mongoose.Schema(
  {
    color: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
  },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  {
    auditId: { type: String, required: true, trim: true },
    cavity: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    rate: { type: Number, min: 0 },
    assemblyCharge: { type: Number, min: 0 },
    packagingCharge: { type: Number, min: 0 },
    color: { type: String, trim: true },
    colours: { type: [String], default: [] },
    colorLines: { type: [colorLineSchema], default: [] },
    boxSnapshot: boxSnapshotSchema,
  },
  { _id: false }
);

const manualItemSchema = new mongoose.Schema(
  {
    boxId: { type: String, trim: true },
    cavity: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    rate: { type: Number, min: 0 },
    assemblyCharge: { type: Number, min: 0 },
    packagingCharge: { type: Number, min: 0 },
    color: { type: String, trim: true },
    colours: { type: [String], default: [] },
    colorLines: { type: [colorLineSchema], default: [] },
    boxSnapshot: boxSnapshotSchema,
  },
  { _id: false }
);

const clientBatchSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    auditIds: { type: [String], default: [] },
    lineItems: { type: [lineItemSchema], default: [] },
    manualItems: { type: [manualItemSchema], default: [] },
    hsnCode: { type: String, trim: true },
    terms: { type: String, trim: true },
    challanTaxType: {
      type: String,
      enum: ["GST", "NON_GST"],
      default: "GST",
    },
    challanDate: { type: String, trim: true },
    inventory_mode: {
      type: String,
      enum: ["dispatch", "record_only"],
    },
    payment_mode: {
      type: String,
      enum: ["Cash", "GPay", "Bank Account", "Credit", null],
      default: null,
    },
    remarks: { type: String, trim: true },
    packaging_charges_overall: { type: Number, default: 0 },
    shipping_charges: { type: Number, default: 0 },
    discount_pct: { type: Number, default: 0, min: 0, max: 100 },
    clientDetails: clientDetailsSchema,
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const ClientBatch = mongoose.model("ClientBatch", clientBatchSchema);

export default ClientBatch;


