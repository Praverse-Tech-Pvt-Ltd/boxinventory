import BoxAudit from "../models/boxAuditModel.js";
import Box from "../models/boxModel.js";
import Challan from "../models/challanModel.js";
import ChallanCounter from "../models/challanCounterModel.js";
import { generateChallanPdfBuffer } from "../utils/pdfGeneratorBuffer.js";
import { generateStockReceiptPdfBuffer } from "../utils/stockReceiptPdfGeneratorBuffer.js";
import { 
  getFinancialYear, 
  generateGSTChallanNumber, 
  generateNonGSTChallanNumber,
  formatChallanSequence 
} from "../utils/financialYearUtils.js";
import { normalizeColor, normalizeQuantityMap } from "../utils/colorNormalization.js";
import { calculateChallanTotals } from "../utils/calculateChallanTotals.js";
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
    const { auditIds, notes, terms, note, clientDetails, manualItems, hsnCode, inventory_mode, challanTaxType, payment_mode, remarks, packaging_charges_overall, discount_pct, challanDate } = req.body;
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
    // Use provided challanDate or default to today
    let challanDateObj = new Date();
    if (challanDate) {
      try {
        challanDateObj = new Date(challanDate);
        if (isNaN(challanDateObj.getTime())) {
          return res.status(400).json({ message: "Invalid challan date format" });
        }
      } catch (dateError) {
        console.error("[createChallan] Date parsing error:", dateError);
        return res.status(400).json({ message: "Invalid challan date" });
      }
    }
    
    const challanDetails = taxType === "GST"
      ? await getGSTChallanDetails(challanDateObj)
      : await getNonGSTChallanDetails(challanDateObj);
    
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
    const auditedItems = audits.map((a) => {
      const lineItemOverride = lineItemMap.get(String(a._id));
      // Support both bifurcated (productRate/assemblyRate) and combined (rate/assemblyCharge) formats
      const productRate = Number(lineItemOverride?.productRate || lineItemOverride?.rate || 0);
      const assemblyRate = Number(lineItemOverride?.assemblyRate || lineItemOverride?.assemblyCharge || 0);
      
      return {
        audit: a._id,
        box: {
          _id: a.box._id,
          title: a.box.title,
          code: a.box.code,
          category: a.box.category,
          colours: Array.isArray(a.box.colours) ? a.box.colours : [],
        },
        cavity: lineItemOverride?.cavity || "",
        quantity: (() => {
          const val = Number(lineItemOverride?.quantity ?? a.quantity);
          return Number.isFinite(val) && val > 0 ? val : a.quantity;
        })(),
        // NEW: Bifurcated rates (preferred)
        productRate,
        assemblyRate,
        // DEPRECATED: Keep for backward compatibility
        rate: productRate,
        assemblyCharge: assemblyRate,
        packagingCharge: Number(lineItemOverride?.packagingCharge || 0),
        color: lineItemOverride?.color || a.color || "",
        colours: (() => {
          const lineColours = lineItemOverride?.colours;
          if (Array.isArray(lineColours) && lineColours.length > 0) return lineColours;
          const auditColor = lineItemOverride?.color || a.color;
          if (auditColor) return [auditColor];
          if (Array.isArray(a.box.colours)) return a.box.colours;
          return [];
        })(),
        user: { _id: a.user._id, name: a.user.name, email: a.user.email },
        auditedAt: a.createdAt,
      };
    });

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
      
      // Support bifurcated rates (NEW)
      const productRate = Number(manualItem.productRate !== undefined ? manualItem.productRate : rate);
      const assemblyRate = Number(manualItem.assemblyRate !== undefined ? manualItem.assemblyRate : assemblyCharge);
      
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
        // NEW: Bifurcated rates
        productRate,
        assemblyRate,
        // DEPRECATED: Keep for backward compatibility
        rate: productRate,
        assemblyCharge: assemblyRate,
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

    // Log received packaging and discount values for debugging
    console.log('[createChallan] Received from frontend:', { 
      packaging_charges_overall, 
      discount_pct, 
      payment_mode 
    });

    // Calculate totals server-side (do NOT trust frontend math)
    // Use shared utility for consistency across frontend and backend
    const totals = calculateChallanTotals(items, {
      packagingChargesOverall: Number(packaging_charges_overall) || 0,
      discountPct: Number(discount_pct) || 0,
      taxType: taxType,
    });

    console.log('[createChallan] Calculated totals:', {
      packagingCharges: totals.packagingCharges,
      discountPct: totals.discountPct,
      discountAmount: totals.discountAmount,
      grandTotal: totals.grandTotal
    });

    const challanPayload = {
      number: challanNumber,
      challan_seq: challanSeq,
      challan_fy: challanFY,
      challanDate: challanDateObj, // NEW: Use provided or default challan date
      challan_tax_type: taxType,
      items,
      notes: typeof terms === "string" ? terms : notes || "",
      includeGST: shouldIncludeGST,
      createdBy: req.user._id,
      inventory_mode: invMode,
      hsnCode: hsnCode || "481920",
      items_subtotal: totals.itemsSubtotal,
      assembly_total: totals.assemblyTotal,
      packaging_charges_overall: totals.packagingCharges,
      discount_pct: totals.discountPct,
      discount_amount: totals.discountAmount,
      taxable_subtotal: totals.taxableSubtotal,
      gst_amount: totals.gstAmount,
      grand_total: totals.grandTotal,
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
    
    console.log('[createChallan] Saved to DB:', {
      number: challan.number,
      packaging_charges_overall: challan.packaging_charges_overall,
      discount_pct: challan.discount_pct,
      discount_amount: challan.discount_amount,
      grand_total: challan.grand_total
    });

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
    // Exclude archived challans by default (non-dispatch cleanup)
    // To include archived challans, pass ?includeArchived=true
    // Also exclude "inward" mode challans (stock additions are not shown in challan list)
    // Also exclude cancelled challans by default
    const includeArchived = req.query.includeArchived === 'true';
    const includeCancelled = req.query.includeCancelled === 'true';
    
    const query = {
      inventory_mode: { $ne: 'inward' }, // Exclude stock inward/addition challans
      ...(includeArchived ? {} : { $or: [{ archived: false }, { archived: { $exists: false } }] }),
      ...(includeCancelled ? {} : { $or: [{ status: { $ne: 'CANCELLED' } }, { status: { $exists: false } }] })
    };
    
    const documents = await Challan.find(query)
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
      // NEW: Bifurcated rates (prefer new format, fallback to combined)
      productRate: item.productRate || item.rate || 0,
      assemblyRate: item.assemblyRate || item.assemblyCharge || 0,
      // DEPRECATED: Keep for backward compatibility
      rate: item.productRate || item.rate || 0,
      assemblyCharge: item.assemblyRate || item.assemblyCharge || 0,
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
        // Generate stock receipt PDF for inbound (add) operations using IN-MEMORY generator (Vercel-friendly)
        const stockReceiptData = {
          ...commonData,
          taxType: document.challan_tax_type || "GST",
          createdAt: document.challanDate || document.createdAt || new Date(),
        };
        pdfBuffer = await generateStockReceiptPdfBuffer(stockReceiptData);
      } else {
        // Generate challan PDF for outbound (dispatch/subtract) operations using IN-MEMORY generator
        const challanData = {
          ...commonData,
          challanDate: document.challanDate || document.createdAt || new Date(), // NEW: Use challanDate field
          date: document.challanDate || document.createdAt || new Date(),
          notes: document.notes,
          hsnCode: document.hsnCode || "",
          taxType: document.challan_tax_type || "GST",
          payment_mode: document.payment_mode || null,
          remarks: document.remarks || null,
          packaging_charges_overall: document.packaging_charges_overall || 0,
          discount_pct: document.discount_pct || 0,
          discount_amount: document.discount_amount || 0,
          items_subtotal: document.items_subtotal || 0,
          assembly_total: document.assembly_total || 0,
          taxable_subtotal: document.taxable_subtotal || 0,
          gst_amount: document.gst_amount || 0,
          grand_total: document.grand_total || 0,
        };
        console.log('[Download] Challan data for PDF:', {
          number: challanData.number,
          packaging_charges_overall: challanData.packaging_charges_overall,
          discount_pct: challanData.discount_pct,
          discount_amount: challanData.discount_amount
        });
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
    
    // Generate unique filename with timestamp to prevent browser caching
    const timestamp = Date.now();
    const safeNumber = document.number.replace(/\//g, "_");
    const filename = `${safeNumber}_${timestamp}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    // Prevent caching to ensure fresh PDF is always generated
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

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
    console.log("[editChallan] Starting - user:", req.user?.email, "ID:", req.user?._id);
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Challan ID is required" });
    }

    const { 
      clientName, 
      paymentMode, 
      remarks, 
      termsAndConditions, 
      hsnCode, 
      packagingTotal, 
      discountPercent,
      challanDate,
      items // NEW: items array from edit modal
    } = req.body;

    console.log("[editChallan] Received body:", { clientName, paymentMode, remarks, items: items?.length || 0 });

    // Verify user is authenticated
    if (!req.user || !req.user._id) {
      console.error("[editChallan] User not authenticated:", req.user);
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Fetch challan with items
    console.log("[editChallan] Fetching challan:", id);
    const challan = await Challan.findById(id);
    if (!challan) {
      console.log("[editChallan] Challan not found:", id);
      return res.status(404).json({ message: "Challan not found" });
    }

    console.log("[editChallan] Challan found:", challan.number);

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

    // Handle challan date if provided (NEW: Use challanDate field)
    if (challanDate !== undefined && challanDate) {
      try {
        const parsedDate = new Date(challanDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: "Invalid challan date format" });
        }
        updateData.challanDate = parsedDate;
      } catch (dateError) {
        console.error("Date parsing error:", dateError);
        return res.status(400).json({ message: "Invalid challan date" });
      }
    }

    // NEW: Handle items array if provided
    let itemsForCalculation = challan.items || [];
    if (Array.isArray(items) && items.length > 0) {
      console.log("[editChallan] Processing", items.length, "items");
      try {
        // Validate items - support both bifurcated and combined rate formats
        const newItems = items.map((item) => {
          if (!item) return null;
          const productRate = Number(item.productRate !== undefined ? item.productRate : (item.rate || 0));
          const assemblyRate = Number(item.assemblyRate !== undefined ? item.assemblyRate : (item.assemblyCharge || 0));
          console.log("[editChallan] Processing item:", { box: item.box || item.boxId, qty: item.quantity, productRate, assemblyRate });
          return {
            box: {
              _id: item.box || item.boxId,
              title: item.title || item.name || "",
              code: item.code || "",
              category: item.category || "",
              colours: Array.isArray(item.colours) ? item.colours : [],
            },
            quantity: Number(item.quantity) || 0,
            // NEW: Bifurcated rates
            productRate,
            assemblyRate,
            // DEPRECATED: Keep for backward compatibility
            rate: productRate,
            assemblyCharge: assemblyRate,
            color: String(item.color || "").trim(),
            user: {
              _id: req.user._id,
              name: req.user.name || "",
              email: req.user.email || "",
            },
            manualEntry: true,
          };
        }).filter(item => item !== null);
        
        if (newItems.length === 0 && items.length > 0) {
          return res.status(400).json({ message: "Invalid items array: no valid items to process" });
        }
        
        updateData.items = newItems;
        itemsForCalculation = newItems;

        // If dispatch mode: handle inventory reversal/re-apply
        if (challan.inventory_mode === "dispatch" || challan.inventory_mode === "DISPATCH") {
          console.log("[editChallan] Dispatch mode detected, reversing old and applying new inventory");
          try {
            // Step 1: Revert old quantities back to boxes
            console.log("[editChallan] Step 1: Reverting old items");
            for (const oldItem of (challan.items || [])) {
              if (!oldItem) continue;
              const boxId = oldItem.box?._id;
              if (!boxId) {
                console.log("[editChallan] Skipping old item with no boxId");
                continue;
              }
              const qty = Number(oldItem.quantity) || 0;
              const color = String(oldItem.color || "").trim();
              if (qty > 0) {
                console.log("[editChallan] Reverting boxId: " + boxId + ", qty: " + qty + ", color: " + color);
                if (color) {
                  await Box.updateOne(
                    { _id: boxId },
                    { $inc: { [`quantityByColor.${color}`]: qty, totalQuantity: qty } }
                  );
                } else {
                  await Box.updateOne({ _id: boxId }, { $inc: { totalQuantity: qty } });
                }
              }
            }

            // Step 2: Check new quantities are available
            console.log("[editChallan] Step 2: Checking new item availability");
            for (const newItem of newItems) {
              if (!newItem) continue;
              const boxId = newItem.box?._id;
              const qty = Number(newItem.quantity) || 0;
              const color = String(newItem.color || "").trim();
              if (!boxId || qty <= 0) continue;

              console.log("[editChallan] Checking boxId: " + boxId + ", qty: " + qty);
              const box = await Box.findById(boxId);
              if (!box) {
                console.log("[editChallan] Box not found: " + boxId);
                return res.status(400).json({ message: `Product ${newItem.box?.code || 'unknown'} not found` });
              }

              const available = color 
                ? (box.quantityByColor?.[color] || 0)
                : (box.totalQuantity || 0);

              console.log("[editChallan] Box: " + box.code + ", color: " + color + ", available: " + available + ", required: " + qty);

              if (available < qty) {
                console.log("[editChallan] Insufficient stock, rolling back");
                // Rollback: revert the revert we just did
                for (const revertItem of (challan.items || [])) {
                  if (!revertItem) continue;
                  const rBoxId = revertItem.box?._id;
                  if (!rBoxId) continue;
                  const rQty = Number(revertItem.quantity) || 0;
                  const rColor = String(revertItem.color || "").trim();
                  if (rQty > 0) {
                    if (rColor) {
                      await Box.updateOne(
                        { _id: rBoxId },
                        { $inc: { [`quantityByColor.${rColor}`]: -rQty, totalQuantity: -rQty } }
                      );
                    } else {
                      await Box.updateOne({ _id: rBoxId }, { $inc: { totalQuantity: -rQty } });
                    }
                  }
                }
                return res.status(400).json({ 
                  message: `Insufficient stock for ${newItem.box?.code || 'unknown'} ${color || ""}. Available: ${available}, Required: ${qty}` 
                });
              }
            }

            // Step 3: Apply new quantities
            console.log("[editChallan] Step 3: Applying new item quantities");
            for (const newItem of newItems) {
              if (!newItem) continue;
              const boxId = newItem.box?._id;
              const qty = Number(newItem.quantity) || 0;
              const color = String(newItem.color || "").trim();
              if (qty > 0) {
                console.log("[editChallan] Applying boxId: " + boxId + ", qty: " + qty + ", color: " + color);
                if (color) {
                  await Box.updateOne(
                    { _id: boxId },
                    { $inc: { [`quantityByColor.${color}`]: -qty, totalQuantity: -qty } }
                  );
                } else {
                  await Box.updateOne({ _id: boxId }, { $inc: { totalQuantity: -qty } });
                }
              }
            }
          } catch (error) {
            console.error("Inventory update error:", error);
            return res.status(500).json({ message: "Failed to update inventory", error: error.message });
          }
        }
      } catch (itemError) {
        console.error("[editChallan] Error processing items:", itemError);
        return res.status(400).json({ message: "Invalid items array format", error: itemError.message });
      }
    }

    // Recompute totals based on items + updated packaging/discount
    // Calculate items subtotal (rate * qty) and assembly total separately
    let itemsSubtotal = 0;
    let assemblyTotal = 0;
    
    if (Array.isArray(itemsForCalculation)) {
      itemsForCalculation.forEach((item) => {
        if (!item) return; // Skip null/undefined items
        const itemQty = Number(item.quantity) || 0;
        // Support both bifurcated (productRate + assemblyRate) and combined (rate + assemblyCharge) formats
        const itemRate = Number(item.productRate !== undefined ? item.productRate : (item.rate || 0));
        const itemAssembly = Number(item.assemblyRate !== undefined ? item.assemblyRate : (item.assemblyCharge || 0));
        
        itemsSubtotal += itemRate * itemQty;
        assemblyTotal += itemAssembly * itemQty;
      });
    }

    updateData.items_subtotal = Math.round(itemsSubtotal * 100) / 100;
    updateData.assembly_total = Math.round(assemblyTotal * 100) / 100;
    
    const packaging = updateData.packaging_charges_overall !== undefined ? updateData.packaging_charges_overall : (challan.packaging_charges_overall || 0);
    const discountPct = updateData.discount_pct !== undefined ? updateData.discount_pct : (challan.discount_pct || 0);
    
    const preDiscountSubtotal = itemsSubtotal + assemblyTotal + packaging;
    const discountAmount = preDiscountSubtotal * (discountPct / 100);
    const taxableAmount = preDiscountSubtotal - discountAmount;
    
    updateData.discount_amount = Math.round(discountAmount * 100) / 100;
    updateData.taxable_subtotal = Math.round(taxableAmount * 100) / 100;

    // Calculate GST only for GST type challans (not for NON_GST)
    const taxType = updateData.challan_tax_type || challan.challan_tax_type || "GST";
    if (taxType === "GST") {
      const gstAmount = Math.round(taxableAmount * 0.05 * 100) / 100;
      updateData.gst_amount = gstAmount;
      const totalBeforeRound = taxableAmount + gstAmount;
      const roundedTotal = Math.round(totalBeforeRound);
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
    console.error("[editChallan] Error:", error);
    res.status(500).json({ 
      message: "Server error during challan update", 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Admin: Cancel challan (mark as CANCELLED, reverse inventory if dispatch)
export const cancelChallan = async (req, res) => {
  try {
    console.log("[cancelChallan] Starting - user:", req.user?.email, "authenticated:", !!req.user);
    
    const { id } = req.params;
    if (!id) {
      console.log("[cancelChallan] Missing challan ID");
      return res.status(400).json({ message: "Challan ID is required" });
    }

    const { reason } = req.body;
    console.log("[cancelChallan] Params - id:", id, ", reason:", reason, ", reason type:", typeof reason);

    if (!reason || !String(reason).trim()) {
      console.log("[cancelChallan] Missing or empty reason");
      return res.status(400).json({ message: "Cancellation reason is required" });
    }

    // Verify user is authenticated
    if (!req.user || !req.user._id) {
      console.log("[cancelChallan] User not authenticated");
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Fetch challan
    console.log("[cancelChallan] Fetching challan:", id);
    const challan = await Challan.findById(id);
    if (!challan) {
      console.log("[cancelChallan] Challan not found");
      return res.status(404).json({ message: "Challan not found" });
    }
    console.log("[cancelChallan] Challan found:", challan.number);

    // Idempotency: if already cancelled, return 400 as requested
    if (challan.status === "CANCELLED") {
      console.log("[cancelChallan] Challan already cancelled:", challan.number);
      return res.status(400).json({
        message: "Already cancelled"
      });
    }

    // Reverse inventory if this is a DISPATCH challan
    let reversalApplied = false;
    console.log("[cancelChallan] Inventory mode:", challan.inventory_mode);
    
    if (challan.inventory_mode === "dispatch" || challan.inventory_mode === "DISPATCH") {
      try {
        const itemsToReverse = Array.isArray(challan.items) ? challan.items : [];
        console.log("[cancelChallan] Starting inventory reversal for", itemsToReverse.length, 'items');
        
        // Reverse quantities for each item
        for (const item of itemsToReverse) {
          if (!item) continue; // Skip null/undefined items
          
          const boxId = item.box?._id;
          if (!boxId) {
            console.log("[cancelChallan] Skipping item with no boxId");
            continue;
          }

          const quantity = Number(item.quantity) || 0;
          const color = String(item.color || "").trim();

          console.log("[cancelChallan] Reversing - boxId: " + boxId + ", qty: " + quantity + ", color: " + color);

          if (quantity > 0) {
            // Increment inventory back
            try {
              if (color) {
                // Update color-specific quantity
                const updateResult = await Box.updateOne(
                  { _id: boxId },
                  { 
                    $inc: { 
                      [`quantityByColor.${color}`]: quantity,
                      totalQuantity: quantity
                    }
                  }
                );
                console.log("[cancelChallan] Color update result: " + updateResult.modifiedCount);
              } else {
                // Update total quantity only
                const updateResult = await Box.updateOne(
                  { _id: boxId },
                  { $inc: { totalQuantity: quantity } }
                );
                console.log("[cancelChallan] Total quantity update result: " + updateResult.modifiedCount);
              }
            } catch (itemError) {
              console.error("[cancelChallan] Error updating item:", itemError);
              throw itemError;
            }
          }
        }
        console.log("[cancelChallan] Inventory reversal completed");
        reversalApplied = true;
      } catch (reversalError) {
        console.error('[cancelChallan] Inventory reversal error:', reversalError);
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

    console.log("[cancelChallan] Updating challan with data:", updateData);

    let cancelledChallan;
    try {
      cancelledChallan = await Challan.findByIdAndUpdate(id, updateData, { new: true })
        .populate("createdBy", "name email")
        .populate("cancelledBy", "name email");
      console.log("[cancelChallan] Update successful, challan status: " + (cancelledChallan?.status || 'unknown'));
    } catch (updateError) {
      console.error("[cancelChallan] Error during update/populate:", updateError.message);
      return res.status(500).json({ 
        message: "Failed to cancel challan", 
        error: updateError.message 
      });
    }

    // Log audit event (non-blocking)
    try {
      console.log("[cancelChallan] Creating audit log");
      await BoxAudit.create({
        challan: challan._id,
        user: req.user._id,
        note: `Challan ${challan.number} cancelled by ${req.user.email}. Reason: ${reason}`,
        action: 'challan_cancelled',
      });
      console.log("[cancelChallan] Audit log created");
    } catch (auditError) {
      console.error('[cancelChallan] Audit log error (non-blocking):', auditError);
      // Don't return error - audit logging is non-blocking
    }

    console.log("[cancelChallan] Sending success response");
    res.status(200).json({
      message: "Challan cancelled successfully",
      challan: cancelledChallan,
    });
  } catch (error) {
    console.error("[cancelChallan] MAIN ERROR:", error.name, "-", error.message);
    console.error("[cancelChallan] Stack:", error.stack);
    res.status(500).json({ 
      message: "Server error during challan cancellation", 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Admin: Archive non-dispatch challans (cleanup ADD mode challans)
 * Archives challans with inventory_mode != "dispatch" (inward, record_only, ADD mode)
 * Does NOT delete them, just adds archived: true flag
 * Returns count of archived challans
 */
export const archiveNonDispatchChallans = async (req, res) => {
  try {
    console.log("[archiveNonDispatch] Starting cleanup of non-dispatch challans");
    
    // Find all challans that are NOT in dispatch mode
    const nonDispatchChallans = await Challan.find({
      inventory_mode: { $ne: "dispatch" }
    });
    
    console.log(`[archiveNonDispatch] Found ${nonDispatchChallans.length} non-dispatch challans to archive`);
    
    if (nonDispatchChallans.length === 0) {
      return res.status(200).json({
        message: "No non-dispatch challans found to archive",
        archivedCount: 0,
      });
    }
    
    // Mark them as archived
    const result = await Challan.updateMany(
      { inventory_mode: { $ne: "dispatch" } },
      { 
        $set: { 
          archived: true,
          archivedAt: new Date(),
          archivedBy: req.user._id
        }
      }
    );
    
    console.log(`[archiveNonDispatch] Archived ${result.modifiedCount} challans`);
    
    res.status(200).json({
      message: `Successfully archived ${result.modifiedCount} non-dispatch challans`,
      archivedCount: result.modifiedCount,
      details: `Archived challans with inventory_mode in [inward, record_only, ADD]`
    });
  } catch (error) {
    console.error("[archiveNonDispatch] Error:", error.message);
    res.status(500).json({ 
      message: "Server error during archive operation", 
      error: error.message 
    });
  }
};

/**
 * Get recent challans (dispatch-only, non-cancelled)
 * Used for "Recent Challans" dashboard widget
 * Returns last 10 dispatch challans
 */
export const getRecentChallans = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 10, 10);
    
    const challans = await Challan.find({
      inventory_mode: 'dispatch',
      $or: [{ status: { $ne: 'CANCELLED' } }, { status: { $exists: false } }],
      archived: { $in: [false, null] },
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);

    const mapped = challans.map((c) => ({
      _id: c._id,
      number: c.number,
      challanDate: c.challanDate || c.createdAt,
      clientName: c.clientDetails?.name || 'Unnamed',
      totalAmount: c.grand_total || 0,
      itemCount: (c.items || []).length,
      status: c.status || 'ACTIVE',
    }));

    res.status(200).json(mapped);
  } catch (error) {
    console.error('[getRecentChallans] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get client-wise summary
 * Aggregates dispatch challans by client (dispatch-only, non-cancelled)
 * Shows total sales and challan count per client
 */
export const getClientWiseSummary = async (req, res) => {
  try {
    const summary = await Challan.aggregate([
      {
        $match: {
          inventory_mode: 'dispatch',
          status: { $ne: 'CANCELLED' },
          archived: { $in: [false, null] },
        },
      },
      {
        $group: {
          _id: '$clientDetails.name',
          totalSales: { $sum: '$grand_total' },
          challanCount: { $sum: 1 },
          lastChallanDate: { $max: '$challanDate' },
          totalItems: { $sum: { $size: { $ifNull: ['$items', []] } } },
        },
      },
      {
        $sort: { totalSales: -1 },
      },
    ]);

    const mapped = summary.map((row) => ({
      clientName: row._id || 'Unnamed',
      totalSales: row.totalSales || 0,
      challanCount: row.challanCount || 0,
      totalItems: row.totalItems || 0,
      lastChallanDate: row.lastChallanDate || null,
    }));

    res.status(200).json(mapped);
  } catch (error) {
    console.error('[getClientWiseSummary] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get total sales summary
 * Aggregates all dispatch challans (non-cancelled)
 * Shows total revenue, challan count, and average order value
 */
export const getTotalSalesSummary = async (req, res) => {
  try {
    const summary = await Challan.aggregate([
      {
        $match: {
          inventory_mode: 'dispatch',
          status: { $ne: 'CANCELLED' },
          archived: { $in: [false, null] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grand_total' },
          totalChallan: { $sum: 1 },
          totalItems: { $sum: { $size: { $ifNull: ['$items', []] } } },
          avgOrderValue: { $avg: '$grand_total' },
        },
      },
    ]);

    const data = summary[0] || {
      totalRevenue: 0,
      totalChallan: 0,
      totalItems: 0,
      avgOrderValue: 0,
    };

    res.status(200).json({
      totalRevenue: data.totalRevenue || 0,
      totalChallanCount: data.totalChallan || 0,
      totalItemsDispatched: data.totalItems || 0,
      avgOrderValue: data.avgOrderValue ? Math.round(data.avgOrderValue * 100) / 100 : 0,
    });
  } catch (error) {
    console.error('[getTotalSalesSummary] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
