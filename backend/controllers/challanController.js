import BoxAudit from "../models/boxAuditModel.js";
import Challan from "../models/challanModel.js";

// Admin: list audits available to generate a challan (unused audits)
export const getChallanCandidates = async (req, res) => {
  try {
    const audits = await BoxAudit.find({ used: false })
      .populate("user", "name email")
      .populate("box", "title code category")
      .sort({ createdAt: -1 });
    res.status(200).json(audits);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

function generateChallanNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `CH-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${Math.floor(Math.random() * 1000)}`;
}

// Admin: create challan from selected audit IDs
export const createChallan = async (req, res) => {
  try {
    const { auditIds, notes } = req.body;
    if (!Array.isArray(auditIds) || auditIds.length === 0) {
      return res.status(400).json({ message: "auditIds must be a non-empty array" });
    }

    // Fetch audits and validate
    const audits = await BoxAudit.find({ _id: { $in: auditIds }, used: false })
      .populate("user", "name email")
      .populate("box", "title code category");

    if (audits.length !== auditIds.length) {
      return res.status(400).json({ message: "Some audits are invalid or already used" });
    }

    const challanNumber = generateChallanNumber();
    const items = audits.map((a) => ({
      audit: a._id,
      box: { _id: a.box._id, title: a.box.title, code: a.box.code, category: a.box.category },
      quantity: a.quantity,
      user: { _id: a.user._id, name: a.user.name, email: a.user.email },
      auditedAt: a.createdAt,
    }));

    const challan = await Challan.create({
      number: challanNumber,
      items,
      notes: notes || "",
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

// Admin: download challan as CSV
export const downloadChallanCsv = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id).populate("createdBy", "name email");
    if (!challan) return res.status(404).json({ message: "Challan not found" });

    const lines = [];
    lines.push(`Challan Number,${challan.number}`);
    lines.push(`Created At,${new Date(challan.createdAt).toISOString()}`);
    lines.push(`Created By,${challan.createdBy?.name || ""},${challan.createdBy?.email || ""}`);
    if (challan.notes) lines.push(`Notes,${challan.notes.replace(/[\r\n,]/g, " ")}`);
    lines.push("");
    lines.push("Box Title,Code,Category,Quantity,User,User Email,Audit Time");
    challan.items.forEach((it) => {
      lines.push(
        [
          JSON.stringify(it.box.title || ""),
          JSON.stringify(it.box.code || ""),
          JSON.stringify(it.box.category || ""),
          it.quantity,
          JSON.stringify(it.user.name || ""),
          JSON.stringify(it.user.email || ""),
          new Date(it.auditedAt).toISOString(),
        ].join(",")
      );
    });
    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${challan.number}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


