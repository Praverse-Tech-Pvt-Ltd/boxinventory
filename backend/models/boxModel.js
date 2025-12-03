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
      uppercase: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    bagSize: {
      type: String,
      required: false, // e.g. "6 x 5 x 1.75 inch"
    },
    boxInnerSize: {
      type: String,
      required: false, // e.g. "4 x 4 x 1.5 inch"
    },
    boxOuterSize: {
      type: String,
      required: false, // e.g. "4.74 x 4.75 x 1.5 inch"
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    quantityByColor: {
      type: Map,
      of: Number,
      required: true,
      default: {},
    },
    colours: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

boxSchema.index({ code: 1 });

// Transform quantityByColor Map to object in JSON responses
boxSchema.set("toJSON", {
  transform: function (doc, ret) {
    // Convert Map to plain object
    if (ret.quantityByColor instanceof Map) {
      const obj = {};
      ret.quantityByColor.forEach((value, key) => {
        obj[key] = value;
      });
      ret.quantityByColor = obj;
    } else if (ret.quantityByColor && typeof ret.quantityByColor === "object") {
      // Already an object, keep as is
      ret.quantityByColor = ret.quantityByColor;
    } else {
      ret.quantityByColor = {};
    }

    // Compute total quantity across all colors
    const values = Object.values(ret.quantityByColor || {});
    const total = values.reduce((sum, qty) => {
      const n = Number(qty);
      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
    ret.totalQuantity = total;

    return ret;
  },
});

const Box = mongoose.model("Box", boxSchema);
export default Box;
