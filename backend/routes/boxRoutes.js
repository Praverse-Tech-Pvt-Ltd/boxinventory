import express from "express";
import {
  getAllBoxes,
  getBoxById,
  createBox,
  updateBox,
  deleteBox,
} from "../controllers/boxController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/adminMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// Public routes - anyone can view boxes
router.get("/", getAllBoxes);
router.get("/:id", getBoxById);

// Protected admin routes - only admins can create, update, delete
router.use(protect, adminOnly);

// Create box with image upload
router.post("/", upload.single("image"), createBox);

// Update box (image upload is optional)
router.put("/:id", upload.single("image"), updateBox);

// Delete box
router.delete("/:id", deleteBox);

export default router;

