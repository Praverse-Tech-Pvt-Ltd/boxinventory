import mongoose from "mongoose";

const stockReceiptSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    items: [
      {
        box: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Box",
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        color: {
          type: String,
          trim: true,
        },
        note: {
          type: String,
          trim: true,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientDetails: {
      name: String,
      address: String,
      mobile: String,
      gstNumber: String,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const StockReceipt = mongoose.model("StockReceipt", stockReceiptSchema);

export default StockReceipt;
