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
  editChallan,
  cancelChallan,
  archiveNonDispatchChallans,
  getRecentChallans,
  getClientWiseSummary,
  getTotalSalesSummary,
} from "../controllers/challanController.js";

const router = express.Router();

// Admin only
router.use(protect, adminOnly);

// Search existing clients
router.get("/search/clients", searchClients);

// Summary endpoints (must be before /:id route)
router.get("/summary/recent", getRecentChallans);
router.get("/summary/client-wise", getClientWiseSummary);
router.get("/summary/totals", getTotalSalesSummary);

// List unused audits as candidates
router.get("/candidates", getChallanCandidates);

// Archive non-dispatch (ADD mode) challans — admin cleanup endpoint
router.post("/archive/non-dispatch", archiveNonDispatchChallans);

// Create challan
router.post("/", createChallan);

// List challans
router.get("/", listChallans);

// Challan details (must be after /search and /candidates, before /:id)
router.get("/:id", getChallanById);

// Download challan PDF — supports both /download and /pdf aliases
router.get("/:id/download", downloadChallanPdf);
router.get("/:id/pdf", downloadChallanPdf);

// Edit challan (whitelisted fields only)
router.put("/:id", editChallan);

// Cancel challan (marks as CANCELLED, reverses inventory if dispatch)
router.post("/:id/cancel", cancelChallan);

export default router;


