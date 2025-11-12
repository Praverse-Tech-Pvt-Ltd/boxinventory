import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const Counter = mongoose.model("Counter", counterSchema);

export default Counter;

