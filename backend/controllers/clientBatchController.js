import ClientBatch from "../models/clientBatchModel.js";

const normalizeClientDetails = (details = {}) => {
  if (!details || typeof details !== "object") return undefined;
  const cleaned = {
    name: details.name?.trim() || "",
    address: details.address?.trim() || "",
    mobile: details.mobile?.trim() || "",
    gstNumber: details.gstNumber?.trim() || "",
  };
  const hasValues = Object.values(cleaned).some((val) => Boolean(val));
  return hasValues ? cleaned : undefined;
};

const filterLineItemsByAudit = (lineItems = [], allowedIds = []) => {
  const allowedSet = new Set(allowedIds.map((id) => String(id)));
  if (!allowedSet.size) return [];
  return lineItems
    .filter((item) => item?.auditId && allowedSet.has(String(item.auditId)))
    .map((item) => ({
      ...item,
      auditId: String(item.auditId),
      colours: Array.isArray(item.colours) ? item.colours : [],
    }));
};

const sanitizeManualItems = (manualItems = []) =>
  manualItems
    .filter((item) => item && (item.boxId || item.boxSnapshot?.title))
    .map((item) => ({
      ...item,
      boxId: item.boxId ? String(item.boxId) : undefined,
      colours: Array.isArray(item.colours) ? item.colours : [],
    }));

export const listClientBatches = async (_req, res) => {
  try {
    const batches = await ClientBatch.find({ status: "pending" }).sort({ createdAt: 1 });
    res.status(200).json(batches);
  } catch (error) {
    res.status(500).json({ message: "Unable to load client batches", error: error.message });
  }
};

export const createClientBatch = async (req, res) => {
  try {
    const { label, auditIds, lineItems, manualItems, hsnCode, terms, clientDetails } = req.body;
    const auditIdList = Array.isArray(auditIds)
      ? Array.from(new Set(auditIds.map((id) => String(id))))
      : [];
    const trimmedLabel = (label || "").trim();

    if (!trimmedLabel) {
      return res.status(400).json({ message: "Label is required to save a client batch" });
    }

    if (auditIdList.length === 0 && (!Array.isArray(manualItems) || manualItems.length === 0)) {
      return res
        .status(400)
        .json({ message: "Add at least one audit or manual item before saving to a batch" });
    }

    const safeLineItems = filterLineItemsByAudit(lineItems, auditIdList);
    const safeManualItems = sanitizeManualItems(manualItems);

    const payload = {
      label: trimmedLabel,
      auditIds: auditIdList,
      lineItems: safeLineItems,
      manualItems: safeManualItems,
      hsnCode: typeof hsnCode === "string" ? hsnCode.trim() : "",
      terms: typeof terms === "string" ? terms : "",
      clientDetails: normalizeClientDetails(clientDetails),
      createdBy: req.user?._id,
    };

    const batch = await ClientBatch.create(payload);
    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ message: "Unable to save client batch", error: error.message });
  }
};

export const appendToClientBatch = async (req, res) => {
  try {
    const { auditIds, lineItems, manualItems } = req.body;
    const batch = await ClientBatch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: "Client batch not found" });
    }

    const incomingAuditIds = Array.isArray(auditIds)
      ? auditIds.map((id) => String(id)).filter(Boolean)
      : [];

    const existingSet = new Set(batch.auditIds.map((id) => String(id)));
    const newAuditIds = [];
    incomingAuditIds.forEach((id) => {
      if (!existingSet.has(id)) {
        existingSet.add(id);
        newAuditIds.push(id);
      }
    });

    const safeLineItems = filterLineItemsByAudit(lineItems, newAuditIds);
    const safeManualItems = sanitizeManualItems(manualItems);

    batch.auditIds = Array.from(existingSet);
    batch.lineItems = [...batch.lineItems, ...safeLineItems];
    batch.manualItems = [...batch.manualItems, ...safeManualItems];

    if (typeof req.body.terms === "string") {
      batch.terms = req.body.terms;
    }
    if (typeof req.body.hsnCode === "string") {
      batch.hsnCode = req.body.hsnCode.trim();
    }
    if (req.body.clientDetails) {
      const normalized = normalizeClientDetails(req.body.clientDetails);
      batch.clientDetails = normalized || batch.clientDetails;
    }

    await batch.save();
    res.status(200).json(batch);
  } catch (error) {
    res.status(500).json({ message: "Unable to append to client batch", error: error.message });
  }
};

export const removeClientBatch = async (req, res) => {
  try {
    const batch = await ClientBatch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Client batch not found" });
    }
    await batch.deleteOne();
    res.status(200).json({ message: "Client batch removed" });
  } catch (error) {
    res.status(500).json({ message: "Unable to remove client batch", error: error.message });
  }
};

export const removeAuditFromBatch = async (req, res) => {
  try {
    const { auditId } = req.body;
    if (!auditId) {
      return res.status(400).json({ message: "auditId is required" });
    }
    const batch = await ClientBatch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Client batch not found" });
    }
    const auditIdStr = String(auditId);
    batch.auditIds = batch.auditIds.filter((id) => String(id) !== auditIdStr);
    batch.lineItems = batch.lineItems.filter((item) => String(item.auditId) !== auditIdStr);
    await batch.save();
    res.status(200).json(batch);
  } catch (error) {
    res.status(500).json({ message: "Unable to remove audit from batch", error: error.message });
  }
};

export const moveAuditBetweenBatches = async (req, res) => {
  try {
    const { auditId, fromBatchId, toBatchId } = req.body;
    if (!auditId || !fromBatchId || !toBatchId) {
      return res
        .status(400)
        .json({ message: "auditId, fromBatchId, and toBatchId are required to move audits" });
    }
    if (fromBatchId === toBatchId) {
      return res.status(400).json({ message: "Select a different client batch to move into" });
    }

    const [fromBatch, toBatch] = await Promise.all([
      ClientBatch.findById(fromBatchId),
      ClientBatch.findById(toBatchId),
    ]);

    if (!fromBatch || !toBatch) {
      return res.status(404).json({ message: "One of the client batches was not found" });
    }

    const auditIdStr = String(auditId);
    const lineItem = fromBatch.lineItems.find((item) => String(item.auditId) === auditIdStr);
    if (!lineItem) {
      return res.status(400).json({ message: "Audit does not exist inside the source batch" });
    }

    fromBatch.auditIds = fromBatch.auditIds.filter((id) => String(id) !== auditIdStr);
    fromBatch.lineItems = fromBatch.lineItems.filter(
      (item) => String(item.auditId) !== auditIdStr
    );

    const toSet = new Set(toBatch.auditIds.map((id) => String(id)));
    if (!toSet.has(auditIdStr)) {
      toSet.add(auditIdStr);
      toBatch.lineItems = [...toBatch.lineItems, lineItem];
    }
    toBatch.auditIds = Array.from(toSet);

    await Promise.all([fromBatch.save(), toBatch.save()]);
    res.status(200).json({ fromBatch, toBatch });
  } catch (error) {
    res.status(500).json({ message: "Unable to move audit between batches", error: error.message });
  }
};


