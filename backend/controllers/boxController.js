import Box from "../models/boxModel.js";
import cloudinary from "../config/cloudinaryConfig.js";
import BoxAudit from "../models/boxAuditModel.js";

// Get all boxes
export const getAllBoxes = async (req, res) => {
  try {
    const boxes = await Box.find().sort({ createdAt: -1 });
    res.status(200).json(boxes);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: get all audits (global list)
export const getAllAudits = async (req, res) => {
  try {
    const audits = await BoxAudit.find({})
      .populate("user", "name email role")
      .populate("box", "title code category")
      .sort({ createdAt: -1 });
    res.status(200).json(audits);
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
      category,
      quantity,
      colours,
    } = req.body;

    // Get image URL from uploaded file or from body
    const image = req.file?.path || req.body.image;

    if (!image) {
      return res.status(400).json({ message: "Image is required" });
    }

    // Convert comma-separated colours string to array
    let coloursArray = [];
    if (colours) {
      if (typeof colours === 'string') {
        coloursArray = colours.split(',').map(c => c.trim()).filter(c => c.length > 0);
      } else if (Array.isArray(colours)) {
        coloursArray = colours;
      }
    }

    // Validate that colours array is not empty
    if (coloursArray.length === 0) {
      // If image was uploaded but validation fails, delete it
      if (req.file?.public_id) {
        await cloudinary.uploader.destroy(req.file.public_id);
      }
      return res.status(400).json({ message: "At least one colour is required" });
    }

    // Handle quantityByColor - can be an object, Map, or JSON string
    let quantityByColorMap = new Map();
    let quantityByColorData = req.body.quantityByColor;
    
    // Parse JSON string if it's a string
    if (typeof quantityByColorData === 'string') {
      try {
        quantityByColorData = JSON.parse(quantityByColorData);
      } catch (e) {
        // If parsing fails, treat as empty
        quantityByColorData = null;
      }
    }
    
    if (quantityByColorData) {
      if (typeof quantityByColorData === 'object' && !Array.isArray(quantityByColorData)) {
        Object.entries(quantityByColorData).forEach(([color, qty]) => {
          const parsedQty = parseInt(qty, 10);
          if (color && !isNaN(parsedQty) && parsedQty >= 0) {
            quantityByColorMap.set(color, parsedQty);
          }
        });
      }
    } else if (quantity) {
      // Legacy support: if quantity is provided but not quantityByColor, distribute evenly or set first color
      const defaultQty = parseInt(quantity, 10) || 0;
      if (coloursArray.length > 0 && defaultQty > 0) {
        quantityByColorMap.set(coloursArray[0], defaultQty);
      }
    }

    const box = await Box.create({
      image,
      title,
      code: code?.toUpperCase(),
      price: parseFloat(price),
      bagSize,
      boxInnerSize,
      boxOuterSize,
      category: category?.toLowerCase(),
      quantityByColor: quantityByColorMap,
      colours: coloursArray,
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

    if (error.name === "ValidationError") {
      console.error("Validation error:", error);
      return res.status(400).json({ 
        message: "Validation error", 
        error: error.message,
        details: error.errors 
      });
    }
    console.error("Error creating box:", error);
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
      category,
      quantity,
      colours,
    } = req.body;

    const box = await Box.findById(req.params.id);
    if (!box) return res.status(404).json({ message: "Box not found" });

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
    if (category !== undefined) box.category = category.toLowerCase();
    
    // Handle quantityByColor - can be an object, Map, or JSON string
    if (req.body.quantityByColor !== undefined) {
      const quantityByColorMap = new Map();
      let quantityByColorData = req.body.quantityByColor;
      
      // Parse JSON string if it's a string
      if (typeof quantityByColorData === 'string') {
        try {
          quantityByColorData = JSON.parse(quantityByColorData);
        } catch (e) {
          // If parsing fails, treat as empty
          quantityByColorData = null;
        }
      }
      
      if (quantityByColorData && typeof quantityByColorData === 'object' && !Array.isArray(quantityByColorData)) {
        Object.entries(quantityByColorData).forEach(([color, qty]) => {
          const parsedQty = parseInt(qty, 10);
          if (color && !isNaN(parsedQty) && parsedQty >= 0) {
            quantityByColorMap.set(color, parsedQty);
          }
        });
      }
      box.quantityByColor = quantityByColorMap;
    } else if (quantity !== undefined) {
      // Legacy support: if quantity is provided but not quantityByColor, update first color or distribute
      const parsedQty = parseInt(quantity, 10);
      if (box.colours && box.colours.length > 0) {
        const currentMap = box.quantityByColor || new Map();
        currentMap.set(box.colours[0], parsedQty);
        box.quantityByColor = currentMap;
      }
    }
    
    // Handle colours - convert comma-separated string to array
    if (colours !== undefined) {
      if (typeof colours === 'string') {
        box.colours = colours.split(',').map(c => c.trim()).filter(c => c.length > 0);
      } else if (Array.isArray(colours)) {
        box.colours = colours;
      }
    }

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

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", error: error.message });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Subtract quantity from a box (user action) and create audit
export const addBoxQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, color, note } = req.body;

    const parsedQty = parseInt(quantity, 10);
    if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive integer" });
    }

    if (!color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({ message: "Color is required" });
    }

    const box = await Box.findById(id);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Get current quantity by color map
    const quantityByColor = box.quantityByColor || new Map();
    const colorKey = color.trim();
    const currentQty = quantityByColor.get(colorKey) || 0;

    // Add quantity for the specific color
    quantityByColor.set(colorKey, currentQty + parsedQty);
    box.quantityByColor = quantityByColor;
    await box.save();

    const audit = await BoxAudit.create({
      box: box._id,
      user: req.user._id,
      quantity: parsedQty,
      color: colorKey,
      note: note || undefined,
      action: "add",
    });

    res.status(200).json({ message: "Quantity added", box, audit });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const subtractBoxQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, color, note } = req.body;

    const parsedQty = parseInt(quantity, 10);
    if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive integer" });
    }

    if (!color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({ message: "Color is required" });
    }

    const box = await Box.findById(id);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Get current quantity by color map
    const quantityByColor = box.quantityByColor || new Map();
    const colorKey = color.trim();
    const currentQty = quantityByColor.get(colorKey) || 0;

    if (currentQty < parsedQty) {
      return res.status(400).json({ 
        message: `Insufficient stock for color "${colorKey}". Available: ${currentQty}, Requested: ${parsedQty}` 
      });
    }

    // Update quantity for the specific color
    quantityByColor.set(colorKey, currentQty - parsedQty);
    box.quantityByColor = quantityByColor;
    await box.save();

    const audit = await BoxAudit.create({
      box: box._id,
      user: req.user._id,
      quantity: parsedQty,
      color: colorKey,
      note: note || undefined,
      action: "subtract",
    });

    res.status(200).json({ message: "Quantity subtracted", box, audit });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: get audits for a specific box
