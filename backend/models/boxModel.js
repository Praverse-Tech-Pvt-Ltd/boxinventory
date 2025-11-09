import mongoose from "mongoose";

const boxSchema = new mongoose.Schema(
  {
    image: {
      type: String, // Cloudinary image URL
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    bagSize: {
      type: String,
      required: true, // e.g. "6 x 5 x 1.75 inch"
    },
    boxInnerSize: {
      type: String,
      required: true, // e.g. "4 x 4 x 1.5 inch"
    },
    boxOuterSize: {
      type: String,
      required: true, // e.g. "4.74 x 4.75 x 1.5 inch"
    },
    moq: {
      type: String,
      required: true, // e.g. "30 - 150PC (10pc single colour packing)"
    },
    assemblyCharge: {
      type: Number,
      required: true, // per box charge
    },
    additionalShippingCharges: {
      type: Boolean,
      default: true, // whether shipping charges apply
    },
  },
  { timestamps: true }
);

const Box = mongoose.model("Box", boxSchema);
export default Box;
