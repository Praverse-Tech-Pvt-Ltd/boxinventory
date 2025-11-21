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
    number: { type: String, required: true, unique: true }, // human readable id
    items: { type: [challanItemSchema], default: [] },
    notes: { type: String, trim: true },
    includeGST: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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


