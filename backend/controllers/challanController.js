import BoxAudit from "../models/boxAuditModel.js";
import Box from "../models/boxModel.js";
import Challan from "../models/challanModel.js";
import ChallanCounter from "../models/challanCounterModel.js";
import { generateChallanPdf } from "../utils/pdfRenderer.js";
import { generateChallanPdfBuffer } from "../utils/pdfGeneratorBuffer.js";
import { generateStockReceiptPdf } from "../utils/stockReceiptPdfGenerator.js";
import { 
  getFinancialYear, 
  generateGSTChallanNumber, 
  generateNonGSTChallanNumber,
  formatChallanSequence 
} from "../utils/financialYearUtils.js";
import { normalizeColor, normalizeQuantityMap } from "../utils/colorNormalization.js";
import fsPromises from "fs/promises";

/**
 * Wrapper to generate GST challan number with FY-based numbering
 * Format: VPP/26-27/0001
 * 
 * @param {Date} challanDate - Date of challan (used to determine year)
 * @returns {Promise<{number: string, fy: string, seq: number}>} Challan details
 */
async function getGSTChallanDetails(challanDate) {
  const fy = getFinancialYear(challanDate);
  const seq = await ChallanCounter.getNextSequence(fy, "gst");
  const number = generateGSTChallanNumber(fy, seq);
  
  return { number, fy, seq };
}

/**
 * Wrapper to generate Non-GST challan number with FY-based numbering
 * Format: VPP-NG/26-27/0002
 * 
 * @param {Date} challanDate - Date of challan (used to determine year)
 * @returns {Promise<{number: string, fy: string, seq: number}>} Challan details
 */
async function getNonGSTChallanDetails(challanDate) {
  const fy = getFinancialYear(challanDate);
  const seq = await ChallanCounter.getNextSequence(fy, "nongst");
  const number = generateNonGSTChallanNumber(fy, seq);
  
  return { number, fy, seq };
}

