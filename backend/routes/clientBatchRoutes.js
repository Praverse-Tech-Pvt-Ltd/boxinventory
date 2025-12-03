import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/adminMiddleware.js";
import {
  appendToClientBatch,
  createClientBatch,
  listClientBatches,
  moveAuditBetweenBatches,
  removeAuditFromBatch,
  removeClientBatch,
} from "../controllers/clientBatchController.js";

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").get(listClientBatches).post(createClientBatch);
router.post("/:id/append", appendToClientBatch);
router.post("/:id/remove-audit", removeAuditFromBatch);
router.post("/move-audit", moveAuditBetweenBatches);
router.delete("/:id", removeClientBatch);

export default router;


