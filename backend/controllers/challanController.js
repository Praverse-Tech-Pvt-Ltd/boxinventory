import BoxAudit from "../models/boxAuditModel.js";
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
    const { auditIds, notes, includeGST } = req.body;
    if (!Array.isArray(auditIds) || auditIds.length === 0) {
      return res.status(400).json({ message: "auditIds must be a non-empty array" });
    }

    const includeGSTFlag = includeGST !== false && includeGST !== "false";

    // Fetch audits and validate
    const audits = await BoxAudit.find({ _id: { $in: auditIds }, used: false })
      .populate("user", "name email")
      .populate("box", "title code category colours price");

    if (audits.length !== auditIds.length) {
      return res.status(400).json({ message: "Some audits are invalid or already used" });
    }

    const challanNumber = await generateChallanNumber(includeGSTFlag);
    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    const lineItemMap = new Map();
    lineItems.forEach((item) => {
      if (item && item.auditId) {
        lineItemMap.set(String(item.auditId), item);
      }
    });
    const items = audits.map((a) => ({
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
      colours: (() => {
        const lineColours = lineItemMap.get(String(a._id))?.colours;
        if (Array.isArray(lineColours) && lineColours.length > 0) return lineColours;
        if (Array.isArray(a.box.colours)) return a.box.colours;
        return [];
      })(),
      user: { _id: a.user._id, name: a.user.name, email: a.user.email },
      auditedAt: a.createdAt,
    }));

    const challan = await Challan.create({
      number: challanNumber,
      items,
      notes: notes || "",
      includeGST: includeGSTFlag,
      createdBy: req.user._id,
    });

    // Mark audits as used and link to challan
    await BoxAudit.updateMany(
      { _id: { $in: auditIds } },
      { $set: { used: true, challan: challan._id } }
    );

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
          colours:
            item.colours && item.colours.length
              ? item.colours
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


