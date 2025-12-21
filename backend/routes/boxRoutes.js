import express from "express";
import {
  getAllBoxes,
  getAllAudits,
  getBoxById,
  createBox,
  updateBox,
  deleteBox,
  addBoxQuantity,
  subtractBoxQuantity,
  getBoxAudits,
  addColorToBox,
} from "../controllers/boxController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/adminMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// Public routes - anyone can view boxes
router.get("/", getAllBoxes);

// Admin: global audits list (must be BEFORE '/:id' to avoid conflict)
router.get("/audits", protect, adminOnly, getAllAudits);

// Public route to get single box by id
router.get("/:id", getBoxById);

// Authenticated user routes - add/subtract quantity
router.post("/:id/add", protect, addBoxQuantity);
router.post("/:id/subtract", protect, subtractBoxQuantity);

// Admin: add color to box
router.post("/:id/add-color", protect, adminOnly, addColorToBox);

// Protected admin routes - only admins can create, update, delete
router.use(protect, adminOnly);

// Create box with image upload
router.post("/", upload.single("image"), createBox);

// Update box (image upload is optional)
router.put("/:id", upload.single("image"), updateBox);

// View audits for a box
router.get("/:id/audits", getBoxAudits);

// Delete box
router.delete("/:id", deleteBox);

export default router;

