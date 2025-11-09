import Box from "../models/boxModel.js";
import cloudinary from "../config/cloudinaryConfig.js";

// Get all boxes
export const getAllBoxes = async (req, res) => {
  try {
    const boxes = await Box.find().sort({ createdAt: -1 });
    res.status(200).json(boxes);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get box by ID
export const getBoxById = async (req, res) => {
  try {
    const box = await Box.findById(req.params.id);
    if (!box) return res.status(404).json({ message: "Box not found" });
    res.status(200).json(box);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a new box
export const createBox = async (req, res) => {
  try {
    const {
      title,
      code,
      price,
      bagSize,
      boxInnerSize,
      boxOuterSize,
      moq,
      assemblyCharge,
      additionalShippingCharges,
    } = req.body;

    // Get image URL from uploaded file or from body
    const image = req.file?.path || req.body.image;

    if (!image) {
      return res.status(400).json({ message: "Image is required" });
    }

    // Check if box with same code already exists
    const existingBox = await Box.findOne({ code: code?.toUpperCase() });
    if (existingBox) {
      // If image was uploaded but box creation fails, delete the uploaded image
      if (req.file?.public_id) {
        await cloudinary.uploader.destroy(req.file.public_id);
      }
      return res.status(400).json({ message: "Box with this code already exists" });
    }

    const box = await Box.create({
      image,
      title,
      code: code?.toUpperCase(),
      price,
      bagSize,
      boxInnerSize,
      boxOuterSize,
      moq,
      assemblyCharge,
      additionalShippingCharges:
        additionalShippingCharges !== undefined
          ? additionalShippingCharges
          : true,
    });

    res.status(201).json(box);
  } catch (error) {
    // If image was uploaded but box creation fails, delete the uploaded image
    if (req.file?.public_id) {
      try {
        await cloudinary.uploader.destroy(req.file.public_id);
      } catch (deleteError) {
        console.error("Error deleting uploaded image:", deleteError);
      }
    }

    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({ message: "Box with this code already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", error: error.message });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update box
export const updateBox = async (req, res) => {
  try {
    const {
      title,
      code,
      price,
      bagSize,
      boxInnerSize,
      boxOuterSize,
      moq,
      assemblyCharge,
      additionalShippingCharges,
    } = req.body;

    const box = await Box.findById(req.params.id);
    if (!box) return res.status(404).json({ message: "Box not found" });

    // If code is being updated, check for duplicates
    if (code && code.toUpperCase() !== box.code) {
      const existingBox = await Box.findOne({ code: code.toUpperCase() });
      if (existingBox) {
        // If new image was uploaded but update fails, delete it
        if (req.file?.public_id) {
          await cloudinary.uploader.destroy(req.file.public_id);
        }
        return res.status(400).json({ message: "Box with this code already exists" });
      }
    }

    // Handle image update - if new image is uploaded, delete old one from Cloudinary
    if (req.file?.path) {
      // Delete old image from Cloudinary if it exists
      if (box.image) {
        try {
          // Try to extract public_id from the stored image URL
          // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{folder}/{public_id}.{format}
          const urlParts = box.image.split('/');
          const uploadIndex = urlParts.findIndex(part => part === 'upload');
          if (uploadIndex !== -1 && urlParts.length > uploadIndex + 2) {
            // Get the part after version (which is the folder/public_id.format)
            const folderAndFile = urlParts.slice(uploadIndex + 2).join('/');
            const publicId = folderAndFile.split('.')[0]; // Remove file extension
            await cloudinary.uploader.destroy(publicId);
          }
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
          // Continue even if old image deletion fails
        }
      }
      box.image = req.file.path; // Store new Cloudinary URL
    } else if (req.body.image !== undefined) {
      // Allow manual image URL update
      box.image = req.body.image;
    }

    // Update other fields
    if (title !== undefined) box.title = title;
    if (code !== undefined) box.code = code.toUpperCase();
    if (price !== undefined) box.price = price;
    if (bagSize !== undefined) box.bagSize = bagSize;
    if (boxInnerSize !== undefined) box.boxInnerSize = boxInnerSize;
    if (boxOuterSize !== undefined) box.boxOuterSize = boxOuterSize;
    if (moq !== undefined) box.moq = moq;
    if (assemblyCharge !== undefined) box.assemblyCharge = assemblyCharge;
    if (additionalShippingCharges !== undefined)
      box.additionalShippingCharges = additionalShippingCharges;

    const updatedBox = await box.save();
    res.status(200).json(updatedBox);
  } catch (error) {
    // If new image was uploaded but update fails, delete it
    if (req.file?.public_id) {
      try {
        await cloudinary.uploader.destroy(req.file.public_id);
      } catch (deleteError) {
        console.error("Error deleting uploaded image:", deleteError);
      }
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: "Box with this code already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", error: error.message });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete box
export const deleteBox = async (req, res) => {
  try {
    const box = await Box.findById(req.params.id);
    if (!box) return res.status(404).json({ message: "Box not found" });

    // Delete image from Cloudinary if it exists
    if (box.image) {
      try {
        // Extract public_id from Cloudinary URL
        // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{folder}/{public_id}.{format}
        const urlParts = box.image.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');
        if (uploadIndex !== -1 && urlParts.length > uploadIndex + 2) {
          // Get the part after version (which is the folder/public_id.format)
          const folderAndFile = urlParts.slice(uploadIndex + 2).join('/');
          const publicId = folderAndFile.split('.')[0]; // Remove file extension
          await cloudinary.uploader.destroy(publicId);
        }
      } catch (deleteError) {
        console.error("Error deleting image from Cloudinary:", deleteError);
        // Continue with box deletion even if image deletion fails
      }
    }

    // Delete the box from database
    await Box.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Box deleted successfully", box });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

