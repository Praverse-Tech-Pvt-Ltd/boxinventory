import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetToProduction,
  cleanupAdditionChallans,
} from "../controllers/adminController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/adminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly); // Apply auth + admin check to all routes

router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.post("/reset-to-production", resetToProduction);

// Cleanup routes
router.delete("/cleanup/addition-challans", cleanupAdditionChallans);
router.delete("/cleanup/addition-data", cleanupAdditionChallans); // Alias for part B endpoint

export default router;