export const getBoxAudits = async (req, res) => {
  try {
    const { id } = req.params;
    const audits = await BoxAudit.find({ box: id })
      .populate("user", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json(audits);
  } catch (error) {
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

// Add a new color to a box
export const addColorToBox = async (req, res) => {
  try {
    const { id } = req.params;
    const { color } = req.body;

    if (!color || !color.trim()) {
      return res.status(400).json({ message: "Color name is required" });
    }

    const box = await Box.findById(id);
    if (!box) return res.status(404).json({ message: "Box not found" });

    const trimmedColor = color.trim();
    
    // Check if color already exists
    if (Array.isArray(box.colours) && box.colours.includes(trimmedColor)) {
      return res.status(400).json({ message: `Color "${trimmedColor}" already exists for this product` });
    }

    // Add color to the box
    if (!Array.isArray(box.colours)) {
      box.colours = [];
    }
    box.colours.push(trimmedColor);

    // Initialize color in quantityByColor map if it doesn't exist
    if (!box.quantityByColor) {
      box.quantityByColor = new Map();
    }
    if (!box.quantityByColor.has(trimmedColor)) {
      box.quantityByColor.set(trimmedColor, 0);
    }

    await box.save();

    res.status(200).json({
      message: `Color "${trimmedColor}" added successfully`,
      box: {
        _id: box._id,
        title: box.title,
        code: box.code,
        colours: box.colours,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

