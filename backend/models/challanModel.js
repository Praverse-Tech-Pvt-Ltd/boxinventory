import mongoose from "mongoose";

const challanItemSchema = new mongoose.Schema(
  {
    audit: { type: mongoose.Schema.Types.ObjectId, ref: "BoxAudit", required: true },
    box: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "Box", required: true },
      title: String,
      code: String,
      category: String,
    },
    quantity: { type: Number, required: true, min: 1 },
    user: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: String,
      email: String,
    },
    auditedAt: { type: Date, required: true },
  },
  { _id: false }
);

const challanSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true }, // human readable id
    items: { type: [challanItemSchema], default: [] },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Challan = mongoose.model("Challan", challanSchema);
export default Challan;


