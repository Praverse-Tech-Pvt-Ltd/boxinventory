import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/adminMiddleware.js";
import {
  getChallanCandidates,
  createChallan,
  listChallans,
  getChallanById,
  downloadChallanPdf,
  searchClients,
} from "../controllers/challanController.js";

const router = express.Router();

// Admin only
router.use(protect, adminOnly);

// Search existing clients
router.get("/search/clients", searchClients);

// List unused audits as candidates
router.get("/candidates", getChallanCandidates);

// Create challan
router.post("/", createChallan);

// List challans
router.get("/", listChallans);

// Challan details
router.get("/:id", getChallanById);

// Download challan CSV
router.get("/:id/download", downloadChallanPdf);

export default router;


