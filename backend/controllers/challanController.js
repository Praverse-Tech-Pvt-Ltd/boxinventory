import BoxAudit from "../models/boxAuditModel.js";
import Box from "../models/boxModel.js";
import Challan from "../models/challanModel.js";
import Counter from "../models/counterModel.js";
import { generateChallanPdf } from "../utils/challanPdfGenerator.js";
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

const GST_COUNTER_KEY = "challan_with_gst";
const NONGST_COUNTER_KEY = "challan_without_gst";
const CHALLAN_SEQUENCE_PADDING = 5;

function getDateFragment() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return yy + mm + dd;
}

function getRandomFragment() {
  return String(Math.floor(Math.random() * 90) + 10);
}

async function getNextChallanSequence(includeGST) {
  const counter = await Counter.findOneAndUpdate(
    { name: includeGST ? GST_COUNTER_KEY : NONGST_COUNTER_KEY },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.value;
}

async function generateChallanNumber(includeGST) {
  const prefix = includeGST ? "1" : "2";
  const dateFrag = getDateFragment();
  const sequence = await getNextChallanSequence(includeGST);
  const paddedSequence = String(sequence).padStart(CHALLAN_SEQUENCE_PADDING, "0");
  const randFrag = getRandomFragment();
  return `${prefix}${dateFrag}${randFrag}${paddedSequence}`;
}

// Admin: create challan from selected audit IDs
export const createChallan = async (req, res) => {
  try {
    const { auditIds, notes, terms, includeGST, clientDetails, manualItems } = req.body;
    const auditIdsArray = Array.isArray(auditIds) ? auditIds.filter(Boolean) : [];
    const manualItemsInput = Array.isArray(manualItems) ? manualItems.filter(Boolean) : [];

    if (auditIdsArray.length === 0 && manualItemsInput.length === 0) {
      return res
        .status(400)
        .json({ message: "Provide at least one audited item or add manual challan rows" });
    }

    const includeGSTFlag = includeGST !== false && includeGST !== "false";

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

    const challanNumber = await generateChallanNumber(includeGSTFlag);
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

    const manualBoxFilters = [];
    const manualBoxIds = [];
    const manualBoxCodes = [];
    manualItemsInput.forEach((item) => {
      if (item?.boxId) {
        manualBoxIds.push(item.boxId);
      } else if (item?.boxCode) {
        manualBoxCodes.push(String(item.boxCode).trim().toUpperCase());
      }
    });

    if (manualBoxIds.length) {
      manualBoxFilters.push({ _id: { $in: manualBoxIds } });
    }
    if (manualBoxCodes.length) {
      manualBoxFilters.push({ code: { $in: manualBoxCodes } });
    }

    let manualBoxes = [];
    if (manualBoxFilters.length > 0) {
      manualBoxes = await Box.find(
        manualBoxFilters.length === 1 ? manualBoxFilters[0] : { $or: manualBoxFilters }
      ).select("_id title code category colours price boxInnerSize");
    }

    const boxById = new Map();
    const boxByCode = new Map();
    manualBoxes.forEach((box) => {
      boxById.set(String(box._id), box);
      boxByCode.set(String(box.code).toUpperCase(), box);
    });

    const manualChallanItems = [];
    for (let i = 0; i < manualItemsInput.length; i++) {
      const manualItem = manualItemsInput[i];
      if (!manualItem) continue;
      if (!manualItem.boxId && !manualItem.boxCode) {
        return res
          .status(400)
          .json({ message: `Manual item ${i + 1} must include a product code` });
      }
      const codeKey = manualItem.boxCode ? String(manualItem.boxCode).trim().toUpperCase() : null;
      const idKey = manualItem.boxId ? String(manualItem.boxId) : null;
      const matchedBox = (idKey && boxById.get(idKey)) || (codeKey && boxByCode.get(codeKey));

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

    const normalizedClientDetails = {
      name: clientDetails?.name?.trim() || "",
      address: clientDetails?.address?.trim() || "",
      mobile: clientDetails?.mobile?.trim() || "",
      gstNumber: clientDetails?.gstNumber?.trim() || "",
    };
    const hasClientDetails = Object.values(normalizedClientDetails).some((val) => Boolean(val));

    const challanPayload = {
      number: challanNumber,
      items,
      notes: typeof terms === "string" ? terms : notes || "",
      includeGST: includeGSTFlag,
      createdBy: req.user._id,
    };

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

// Admin: list challans
export const listChallans = async (req, res) => {
  try {
    const challans = await Challan.find({})
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    res.status(200).json(challans);
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

// Admin: download challan as PDF
export const downloadChallanPdf = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id).populate("createdBy", "name email");
    if (!challan) return res.status(404).json({ message: "Challan not found" });

    const includeGST = req.query.includeGST !== "false";

    const pdfPath = await generateChallanPdf(
      {
        number: challan.number,
        items: (challan.items || []).map((item) => ({
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
        })),
        terms: challan.notes,
        createdBy: challan.createdBy
          ? { name: challan.createdBy.name || challan.createdBy.email || "" }
          : {},
        clientDetails: challan.clientDetails || {},
      },
      includeGST
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${challan.number}.pdf"`);

    return res.download(pdfPath, (err) => {
      if (err) {
        console.error("Error sending challan PDF:", err);
      }
      fsPromises
        .unlink(pdfPath)
        .catch((unlinkErr) => console.error("Error deleting temp pdf:", unlinkErr));
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


