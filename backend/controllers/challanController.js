import BoxAudit from "../models/boxAuditModel.js";
import Box from "../models/boxModel.js";
import Challan from "../models/challanModel.js";
import ChallanCounter from "../models/challanCounterModel.js";
import { generateChallanPdf } from "../utils/challanPdfGenerator.js";
import { generateStockReceiptPdf } from "../utils/stockReceiptPdfGenerator.js";
import { 
  getFinancialYear, 
  generateGSTChallanNumber, 
  generateNonGSTChallanNumber,
  formatChallanSequence 
} from "../utils/financialYearUtils.js";
import fsPromises from "fs/promises";

// Admin: list audits available to generate a challan (unused audits)
export const getChallanCandidates = async (req, res) => {
  try {
    const audits = await BoxAudit.find({ used: false })
      .populate("user", "name email")
      .populate("box", "title code category colours boxInnerSize price")
      .sort({ createdAt: -1 });
    res.status(200).json(audits);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Generate GST challan number with FY-based numbering
 * Format: VPP/25-26/0001
 * 
 * @param {Date} challanDate - Date of challan (used to determine FY)
 * @returns {Promise<{number: string, fy: string, seq: number}>} Challan details
 */
async function generateGSTChallanNumber(challanDate) {
  const fy = getFinancialYear(challanDate);
  const seq = await ChallanCounter.getNextSequence(fy, "gst");
  const number = generateGSTChallanNumber(fy, seq);
  
  return { number, fy, seq };
}

/**
 * Generate Non-GST challan number with FY-based numbering
 * Format: NGST/25-26/0001
 * 
 * @param {Date} challanDate - Date of challan (used to determine FY)
 * @returns {Promise<{number: string, fy: string, seq: number}>} Challan details
 */
async function generateNonGSTChallanNumber(challanDate) {
  const fy = getFinancialYear(challanDate);
  const seq = await ChallanCounter.getNextSequence(fy, "nongst");
  const number = generateNonGSTChallanNumber(fy, seq);
  
  return { number, fy, seq };
}

/**
 * Generate Stock Receipt number (independent numbering, format: SR/25-26/0001)
 */
async function generateStockReceiptNumberHelper(receiptDate) {
  const fy = getFinancialYear(receiptDate);
  const seq = await ChallanCounter.getNextSequence(fy, "stock_receipt");
  const paddedSeq = formatChallanSequence(seq);
  const number = `SR/${fy}/${paddedSeq}`;
  
  return { number, fy, seq };
}

// Admin: create challan from selected audit IDs and/or manual items
export const createChallan = async (req, res) => {
  try {
    const { auditIds, notes, terms, note, clientDetails, manualItems, hsnCode, inventoryType, challanTaxType } = req.body;
    const auditIdsArray = Array.isArray(auditIds) ? auditIds.filter(Boolean) : [];
    const manualItemsInput = Array.isArray(manualItems) ? manualItems.filter(Boolean) : [];
    
    // Normalize tax type: default to GST, accept GST or NON_GST
    const taxType = (String(challanTaxType).toUpperCase().trim() === "NON_GST" || String(challanTaxType).toUpperCase().trim() === "NONGST") ? "NON_GST" : "GST";
    console.log(`[createChallan] challanTaxType received: "${challanTaxType}", normalized to: "${taxType}"`);
    
    // Normalize inventory type: "add" means add stock, anything else means subtract/dispatch
    const invType = String(inventoryType).toLowerCase().trim() === "add" ? "add" : "subtract";
    console.log(`[createChallan] inventoryType received: "${inventoryType}", normalized to: "${invType}"`);

    // If ADD mode, create a Stock Inward Receipt instead of Outward Challan
    if (invType === "add") {
      return await createStockInwardReceipt(req, res, auditIdsArray, manualItemsInput, clientDetails, taxType);
    }

    if (auditIdsArray.length === 0 && manualItemsInput.length === 0) {
      return res
        .status(400)
        .json({ message: "Provide at least one audited item or add manual challan rows" });
    }

    // Fetch audits and validate
    let audits = [];
    if (auditIdsArray.length > 0) {
      audits = await BoxAudit.find({ _id: { $in: auditIdsArray }, used: false })
        .populate("user", "name email")
        .populate("box", "title code category colours price");

      if (audits.length !== auditIdsArray.length) {
        return res.status(400).json({ message: "Some audits are invalid or already used" });
      }
    }

    // Generate challan number with FY-based numbering
    const challanDetails = taxType === "GST"
      ? await generateGSTChallanNumber(new Date())
      : await generateNonGSTChallanNumber(new Date());
    
    const { number: challanNumber, fy: challanFY, seq: challanSeq } = challanDetails;
    
    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    const lineItemMap = new Map();
    lineItems.forEach((item) => {
      if (item && item.auditId) {
        lineItemMap.set(String(item.auditId), item);
      }
    });
    
    // Validate audited items inventory (only for SUBTRACT/DISPATCH mode)
    if (invType === "subtract" && audits.length > 0) {
      // Collect usage from audited items
      const auditUsageByBox = new Map(); // boxId -> Map<color, qty>
      audits.forEach((a) => {
        const lineItemOverride = lineItemMap.get(String(a._id));
        const qty = Number(lineItemOverride?.quantity ?? a.quantity);
        const color = lineItemOverride?.color || a.color || "";
        const boxId = String(a.box._id);
        
        if (color && qty > 0) {
          if (!auditUsageByBox.has(boxId)) {
            auditUsageByBox.set(boxId, new Map());
          }
          const colorMap = auditUsageByBox.get(boxId);
          const prev = colorMap.get(color) || 0;
          colorMap.set(color, prev + qty);
        }
      });
      
      // Fetch boxes for inventory check - ONLY for SUBTRACT mode
      if (invType === "subtract" && auditUsageByBox.size > 0) {
        console.log(`[audit-validation] Running validation for SUBTRACT mode`);
        const boxIds = Array.from(auditUsageByBox.keys());
        const boxes = await Box.find({ _id: { $in: boxIds } });
        
        for (const box of boxes) {
          const boxIdStr = String(box._id);
          const colorUsage = auditUsageByBox.get(boxIdStr);
          if (!colorUsage) continue;
          const quantityByColor = box.quantityByColor || new Map();
          
          for (const [colorKey, usedQty] of colorUsage.entries()) {
            const currentQty = quantityByColor.get(colorKey) || 0;
            if (currentQty < usedQty) {
              console.log(`[audit-validation-failed] Box: ${box.code}, Color: ${colorKey}, Available: ${currentQty}, Required: ${usedQty}`);
              return res.status(400).json({
                message: `Insufficient stock for box "${box.code}" color "${colorKey}". Available: ${currentQty}, Required: ${usedQty}`,
              });
            }
          }
        }
      } else if (auditUsageByBox.size > 0) {
        console.log(`[audit-update] Skipping validation for ADD mode`);
      }
    }
    
    const auditedItems = audits.map((a) => ({
      audit: a._id,
      box: {
        _id: a.box._id,
        title: a.box.title,
        code: a.box.code,
        category: a.box.category,
        colours: Array.isArray(a.box.colours) ? a.box.colours : [],
      },
      cavity: lineItemMap.get(String(a._id))?.cavity || "",
      quantity: (() => {
        const val = Number(lineItemMap.get(String(a._id))?.quantity ?? a.quantity);
        return Number.isFinite(val) && val > 0 ? val : a.quantity;
      })(),
      rate: Number(lineItemMap.get(String(a._id))?.rate || 0),
      assemblyCharge: Number(lineItemMap.get(String(a._id))?.assemblyCharge || 0),
      packagingCharge: Number(lineItemMap.get(String(a._id))?.packagingCharge || 0),
      color: lineItemMap.get(String(a._id))?.color || a.color || "",
      colours: (() => {
        const lineColours = lineItemMap.get(String(a._id))?.colours;
        if (Array.isArray(lineColours) && lineColours.length > 0) return lineColours;
        const auditColor = lineItemMap.get(String(a._id))?.color || a.color;
        if (auditColor) return [auditColor];
        if (Array.isArray(a.box.colours)) return a.box.colours;
        return [];
      })(),
      user: { _id: a.user._id, name: a.user.name, email: a.user.email },
      auditedAt: a.createdAt,
    }));

    const manualBoxIds = [];
    manualItemsInput.forEach((item) => {
      if (item?.boxId) {
        manualBoxIds.push(item.boxId);
      }
    });

    let manualBoxes = [];
    if (manualBoxIds.length > 0) {
      manualBoxes = await Box.find({ _id: { $in: manualBoxIds } }).select(
        "_id title code category colours price boxInnerSize"
      );
    }

    const boxById = new Map();
    manualBoxes.forEach((box) => {
      boxById.set(String(box._id), box);
    });

    const manualChallanItems = [];
    for (let i = 0; i < manualItemsInput.length; i++) {
      const manualItem = manualItemsInput[i];
      if (!manualItem) continue;
      if (!manualItem.boxId) {
        return res
          .status(400)
          .json({ message: `Manual item ${i + 1} must include a product selection` });
      }
      const idKey = manualItem.boxId ? String(manualItem.boxId) : null;
      const matchedBox = idKey && boxById.get(idKey);

      if (!matchedBox) {
        return res
          .status(400)
          .json({ message: `Manual item ${i + 1} references an unknown product code` });
      }

      const qty = Number(manualItem.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res
          .status(400)
          .json({ message: `Manual item ${i + 1} must include a valid quantity` });
      }

      const rate = Number(manualItem.rate || 0);
      const assemblyCharge = Number(manualItem.assemblyCharge || 0);
      const packagingCharge = Number(manualItem.packagingCharge || 0);
      const manualColours = (() => {
        if (Array.isArray(manualItem.colours) && manualItem.colours.length > 0) {
          const cleaned = manualItem.colours.map((c) => String(c).trim()).filter(Boolean);
          if (cleaned.length > 0) return cleaned;
        }
        if (manualItem.color) return [manualItem.color];
        if (Array.isArray(matchedBox.colours)) return matchedBox.colours;
        return [];
      })();

      manualChallanItems.push({
        audit: null,
        box: {
          _id: matchedBox._id,
          title: matchedBox.title,
          code: matchedBox.code,
          category: matchedBox.category,
          colours: Array.isArray(matchedBox.colours) ? matchedBox.colours : [],
        },
        cavity: manualItem.cavity || matchedBox.boxInnerSize || "",
        quantity: qty,
        rate,
        assemblyCharge,
        packagingCharge,
        color: manualItem.color || "",
        colours: manualColours,
        user: manualItem.user || undefined,
        auditedAt: null,
        manualEntry: true,
      });
    }

    const items = [...auditedItems, ...manualChallanItems];

    // Update inventory for ALL items (audited + manual), color-wise
    // Collect usage from both audited and manual items
    const usageByBox = new Map(); // boxId -> Map<color, qty>
    
    auditedItems.forEach((item) => {
      if (!item.color || !item.color.trim()) return;
      const boxId = String(item.box._id);
      const colorKey = item.color.trim();
      
      if (!usageByBox.has(boxId)) {
        usageByBox.set(boxId, new Map());
      }
      const colorMap = usageByBox.get(boxId);
      const prev = colorMap.get(colorKey) || 0;
      colorMap.set(colorKey, prev + Number(item.quantity || 0));
    });
    
    manualChallanItems.forEach((item) => {
      if (!item.color || !item.color.trim()) return;
      const boxId = String(item.box._id);
      const colorKey = item.color.trim();
      
      if (!usageByBox.has(boxId)) {
        usageByBox.set(boxId, new Map());
      }
      const colorMap = usageByBox.get(boxId);
      const prev = colorMap.get(colorKey) || 0;
      colorMap.set(colorKey, prev + Number(item.quantity || 0));
    });

    // Apply inventory updates
    if (usageByBox.size > 0) {
      const boxIds = Array.from(usageByBox.keys());
      const boxes = await Box.find({ _id: { $in: boxIds } });

      // First pass: validate (only for subtract/dispatch operations)
      console.log(`[inventory-update] invType: "${invType}", checking validation: ${invType === "subtract"}`);
      if (invType === "subtract") {
        console.log(`[inventory-validation] Running validation for SUBTRACT mode`);
        for (const box of boxes) {
          const boxIdStr = String(box._id);
          const colorUsage = usageByBox.get(boxIdStr);
          if (!colorUsage) continue;
          const quantityByColor = box.quantityByColor || new Map();

          for (const [colorKey, usedQty] of colorUsage.entries()) {
            const currentQty = quantityByColor.get(colorKey) || 0;
            if (currentQty < usedQty) {
              console.log(`[validation-failed] Box: ${box.code}, Color: ${colorKey}, Available: ${currentQty}, Required: ${usedQty}`);
              return res.status(400).json({
                message: `Insufficient stock for box "${box.code}" color "${colorKey}". Available: ${currentQty}, Required: ${usedQty}`,
              });
            }
          }
        }
      } else {
        console.log(`[inventory-update] Skipping validation for ADD mode`);
      }

      // Second pass: apply updates (add or subtract based on inventoryType)
      for (const box of boxes) {
        const boxIdStr = String(box._id);
        const colorUsage = usageByBox.get(boxIdStr);
        if (!colorUsage) continue;
        const quantityByColor = box.quantityByColor || new Map();

        for (const [colorKey, usedQty] of colorUsage.entries()) {
          const currentQty = quantityByColor.get(colorKey) || 0;
          if (invType === "add") {
            quantityByColor.set(colorKey, currentQty + usedQty);
          } else {
            // subtract/dispatch
            quantityByColor.set(colorKey, currentQty - usedQty);
          }
        }
        box.quantityByColor = quantityByColor;
        await box.save();
      }
    }

    const normalizedClientDetails = {
      name: clientDetails?.name?.trim() || "",
      address: clientDetails?.address?.trim() || "",
      mobile: clientDetails?.mobile?.trim() || "",
      gstNumber: clientDetails?.gstNumber?.trim() || "",
    };
    const hasClientDetails = Object.values(normalizedClientDetails).some((val) => Boolean(val));

    // For GST challans, includeGST is always true; for NON-GST, it's always false
    const shouldIncludeGST = taxType === "GST";

    const challanPayload = {
      number: challanNumber,
      challan_seq: challanSeq, // Sequence within FY
      challan_fy: challanFY, // Financial Year
      challan_tax_type: taxType,
      items,
      notes: typeof terms === "string" ? terms : notes || "",
      includeGST: shouldIncludeGST,
      createdBy: req.user._id,
      inventoryType: invType,
      hsnCode: "481920", // Fixed HSN Code for Paper Products
    };

    // HSN Code is now fixed to 481920 and handled in PDF generator
    // No longer accepting user input for HSN Code

    if (hasClientDetails) {
      challanPayload.clientDetails = normalizedClientDetails;
    }

    const challan = await Challan.create(challanPayload);

    // Mark audits as used and link to challan
    if (auditIdsArray.length > 0) {
      await BoxAudit.updateMany(
        { _id: { $in: auditIdsArray } },
        { $set: { used: true, challan: challan._id } }
      );
    }

    res.status(201).json(challan);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: list challans AND stock receipts (all documents)
export const listChallans = async (req, res) => {
  try {
    const documents = await Challan.find({})
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(documents);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: get challan details
export const getChallanById = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id).populate("createdBy", "name email");
    if (!challan) return res.status(404).json({ message: "Challan not found" });
    res.status(200).json(challan);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: download challan as PDF or stock receipt based on inventoryType
export const downloadChallanPdf = async (req, res) => {
  try {
    const document = await Challan.findById(req.params.id).populate("createdBy", "name email");
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Determine if this is a stock receipt (inbound/add) or outward challan (outbound/dispatch)
    const isStockReceipt = document.inventoryType === "add";

    const itemsForPdf = (document.items || []).map((item) => ({
      item: item.item || item.box?.title || "",
      cavity: item.cavity || "",
      code: item.code || item.box?.code || "",
      color: item.color || "",
      colours:
        item.colours && item.colours.length
          ? item.colours
          : item.color
          ? [item.color]
          : item.box?.colours || [],
      quantity: item.quantity || 0,
      rate: item.rate || 0,
      assemblyCharge: item.assemblyCharge || 0,
      packagingCharge: item.packagingCharge || 0,
    }));

    const commonData = {
      number: document.number,
      items: itemsForPdf,
      createdBy: document.createdBy
        ? { name: document.createdBy.name || document.createdBy.email || "" }
        : {},
      clientDetails: document.clientDetails || {},
    };

    let pdfPath;

    if (isStockReceipt) {
      // Generate stock receipt PDF for inbound (add) operations
      const stockReceiptData = {
        ...commonData,
        taxType: document.challan_tax_type || "GST", // Pass tax type to PDF generator
      };
      pdfPath = await generateStockReceiptPdf(stockReceiptData);
    } else {
      // Generate challan PDF for outbound (dispatch/subtract) operations
      const challanData = {
        ...commonData,
        terms: document.notes,
        hsnCode: document.hsnCode || "",
        taxType: document.challan_tax_type || "GST", // Pass tax type to PDF generator
      };
      const includeGST = document.includeGST !== false;
      pdfPath = await generateChallanPdf(challanData, includeGST, document.challan_tax_type);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${document.number}.pdf"`);

    return res.download(pdfPath, (err) => {
      if (err) {
        console.error("Error sending PDF:", err);
      }
      fsPromises
        .unlink(pdfPath)
        .catch((unlinkErr) => console.error("Error deleting temp pdf:", unlinkErr));
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Search for existing clients by name, mobile, or address
export const searchClients = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(200).json([]);
    }

    const searchTerm = query.trim();
    const regex = new RegExp(searchTerm, "i"); // case-insensitive

    // Find unique clients from past challans matching search term
    const clients = await Challan.aggregate([
      {
        $match: {
          $or: [
            { "clientDetails.name": regex },
            { "clientDetails.mobile": regex },
            { "clientDetails.address": regex },
          ],
        },
      },
      {
        $group: {
          _id: {
            name: "$clientDetails.name",
            mobile: "$clientDetails.mobile",
            address: "$clientDetails.address",
            gstNumber: "$clientDetails.gstNumber",
          },
          count: { $sum: 1 },
          lastUsed: { $max: "$updatedAt" },
        },
      },
      {
        $sort: { lastUsed: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          _id: 0,
          name: "$_id.name",
          mobile: "$_id.mobile",
          address: "$_id.address",
          gstNumber: "$_id.gstNumber",
          usageCount: "$count",
          lastUsed: 1,
        },
      },
    ]);

    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create Stock Inward Receipt for ADD mode (stored in Challan model with doc_type = "STOCK_INWARD_RECEIPT")
async function createStockInwardReceipt(req, res, auditIdsArray, manualItemsInput, clientDetails, taxType = "GST") {
  try {
    if (auditIdsArray.length === 0 && manualItemsInput.length === 0) {
      return res
        .status(400)
        .json({ message: "Provide at least one audited item or add manual rows" });
    }

    // Fetch audits
    let audits = [];
    if (auditIdsArray.length > 0) {
      audits = await BoxAudit.find({ _id: { $in: auditIdsArray }, used: false })
        .populate("user", "name email")
        .populate("box", "title code category colours price");

      if (audits.length !== auditIdsArray.length) {
        return res.status(400).json({ message: "Some audits are invalid or already used" });
      }
    }

    const receiptDetails = await generateStockReceiptNumberHelper(new Date());
    const { number: receiptNumber, fy: receiptFY, seq: receiptSeq } = receiptDetails;
    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    const lineItemMap = new Map();
    lineItems.forEach((item) => {
      if (item && item.auditId) {
        lineItemMap.set(String(item.auditId), item);
      }
    });

    const auditedItems = audits.map((a) => ({
      audit: a._id,
      box: {
        _id: a.box._id,
        title: a.box.title,
        code: a.box.code,
        category: a.box.category,
        colours: Array.isArray(a.box.colours) ? a.box.colours : [],
      },
      cavity: lineItemMap.get(String(a._id))?.cavity || "",
      quantity: (() => {
        const val = Number(lineItemMap.get(String(a._id))?.quantity ?? a.quantity);
        return Number.isFinite(val) && val > 0 ? val : a.quantity;
      })(),
      color: lineItemMap.get(String(a._id))?.color || a.color || "",
      colours: (() => {
        const lineColours = lineItemMap.get(String(a._id))?.colours;
        if (Array.isArray(lineColours) && lineColours.length > 0) return lineColours;
        const auditColor = lineItemMap.get(String(a._id))?.color || a.color;
        if (auditColor) return [auditColor];
        if (Array.isArray(a.box.colours)) return a.box.colours;
        return [];
      })(),
      user: { _id: a.user._id, name: a.user.name, email: a.user.email },
      auditedAt: a.createdAt,
    }));

    const manualBoxIds = [];
    manualItemsInput.forEach((item) => {
      if (item?.boxId) {
        manualBoxIds.push(item.boxId);
      }
    });

    let manualBoxes = [];
    if (manualBoxIds.length > 0) {
      manualBoxes = await Box.find({ _id: { $in: manualBoxIds } }).select(
        "_id title code category colours price boxInnerSize"
      );
    }

    const boxById = new Map();
    manualBoxes.forEach((box) => {
      boxById.set(String(box._id), box);
    });

    const manualReceiptItems = [];
    for (let i = 0; i < manualItemsInput.length; i++) {
      const manualItem = manualItemsInput[i];
      if (!manualItem) continue;
      if (!manualItem.boxId) {
        return res
          .status(400)
          .json({ message: `Manual item ${i + 1} must include a product selection` });
      }

      const idKey = String(manualItem.boxId);
      const matchedBox = boxById.get(idKey);

      if (!matchedBox) {
        return res
          .status(400)
          .json({ message: `Manual item ${i + 1} references an unknown product` });
      }

      const qty = Number(manualItem.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res
          .status(400)
          .json({ message: `Manual item ${i + 1} must include a valid quantity` });
      }

      const manualColours = (() => {
        if (Array.isArray(manualItem.colours) && manualItem.colours.length > 0) {
          const cleaned = manualItem.colours.map((c) => String(c).trim()).filter(Boolean);
          if (cleaned.length > 0) return cleaned;
        }
        if (manualItem.color) return [manualItem.color];
        if (Array.isArray(matchedBox.colours)) return matchedBox.colours;
        return [];
      })();

      manualReceiptItems.push({
        audit: null,
        box: {
          _id: matchedBox._id,
          title: matchedBox.title,
          code: matchedBox.code,
          category: matchedBox.category,
          colours: Array.isArray(matchedBox.colours) ? matchedBox.colours : [],
        },
        cavity: manualItem.cavity || matchedBox.boxInnerSize || "",
        quantity: qty,
        color: manualItem.color || "",
        colours: manualColours,
        user: manualItem.user || undefined,
        auditedAt: null,
        manualEntry: true,
      });
    }

    const items = [...auditedItems, ...manualReceiptItems];

    // Update inventory - ADD mode always succeeds (no validation)
    const usageByBox = new Map();

    auditedItems.forEach((item) => {
      if (!item.color || !item.color.trim()) return;
      const boxId = String(item.box._id);
      const colorKey = item.color.trim();

      if (!usageByBox.has(boxId)) {
        usageByBox.set(boxId, new Map());
      }
      const colorMap = usageByBox.get(boxId);
      const prev = colorMap.get(colorKey) || 0;
      colorMap.set(colorKey, prev + Number(item.quantity || 0));
    });

    manualReceiptItems.forEach((item) => {
      if (!item.color || !item.color.trim()) return;
      const boxId = String(item.box._id);
      const colorKey = item.color.trim();

      if (!usageByBox.has(boxId)) {
        usageByBox.set(boxId, new Map());
      }
      const colorMap = usageByBox.get(boxId);
      const prev = colorMap.get(colorKey) || 0;
      colorMap.set(colorKey, prev + Number(item.quantity || 0));
    });

    // Apply inventory additions (ADD mode)
    if (usageByBox.size > 0) {
      const boxIds = Array.from(usageByBox.keys());
      const boxes = await Box.find({ _id: { $in: boxIds } });

      for (const box of boxes) {
        const boxIdStr = String(box._id);
        const colorUsage = usageByBox.get(boxIdStr);
        if (!colorUsage) continue;
        const quantityByColor = box.quantityByColor || new Map();

        for (const [colorKey, usedQty] of colorUsage.entries()) {
          const currentQty = quantityByColor.get(colorKey) || 0;
          quantityByColor.set(colorKey, currentQty + usedQty);
        }
        box.quantityByColor = quantityByColor;
        await box.save();
      }
    }

    const normalizedClientDetails = {
      name: clientDetails?.name?.trim() || "",
      address: clientDetails?.address?.trim() || "",
      mobile: clientDetails?.mobile?.trim() || "",
      gstNumber: clientDetails?.gstNumber?.trim() || "",
    };
    const hasClientDetails = Object.values(normalizedClientDetails).some((val) => Boolean(val));

    // Stock receipts always use tax type (GST or NON-GST based on parameter)
    const shouldIncludeGST = taxType === "GST";

    const receiptPayload = {
      number: receiptNumber,
      challan_seq: receiptSeq, // Sequence within FY
      challan_fy: receiptFY, // Financial Year
      challan_tax_type: taxType,
      doc_type: "STOCK_INWARD_RECEIPT",
      items,
      createdBy: req.user._id,
      inventoryType: "add",
      includeGST: shouldIncludeGST,
    };

    if (hasClientDetails) {
      receiptPayload.clientDetails = normalizedClientDetails;
    }

    const receipt = await Challan.create(receiptPayload);

    // Mark audits as used and link to receipt (for tracking)
    if (auditIdsArray.length > 0) {
      await BoxAudit.updateMany(
        { _id: { $in: auditIdsArray } },
        { 
          $set: { 
            used: true,
            doc_type: "STOCK_INWARD_RECEIPT",
          } 
        }
      );
    }

    res.status(201).json(receipt);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}