// Admin: list audits available to generate a challan (unused audits)
export const getChallanCandidates = async (req, res) => {
  try {
    // Default to only dispatch/subtract events unless explicitly requested
    const onlyDispatch = req.query.onlyDispatch !== "false";
    
    let query = { used: false };
    
    if (onlyDispatch) {
      // Only show dispatch/subtract events - exclude all additions and system actions
      query.action = { $in: ["subtract", "dispatch"] };
      query.quantity = { $gt: 0 }; // Exclude zero or negative quantities
    }
    
    const audits = await BoxAudit.find(query)
      .populate("user", "name email")
      .populate("box", "title code category colours boxInnerSize price")
      .sort({ createdAt: -1 });
    res.status(200).json(audits);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
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
    const { auditIds, notes, terms, note, clientDetails, manualItems, hsnCode, inventory_mode, challanTaxType, payment_mode, remarks, packaging_charges_overall } = req.body;
    const auditIdsArray = Array.isArray(auditIds) ? auditIds.filter(Boolean) : [];
    const manualItemsInput = Array.isArray(manualItems) ? manualItems.filter(Boolean) : [];
    
    // Normalize tax type: default to GST, accept GST or NON_GST
    const taxType = (String(challanTaxType).toUpperCase().trim() === "NON_GST" || String(challanTaxType).toUpperCase().trim() === "NONGST") ? "NON_GST" : "GST";
    console.log(`[createChallan] challanTaxType received: "${challanTaxType}", normalized to: "${taxType}"`);
    
    // Normalize and validate inventory mode: dispatch, inward, record_only
    const invMode = (() => {
      const input = String(inventory_mode).toLowerCase().trim();
      if (input === "dispatch") return "dispatch";
      if (input === "inward") return "inward";
      if (input === "record_only") return "record_only";
      // Default to record_only for safety
      console.log(`[createChallan] Unknown inventory_mode "${inventory_mode}", defaulting to record_only`);
      return "record_only";
    })();
    console.log(`[createChallan] inventory_mode received: "${inventory_mode}", normalized to: "${invMode}"`);

    // Reject INWARD mode - it should only be used via dedicated inventory add feature
    if (invMode === "inward") {
      return res.status(400).json({ 
        message: "Stock inward is not allowed from challan screen. Use Inventory Add feature." 
      });
    }

    if (auditIdsArray.length === 0 && manualItemsInput.length === 0) {
      return res
        .status(400)
        .json({ message: "Provide at least one audited item or add manual challan rows" });
    }

    // Fetch and prepare audited items
    let audits = [];
    if (auditIdsArray.length > 0) {
      audits = await BoxAudit.find({ _id: { $in: auditIdsArray }, used: false })
        .populate("user", "name email")
        .populate("box", "title code category colours price");

      if (audits.length !== auditIdsArray.length) {
        return res.status(400).json({ message: "Some audits are invalid or already used" });
      }
    }

    // Generate challan number
    const challanDetails = taxType === "GST"
      ? await getGSTChallanDetails(new Date())
      : await getNonGSTChallanDetails(new Date());
    
    const { number: challanNumber, fy: challanFY, seq: challanSeq } = challanDetails;
    
    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    const lineItemMap = new Map();
    lineItems.forEach((item) => {
      if (item && item.auditId) {
        lineItemMap.set(String(item.auditId), item);
      }
    });
    
    // DISPATCH MODE: Validate inventory BEFORE any modifications
    if (invMode === "dispatch" && audits.length > 0) {
      console.log(`[createChallan] DISPATCH mode: validating inventory`);
      const auditUsageByBox = new Map(); // boxId -> Map<normalizedColor, qty>
      
      audits.forEach((a) => {
        const lineItemOverride = lineItemMap.get(String(a._id));
        const qty = Number(lineItemOverride?.quantity ?? a.quantity);
        const rawColor = lineItemOverride?.color || a.color || "";
        const normalizedColor = normalizeColor(rawColor);
        const boxId = String(a.box._id);
        
        if (normalizedColor && qty > 0) {
          if (!auditUsageByBox.has(boxId)) {
            auditUsageByBox.set(boxId, new Map());
          }
          const colorMap = auditUsageByBox.get(boxId);
          const prev = colorMap.get(normalizedColor) || 0;
          colorMap.set(normalizedColor, prev + qty);
        }
      });
      
      // Fetch boxes and validate availability
      if (auditUsageByBox.size > 0) {
        const boxIds = Array.from(auditUsageByBox.keys());
        const boxes = await Box.find({ _id: { $in: boxIds } });
        
        for (const box of boxes) {
          const boxIdStr = String(box._id);
          const colorUsage = auditUsageByBox.get(boxIdStr);
          if (!colorUsage) continue;
          
          // Normalize the box's quantity map
          const normalizedQuantityMap = normalizeQuantityMap(box.quantityByColor);
          
          for (const [normalizedColor, requestedQty] of colorUsage.entries()) {
            const availableQty = Number(normalizedQuantityMap.get(normalizedColor) || 0);
            const reqQty = Number(requestedQty || 0);
            
            console.log(`[inventory-check] Box: ${box.code}, Color: ${normalizedColor}, Available: ${availableQty}, Requested: ${reqQty}`);
            
            if (availableQty < reqQty) {
              console.log(`[validation-FAILED] Box: ${box.code}, Color: ${normalizedColor}, Available: ${availableQty}, Required: ${reqQty}`);
              return res.status(400).json({
                message: `Insufficient stock for box "${box.code}" color "${normalizedColor}". Available: ${availableQty}, Required: ${reqQty}`,
              });
            }
          }
        }
      }
    }
    
    // Build audited items
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

    // Build manual items
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
      
      // Handle colorLines (color-wise quantities)
      const colorLines = Array.isArray(manualItem.colorLines)
        ? manualItem.colorLines
            .filter(line => line.color && line.quantity > 0)
            .map(line => ({
              color: String(line.color).trim(),
              quantity: Number(line.quantity)
            }))
        : [];
      
      // Validate color lines for dispatch mode
      if (invMode === "dispatch" && colorLines.length > 0) {
        const normalizedQuantityMap = normalizeQuantityMap(matchedBox.quantityByColor);
        for (const line of colorLines) {
          const normalizedColor = normalizeColor(line.color);
          const available = Number(normalizedQuantityMap.get(normalizedColor) || 0);
          const required = Number(line.quantity);
          
          if (available < required) {
            return res.status(400).json({
              message: `Manual item ${i + 1}: Insufficient stock for color "${line.color}". Available: ${available}, Required: ${required}`
            });
          }
        }
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
        colorLines,
        user: manualItem.user || undefined,
        auditedAt: null,
        manualEntry: true,
      });
    }

    const items = [...auditedItems, ...manualChallanItems];

    // INVENTORY UPDATES: Only for DISPATCH mode
    // RECORD_ONLY mode: skip entirely
    if (invMode === "dispatch") {
      console.log(`[inventory-update] DISPATCH mode: applying inventory updates`);
      
      const usageByBox = new Map(); // boxId -> Map<normalizedColor, qty>
      
      // Collect usage from all items (normalized colors)
      items.forEach((item) => {
        const boxId = String(item.box._id);
        
        // If item has colorLines, use those; otherwise fall back to single color
        if (Array.isArray(item.colorLines) && item.colorLines.length > 0) {
          item.colorLines.forEach((line) => {
            const normalizedColor = normalizeColor(line.color);
            if (!normalizedColor) return;
            
            const qty = Number(line.quantity || 0);
            if (!usageByBox.has(boxId)) {
              usageByBox.set(boxId, new Map());
            }
            const colorMap = usageByBox.get(boxId);
            const prev = colorMap.get(normalizedColor) || 0;
            colorMap.set(normalizedColor, prev + qty);
          });
        } else {
          // Fallback to single color field
          const rawColor = item.color || "";
          const normalizedColor = normalizeColor(rawColor);
          if (!normalizedColor) return;
          
          const qty = Number(item.quantity || 0);
          if (!usageByBox.has(boxId)) {
            usageByBox.set(boxId, new Map());
          }
          const colorMap = usageByBox.get(boxId);
          const prev = colorMap.get(normalizedColor) || 0;
          colorMap.set(normalizedColor, prev + qty);
        }
      });

      // Apply updates to database
      if (usageByBox.size > 0) {
        const boxIds = Array.from(usageByBox.keys());
        const boxes = await Box.find({ _id: { $in: boxIds } });

        for (const box of boxes) {
          const boxIdStr = String(box._id);
          const colorUsage = usageByBox.get(boxIdStr);
          if (!colorUsage) continue;
          
          // Normalize existing inventory
          const normalizedQuantityMap = normalizeQuantityMap(box.quantityByColor);

          for (const [normalizedColor, changeQty] of colorUsage.entries()) {
            const currentQty = Number(normalizedQuantityMap.get(normalizedColor) || 0);
            const changeAmount = Number(changeQty || 0);
            
            // Subtract from inventory
            normalizedQuantityMap.set(normalizedColor, Math.max(0, currentQty - changeAmount));
            console.log(`[inventory-subtract] Box: ${box.code}, Color: ${normalizedColor}, Before: ${currentQty}, After: ${Math.max(0, currentQty - changeAmount)}`);
          }

          // Update box with new normalized map
          box.quantityByColor = normalizedQuantityMap;
          await box.save();
          
          // Create audit logs for each color dispatch
          if (invMode === "dispatch") {
            for (const [normalizedColor, changeQty] of colorUsage.entries()) {
              try {
                await BoxAudit.create({
                  box: box._id,
                  user: req.user._id,
                  quantity: -changeQty,
                  color: normalizedColor,
                  note: `Dispatch via challan: ${challanNumber}`,
                  action: 'subtract',
                  challan: null, // Will be updated after challan creation
                });
              } catch (auditError) {
                console.error('Audit log error for color dispatch:', auditError);
              }
            }
          }
        }
      }
    } else {
      console.log(`[inventory-update] Mode: ${invMode}: skipping all inventory updates`);
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

    // Helper: round to 2 decimals (monetary values)
    const round2 = (val) => Math.round(val * 100) / 100;

    // Calculate totals server-side (do NOT trust frontend math)
    const itemsTotal = items.reduce((sum, item) => {
      const rate = Number(item.rate || 0);
      const assembly = Number(item.assemblyCharge || 0);
      const qty = Number(item.quantity || 0);
      return sum + (rate + assembly) * qty;
    }, 0);

    const packagingCharges = Number(packaging_charges_overall) || 0;
    const preDiscountSubtotal = round2(itemsTotal + packagingCharges);

    const discountPct = Number(req.body.discount_pct) || 0;
    const discountAmount = round2(preDiscountSubtotal * Math.min(Math.max(discountPct, 0), 100) / 100);
    const taxableSubtotal = round2(preDiscountSubtotal - discountAmount);

    const gstAmount = round2(taxableSubtotal * 0.05);
    const totalBeforeRound = round2(taxableSubtotal + gstAmount);
    const grandTotal = Math.round(totalBeforeRound);

    const challanPayload = {
      number: challanNumber,
      challan_seq: challanSeq,
      challan_fy: challanFY,
      challan_tax_type: taxType,
      items,
      notes: typeof terms === "string" ? terms : notes || "",
      includeGST: shouldIncludeGST,
      createdBy: req.user._id,
      inventory_mode: invMode,
      hsnCode: hsnCode || "481920",
      packaging_charges_overall: packagingCharges,
      discount_pct: discountPct,
      discount_amount: discountAmount,
      taxable_subtotal: taxableSubtotal,
      gst_amount: gstAmount,
      grand_total: grandTotal,
    };

    if (payment_mode && String(payment_mode).trim()) {
      challanPayload.payment_mode = String(payment_mode).trim();
    }

    if (remarks && String(remarks).trim()) {
      challanPayload.remarks = String(remarks).trim();
    }

    if (hasClientDetails) {
      challanPayload.clientDetails = normalizedClientDetails;
    }

    const challan = await Challan.create(challanPayload);

    // Mark audits as used
    if (auditIdsArray.length > 0) {
      await BoxAudit.updateMany(
        { _id: { $in: auditIdsArray } },
        { $set: { used: true, challan: challan._id } }
      );
    }

    // Log audit event
    try {
      const challanType = taxType === "GST" ? "GST Challan" : "Non-GST Challan";
      const modeLabel = invMode === "dispatch" ? "Dispatch" : "Record";
      await BoxAudit.create({
        challan: challan._id,
        user: req.user._id,
        note: `${challanType} created (${modeLabel}): ${challan.number}`,
        action: 'create_challan',
      });
    } catch (auditError) {
      console.error('Audit log error for challan creation:', auditError);
    }

    res.status(201).json(challan);
  } catch (error) {
    console.error("[createChallan] Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: list challans AND stock receipts (all documents)
// Returns documents with mapped fields for frontend compatibility
export const listChallans = async (req, res) => {
  try {
    const documents = await Challan.find({})
      .populate("createdBy", "name email")
      .lean()
      .sort({ createdAt: -1 });

    // Map response fields to match frontend expectations
    const mapped = documents.map((doc) => {
      const taxable = Number(doc.taxable_subtotal) || 0;
      const gst = Number(doc.gst_amount) || 0;
      const total = Number(doc.grand_total) || 0;
      
      return {
        ...doc,
        // Add mapped fields for frontend compatibility
        challanNumber: doc.number || 'N/A',
        number: doc.number || 'N/A',
        // Ensure numeric fields are always numbers, never null/undefined
        taxableAmount: taxable,
        taxable_subtotal: taxable,
        gstAmount: gst,
        gst_amount: gst,
        totalAmount: total,
        grand_total: total,
        clientName: doc.clientDetails?.name || null,
        challanType: doc.challan_tax_type,
        // Keep original fields for backward compatibility
      };
    });

    res.status(200).json(mapped);
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
    console.log(`[Download] Request for document ID: ${req.params.id}`);
    
    const document = await Challan.findById(req.params.id).populate("createdBy", "name email");
    
    if (!document) {
      console.log(`[Download] Document not found for ID: ${req.params.id}`);
      return res.status(404).json({ message: "Document not found" });
    }

    console.log(`[Download] Found document: ${document.number}, inventory_mode: ${document.inventory_mode}`);

    // Determine if this is a stock receipt (inbound/add) or outward challan (outbound/dispatch)
    const isStockReceipt = document.inventory_mode === "inward";

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
      colorLines: item.colorLines || [],
      quantity: item.quantity || 0,
      rate: item.rate || 0,
      assemblyCharge: item.assemblyCharge || 0,
    }));

    const commonData = {
      number: document.number,
      items: itemsForPdf,
      createdBy: document.createdBy
        ? { name: document.createdBy.name || document.createdBy.email || "" }
        : {},
      clientDetails: document.clientDetails || {},
    };

    let pdfBuffer;

    try {
      console.log(`[Download] Generating ${isStockReceipt ? "stock receipt" : "challan"} PDF...`);
      
      if (isStockReceipt) {
        // Generate stock receipt PDF for inbound (add) operations using file-based generator
        const stockReceiptData = {
          ...commonData,
          taxType: document.challan_tax_type || "GST",
        };
        const pdfPath = await generateStockReceiptPdf(stockReceiptData);
        // Read the file into a buffer and delete it
        pdfBuffer = await fsPromises.readFile(pdfPath);
        await fsPromises.unlink(pdfPath);
      } else {
        // Generate challan PDF for outbound (dispatch/subtract) operations using IN-MEMORY generator
        const challanData = {
          ...commonData,
          date: document.createdAt || new Date(),
          notes: document.notes,
          hsnCode: document.hsnCode || "",
          taxType: document.challan_tax_type || "GST",
          payment_mode: document.payment_mode || null,
          remarks: document.remarks || null,
          packaging_charges_overall: document.packaging_charges_overall || 0,
          discount_pct: document.discount_pct || 0,
          discount_amount: document.discount_amount || 0,
          taxable_subtotal: document.taxable_subtotal || 0,
          gst_amount: document.gst_amount || 0,
          grand_total: document.grand_total || 0,
        };
        const includeGST = document.includeGST !== false;
        // Use in-memory PDF generator (returns Buffer directly)
        pdfBuffer = await generateChallanPdfBuffer(challanData, includeGST);
      }
      
      console.log(`[Download] PDF generated (${pdfBuffer.length} bytes)`);
    } catch (pdfError) {
      console.error("[Download] PDF generation error:", pdfError.message);
      console.error("[Download] Error stack:", pdfError.stack);
      return res.status(500).json({ message: "Failed to generate PDF", error: pdfError.message });
    }

    if (!pdfBuffer) {
      console.error("[Download] PDF buffer is empty after generation");
      return res.status(500).json({ message: "PDF generation resulted in empty buffer" });
    }

    console.log(`[Download] Sending PDF buffer (${pdfBuffer.length} bytes)`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${document.number.replace(/\//g, "_")}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("[Download] Unexpected error:", error.message);
    console.error("[Download] Error stack:", error.stack);
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

    // Log audit event for stock inward receipt creation
    try {
      const receiptType = taxType === "GST" ? "GST Stock Inward Receipt" : "Non-GST Stock Inward Receipt";
      await BoxAudit.create({
        challan: receipt._id,
        user: req.user._id,
        note: `${receiptType} created: ${receipt.number}`,
        action: 'create_stock_receipt',
      });
    } catch (auditError) {
      console.error('Audit log error for stock receipt creation:', auditError);
      // Continue even if audit logging fails
    }

    res.status(201).json(receipt);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

// Admin: Edit challan (whitelisted fields only)
export const editChallan = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      clientName, 
      paymentMode, 
      remarks, 
      termsAndConditions, 
      hsnCode, 
      packagingTotal, 
      discountPercent,
      challanDate
    } = req.body;

    // Fetch challan
    const challan = await Challan.findById(id);
    if (!challan) {
      return res.status(404).json({ message: "Challan not found" });
    }

    // Cannot edit cancelled challans
    if (challan.status === "CANCELLED") {
      return res.status(400).json({ message: "Cannot edit cancelled challan" });
    }

    // Build update object with whitelisted fields only
    const updateData = {};
    
    if (clientName !== undefined) {
      updateData["clientDetails.name"] = String(clientName).trim();
    }
    if (paymentMode !== undefined && ["Cash", "GPay", "Bank Account", "Credit"].includes(paymentMode)) {
      updateData.payment_mode = paymentMode;
    }
    if (remarks !== undefined) {
      updateData.remarks = String(remarks).trim();
    }
    if (termsAndConditions !== undefined) {
      updateData.notes = String(termsAndConditions).trim();
    }
    if (hsnCode !== undefined) {
      updateData.hsnCode = String(hsnCode).trim();
    }
    if (packagingTotal !== undefined) {
      updateData.packaging_charges_overall = Number(packagingTotal) || 0;
    }
    if (discountPercent !== undefined) {
      updateData.discount_pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    }
    if (challanDate !== undefined) {
      updateData.createdAt = new Date(challanDate);
    }

    // Recompute totals based on items + updated packaging/discount
    const itemsSubtotal = challan.items.reduce((sum, item) => {
      const lineTotal = ((Number(item.rate) || 0) + (Number(item.assemblyCharge) || 0)) * (Number(item.quantity) || 0);
      return sum + lineTotal;
    }, 0);

    updateData.items_subtotal = itemsSubtotal;
    
    const packaging = updateData.packaging_charges_overall !== undefined ? updateData.packaging_charges_overall : challan.packaging_charges_overall;
    const discountPct = updateData.discount_pct !== undefined ? updateData.discount_pct : challan.discount_pct;
    
    const preDiscountSubtotal = itemsSubtotal + packaging;
    const discountAmount = preDiscountSubtotal * (discountPct / 100);
    const taxableAmount = preDiscountSubtotal - discountAmount;
    
    updateData.discount_amount = Math.round(discountAmount * 100) / 100;
    updateData.taxable_subtotal = Math.round(taxableAmount * 100) / 100;

    // Calculate GST if applicable
    if (challan.challan_tax_type === "GST") {
      const gstAmount = Math.round(taxableAmount * 0.05 * 100) / 100;
      updateData.gst_amount = gstAmount;
      const totalBeforeRound = taxableAmount + gstAmount;
      const roundedTotal = Math.round(totalBeforeRound);
      const roundOff = roundedTotal - totalBeforeRound;
      updateData.grand_total = roundedTotal;
    } else {
      updateData.gst_amount = 0;
      updateData.grand_total = Math.round(taxableAmount);
    }

    // Add metadata
    updateData.updatedBy = req.user._id;

    // Update challan
    const updatedChallan = await Challan.findByIdAndUpdate(id, updateData, { new: true })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    // Log audit event
    try {
      await BoxAudit.create({
        challan: challan._id,
        user: req.user._id,
        note: `Challan ${challan.number} edited by ${req.user.email}`,
        action: 'challan_edited',
      });
    } catch (auditError) {
      console.error('Audit log error for challan edit:', auditError);
    }

    res.status(200).json({
      message: "Challan updated successfully",
      challan: updatedChallan,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: Cancel challan (mark as CANCELLED, reverse inventory if dispatch)
export const cancelChallan = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "Cancellation reason is required" });
    }

    // Fetch challan
    const challan = await Challan.findById(id).populate("items.box");
    if (!challan) {
      return res.status(404).json({ message: "Challan not found" });
    }

    // Idempotency: if already cancelled, return success
    if (challan.status === "CANCELLED") {
      return res.status(200).json({
        message: "Challan already cancelled",
        challan,
      });
    }

    // Reverse inventory if this is a DISPATCH challan
    let reversalApplied = false;
    if (challan.inventory_mode === "dispatch" || challan.inventory_mode === "DISPATCH") {
      try {
        // Reverse quantities for each item
        for (const item of challan.items) {
          const boxId = item.box?._id;
          if (!boxId) continue;

          const quantity = Number(item.quantity) || 0;
          const color = String(item.color || "").trim();

          if (quantity > 0) {
            // Increment inventory back
            if (color) {
              // Update color-specific quantity
              await Box.updateOne(
                { _id: boxId },
                { 
                  $inc: { 
                    [`quantityByColor.${color}`]: quantity,
                    totalQuantity: quantity
                  }
                }
              );
            } else {
              // Update total quantity only
              await Box.updateOne(
                { _id: boxId },
                { $inc: { totalQuantity: quantity } }
              );
            }
          }
        }
        reversalApplied = true;
      } catch (reversalError) {
        console.error('Inventory reversal error:', reversalError);
        return res.status(500).json({ 
          message: "Failed to reverse inventory during cancellation",
          error: reversalError.message 
        });
      }
    }

    // Mark challan as CANCELLED
    const updateData = {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: req.user._id,
      cancelReason: String(reason).trim(),
      reversalApplied,
    };

    const cancelledChallan = await Challan.findByIdAndUpdate(id, updateData, { new: true })
      .populate("createdBy", "name email")
      .populate("cancelledBy", "name email");

    // Log audit event
    try {
      await BoxAudit.create({
        challan: challan._id,
        user: req.user._id,
        note: `Challan ${challan.number} cancelled by ${req.user.email}. Reason: ${reason}`,
        action: 'challan_cancelled',
      });
    } catch (auditError) {
      console.error('Audit log error for challan cancellation:', auditError);
    }

    res.status(200).json({
      message: "Challan cancelled successfully",
      challan: cancelledChallan,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
