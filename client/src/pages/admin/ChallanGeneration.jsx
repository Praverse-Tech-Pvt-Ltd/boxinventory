import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiCheckSquare, FiSquare, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import "../../styles/dashboard.css";
import { getChallanCandidates, createChallan, downloadChallanPdf, listChallans, searchClients } from "../../services/challanService";
import { getAllBoxes, addColorToBox } from "../../services/boxService";
import {
  appendClientBatch as appendClientBatchApi,
  createClientBatch as createClientBatchApi,
  listClientBatches as listClientBatchesApi,
  moveAuditBetweenBatches as moveAuditBetweenBatchesApi,
  removeAuditFromBatch as removeAuditFromBatchApi,
  removeClientBatch as removeClientBatchApi,
} from "../../services/clientBatchService";

const createEmptyClientDetails = () => ({
  name: "",
  address: "",
  mobile: "",
  gstNumber: "",
});

const generateManualRowId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createManualRow = () => ({
  id: generateManualRowId(),
  searchCode: "",
  searchName: "",
  searchMode: "code", // "code" or "name"
  boxId: "",
  boxTitle: "",
  boxCode: "",
  boxCategory: "",
  availableColours: [],
  cavity: "",
  quantity: 0,
  rate: 0,
  assemblyCharge: 0,
  packagingCharge: 0,
  color: "",
  colours: [],
  coloursInput: "",
  showAddColorInput: false,
  newColorInput: "",
});

const DEFAULT_TERMS = `Terms & Conditions:
• Parcel will be dispatched after payment confirmation.
• Order once placed – No refund / No cancellation / No exchange.
• Customised order – colour difference is possible in printing.
• Order will be shipped within 24 hours of payment received.
• Delivery timeline: 2–6 working days, depending on location.`;

const DEFAULT_NOTE = `Note:
~ Prices are without GST. GST @ 5% applicable.
~ Shipping & packaging charges are additional.
~ Shipping charges depend on weight and dimensions.
~ Goods once sold will not be taken back / exchanged / refunded.
~ Final amount will be shared after order confirmation.
~ Payment confirmation screenshot is mandatory.
~ Dispatch within 24–48 hours after payment.
~ Delivery:
  • 1–2 days Mumbai
  • 5–7 days PAN India
  • May delay during festive season
~ Opening video mandatory for damage claims.
~ Tracking ID shared after pickup.`;

const ChallanGeneration = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [submitting, setSubmitting] = useState(false);

  const [recentChallans, setRecentChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(true);
   const [editRows, setEditRows] = useState({});
  const [clientDetails, setClientDetails] = useState(() => createEmptyClientDetails());
  const [hsnCode, setHsnCode] = useState("481920");
  const [inventoryType, setInventoryType] = useState("subtract"); // 'add' or 'subtract'
  const [manualRows, setManualRows] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [clientBatches, setClientBatches] = useState([]);
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [appendTargetBatchId, setAppendTargetBatchId] = useState("");
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [challanTaxType, setChallanTaxType] = useState("GST"); // GST or NON_GST
  const [paymentMode, setPaymentMode] = useState(""); // Cash, GPay, Bank Account, Credit
  const [remarks, setRemarks] = useState("");
  
  // Client autosuggest
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getChallanCandidates();
      setCandidates(data);
    } catch {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  const loadChallans = async () => {
    try {
      setLoadingChallans(true);
      const data = await listChallans();
      setRecentChallans(data.slice(0, 10));
    } catch {
      // silent
    } finally {
      setLoadingChallans(false);
    }
  };

  const loadClientBatchesFromServer = useCallback(async () => {
    try {
      setLoadingBatches(true);
      const data = await listClientBatchesApi();
      setClientBatches(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load pending client batches");
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadChallans();
  }, []);

  useEffect(() => {
    const fetchBoxes = async () => {
      try {
        setBoxesLoading(true);
        const data = await getAllBoxes();
        setBoxes(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Unable to load product catalog for manual entries");
      } finally {
        setBoxesLoading(false);
      }
    };
    fetchBoxes();
  }, []);

  useEffect(() => {
    loadClientBatchesFromServer();
  }, [loadClientBatchesFromServer]);

  useEffect(() => {
    if (
      appendTargetBatchId &&
      !clientBatches.some((batch) => getBatchId(batch) === appendTargetBatchId)
    ) {
      setAppendTargetBatchId("");
    }
  }, [appendTargetBatchId, clientBatches]);

   // Initialize/Edit rows whenever selection changes
   useEffect(() => {
     const next = { ...editRows };
     Object.keys(selected).forEach((id) => {
       if (selected[id]) {
         const audit = candidates.find(c => c._id === id);
         if (audit && !next[id]) {
           next[id] = {
             auditId: id,
             cavity: audit.box?.boxInnerSize || "",
             quantity: audit.quantity || 0,
             rate: Number(audit.box?.price || 0),
             assemblyCharge: 0,
             packagingCharge: 0,
             color: audit.color || "",
             colours: audit.color ? [audit.color] : (Array.isArray(audit.box?.colours) ? [...audit.box.colours] : []),
           };
         }
       }
     });
     // remove rows no longer selected
     Object.keys(next).forEach((id) => {
       if (!selected[id]) delete next[id];
     });
     setEditRows(next);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selected, candidates]);

   // Close client dropdown when clicking outside
   useEffect(() => {
     const handleClickOutside = (e) => {
       if (showClientDropdown && !e.target.closest(".client-search-container")) {
         setShowClientDropdown(false);
       }
     };

     document.addEventListener("mousedown", handleClickOutside);
     return () => document.removeEventListener("mousedown", handleClickOutside);
   }, [showClientDropdown]);

   const updateRow = (id, patch) => {
     setEditRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
   };

   const removeColour = (id, color) => {
     const current = editRows[id]?.colours || [];
     updateRow(id, { colours: current.filter(c => c !== color) });
   };

   const addColour = (id, color) => {
     const val = (color || "").trim();
     if (!val) return;
     const current = editRows[id]?.colours || [];
     updateRow(id, { colours: [...current, val] });
   };

  const addManualRow = () => {
    setManualRows((prev) => [...prev, createManualRow()]);
  };

  const removeManualRow = (rowId) => {
    setManualRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const updateManualRow = (rowId, patch) => {
    setManualRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  };

  const boxLookupByTitle = useMemo(() => {
    const map = new Map();
    boxes.forEach((box) => {
      if (box?.code) {
        map.set(String(box.code).trim().toUpperCase(), box);
      }
    });
    return map;
  }, [boxes]);

  const boxLookupByName = useMemo(() => {
    const map = new Map();
    boxes.forEach((box) => {
      if (box?.title) {
        map.set(String(box.title).trim().toLowerCase(), box);
      }
    });
    return map;
  }, [boxes]);

  const handleManualCodeLookup = (rowId, rawCode) => {
    const cleaned = (rawCode || "").trim().toUpperCase();
    if (!cleaned) {
      updateManualRow(rowId, {
        searchCode: "",
        boxId: "",
        boxTitle: "",
        boxCode: "",
        boxCategory: "",
        availableColours: [],
      });
      return;
    }
    const matched = boxLookupByTitle.get(cleaned);
    if (!matched) {
      toast.error(`Invalid product code: "${rawCode}". Product not found.`);
      updateManualRow(rowId, {
        boxId: "",
        boxTitle: "",
        boxCode: "",
        boxCategory: "",
        availableColours: [],
      });
      return;
    }
    updateManualRow(rowId, {
      boxId: matched._id,
      searchCode: matched.code,
      boxTitle: matched.title,
      boxCode: matched.code || "",
      boxCategory: matched.category,
      cavity: matched.boxInnerSize || "",
      rate: Number(matched.price || 0),
      availableColours: Array.isArray(matched.colours) ? matched.colours : [],
    });
  };

  const handleManualNameLookup = (rowId, rawName) => {
    const cleaned = (rawName || "").trim().toLowerCase();
    if (!cleaned) {
      updateManualRow(rowId, {
        searchName: "",
        boxId: "",
        boxTitle: "",
        boxCode: "",
        boxCategory: "",
        availableColours: [],
      });
      return;
    }
    const matched = boxLookupByName.get(cleaned);
    if (!matched) {
      toast.error(`Product name not found: "${rawName}". Please enter a valid product name.`);
      updateManualRow(rowId, {
        boxId: "",
        boxTitle: "",
        boxCode: "",
        boxCategory: "",
        availableColours: [],
      });
      return;
    }
    updateManualRow(rowId, {
      boxId: matched._id,
      searchName: matched.title,
      boxTitle: matched.title,
      boxCode: matched.code || "",
      boxCategory: matched.category,
      cavity: matched.boxInnerSize || "",
      rate: Number(matched.price || 0),
      availableColours: Array.isArray(matched.colours) ? matched.colours : [],
    });
  };

  const handleManualColoursInput = (rowId, value) => {
    const parsed = value
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    updateManualRow(rowId, { coloursInput: value, colours: parsed });
  };

  const getBatchId = (batch) => (batch?._id ? String(batch._id) : batch?.id ? String(batch.id) : null);

  const resetCurrentClientDraft = () => {
    setSelected({});
    setTerms(DEFAULT_TERMS);
    setNote(DEFAULT_NOTE);
    setEditRows({});
    setClientDetails(createEmptyClientDetails());
    setHsnCode("481920");
    setInventoryType("subtract");
    setChallanTaxType("GST"); // Reset to default GST
    setManualRows([]);
    setPaymentMode("");
    setRemarks("");
  };

  const upsertBatch = (nextBatch) => {
    const batchId = getBatchId(nextBatch);
    if (!batchId) return;
    setClientBatches((prev) => {
      const exists = prev.some((batch) => getBatchId(batch) === batchId);
      if (exists) {
        return prev.map((batch) => (getBatchId(batch) === batchId ? nextBatch : batch));
      }
      return [...prev, nextBatch];
    });
  };

  const removeBatchLocally = (batchId) => {
    setClientBatches((prev) => prev.filter((batch) => getBatchId(batch) !== batchId));
    if (appendTargetBatchId === batchId) {
      setAppendTargetBatchId("");
    }
  };

  const handleSaveNewBatch = async () => {
    try {
      const payload = buildCurrentClientPayload();
      const label =
        payload.clientDetails?.name?.trim() ||
        (clientBatches.length ? `Client ${clientBatches.length + 1}` : "Client 1");
      const saved = await createClientBatchApi({ ...payload, label });
      upsertBatch(saved);
      toast.success(`Added ${label} to batch`);
      resetCurrentClientDraft();
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Unable to add client batch";
      toast.error(msg);
    }
  };

  const handleAppendToExistingBatch = async () => {
    if (!appendTargetBatchId) return;
    try {
      const payload = buildCurrentClientPayload();
      const updated = await appendClientBatchApi(appendTargetBatchId, payload);
      upsertBatch(updated);
      toast.success("Added current selection to existing client");
      resetCurrentClientDraft();
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Unable to append to client batch";
      toast.error(msg);
    }
  };

  const handleRemoveClientBatch = async (batchId) => {
    try {
      await removeClientBatchApi(batchId);
      removeBatchLocally(batchId);
      toast.success("Client removed from batch queue");
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Unable to remove client batch";
      toast.error(msg);
    }
  };

  const handleRemoveAuditFromClientBatch = async (batchId, auditId) => {
    try {
      const updated = await removeAuditFromBatchApi(batchId, auditId);
      upsertBatch(updated);
      toast.success("Audit removed from client batch");
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Unable to remove audit from batch";
      toast.error(msg);
    }
  };

  const handleMoveAuditToBatch = async (auditId, fromBatchId, toBatchId) => {
    try {
      const response = await moveAuditBetweenBatchesApi({ auditId, fromBatchId, toBatchId });
      if (response?.fromBatch) {
        upsertBatch(response.fromBatch);
      }
      if (response?.toBatch) {
        upsertBatch(response.toBatch);
      }
      toast.success("Audit moved to selected client");
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Unable to move audit";
      toast.error(msg);
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter((a) => {
      const user = (a.user?.name || a.user?.email || "").toLowerCase();
      const title = (a.box?.title || "").toLowerCase();
      const code = (a.box?.code || "").toLowerCase();
      const category = (a.box?.category || "").toLowerCase();
      const color = (a.color || "").toLowerCase();
      const qty = String(a.quantity || "").toLowerCase();
      return (
        user.includes(q) ||
        title.includes(q) ||
        code.includes(q) ||
        category.includes(q) ||
        color.includes(q) ||
        qty.includes(q)
      );
    });
  }, [candidates, searchQuery]);

  const updateClientDetails = (field, value) => {
    setClientDetails((prev) => ({ ...prev, [field]: value }));
  };

  // Search for existing clients by name
  const handleClientSearch = useCallback(
    async (query) => {
      setClientSearchQuery(query);
      
      if (!query || query.trim().length < 2) {
        setClientSearchResults([]);
        setShowClientDropdown(false);
        return;
      }

      try {
        setSearchingClients(true);
        const results = await searchClients(query.trim());
        setClientSearchResults(Array.isArray(results) ? results : []);
        setShowClientDropdown(true);
      } catch (error) {
        console.error("Error searching clients:", error);
        toast.error("Failed to search clients");
        setClientSearchResults([]);
      } finally {
        setSearchingClients(false);
      }
    },
    []
  );

  // Select a client from search results
  const selectClientFromSearch = (client) => {
    setClientDetails({
      name: client.name || "",
      address: client.address || "",
      mobile: client.mobile || "",
      gstNumber: client.gstNumber || "",
    });
    setClientSearchQuery(client.name || "");
    setShowClientDropdown(false);
    toast.success(`Client "${client.name}" selected`);
  };

  const selectedRows = useMemo(() => {
    return candidates
      .filter((a) => selected[a._id])
      .map((a, idx) => {
        const edit = editRows[a._id] || {};
        const qty = Number.isFinite(Number(edit.quantity)) ? Number(edit.quantity) : Number(a.quantity || 0);
        const rate = Number(edit.rate || 0);
        const assembly = Number(edit.assemblyCharge || 0);
        const packaging = Number(edit.packagingCharge || 0);
        const lineTotal = (rate + assembly + packaging) * (Number.isFinite(qty) ? qty : 0);
        return {
          idx,
          audit: a,
          edit,
          qty: Number.isFinite(qty) ? qty : 0,
          rate,
          assembly,
          packaging,
          total: Number.isFinite(lineTotal) ? lineTotal : 0,
        };
      });
  }, [candidates, editRows, selected]);

  const manualRowsComputed = useMemo(() => {
    return manualRows.map((row, idx) => {
      const qty = Number(row.quantity) || 0;
      const rate = Number(row.rate) || 0;
      const assembly = Number(row.assemblyCharge) || 0;
      const packaging = Number(row.packagingCharge) || 0;
      const total = (rate + assembly + packaging) * qty;
      return {
        ...row,
        idx,
        qty,
        rate,
        assembly,
        packaging,
        total,
      };
    });
  }, [manualRows]);

  const summary = useMemo(() => {
    const auditedSubtotal = selectedRows.reduce((sum, row) => sum + row.total, 0);
    const manualSubtotal = manualRowsComputed.reduce((sum, row) => sum + row.total, 0);
    const subtotal = auditedSubtotal + manualSubtotal;
    const auditedQty = selectedRows.reduce((sum, row) => sum + row.qty, 0);
    const manualQty = manualRowsComputed.reduce((sum, row) => sum + row.qty, 0);
    const totalQty = auditedQty + manualQty;
    const gstAmount = subtotal * 0.05;
    const totalBeforeRound = subtotal + gstAmount;
    const roundedTotal = Math.round(totalBeforeRound);
    const roundOff = roundedTotal - totalBeforeRound;
    return {
      subtotal,
      totalQty,
      gstAmount,
      totalBeforeRound,
      roundOff,
      grandTotal: roundedTotal,
    };
  }, [selectedRows, manualRowsComputed]);

  const hasAnyRows = selectedRows.length > 0 || manualRowsComputed.length > 0;
  const showClientBatchPanel = hasAnyRows || clientBatches.length > 0;

  const reservedAuditIds = useMemo(() => {
    const set = new Set();
    clientBatches.forEach((batch) => {
      (batch.auditIds || []).forEach((id) => set.add(id));
    });
    return set;
  }, [clientBatches]);

  const allSelected = useMemo(
    () => filtered.length > 0 && filtered.every((a) => selected[a._id]),
    [filtered, selected]
  );

  const toggleAll = () => {
    if (allSelected) {
      const copy = { ...selected };
      filtered.forEach((a) => {
        delete copy[a._id];
      });
      setSelected(copy);
    } else {
      const copy = { ...selected };
      filtered.forEach((a) => {
        if (!reservedAuditIds.has(a._id)) {
          copy[a._id] = true;
        }
      });
      setSelected(copy);
    }
  };

  const toggleOne = (id) => {
    if (reservedAuditIds.has(id)) {
      toast.error("This audit is already assigned to another client in the batch");
      return;
    }
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clientChallanSummary = useMemo(() => {
    const groups = new Map();
    recentChallans.forEach((c) => {
      const key = (c.clientDetails?.name || "").trim() || "Unnamed Client";
      if (!groups.has(key)) {
        groups.set(key, {
          clientName: key,
          challanCount: 0,
          totalItems: 0,
          latestDate: null,
        });
      }
      const g = groups.get(key);
      g.challanCount += 1;
      g.totalItems += Array.isArray(c.items) ? c.items.length : 0;
      const createdAt = c.createdAt ? new Date(c.createdAt) : null;
      if (createdAt && (!g.latestDate || createdAt > g.latestDate)) {
        g.latestDate = createdAt;
      }
    });
    return Array.from(groups.values()).sort((a, b) =>
      a.clientName.localeCompare(b.clientName)
    );
  }, [recentChallans]);

  const buildCurrentClientPayload = () => {
    const auditIds = Object.keys(selected).filter((id) => selected[id]);
    const manualPending = manualRowsComputed.find((row) => row.searchCode && !row.boxId);
    if (manualPending) {
      throw new Error(`Fetch product details for manual item #${manualPending.idx + 1}`);
    }
    const manualInvalidQty = manualRowsComputed.find(
      (row) => row.boxId && (!Number.isFinite(row.qty) || row.qty <= 0)
    );
    if (manualInvalidQty) {
      throw new Error(`Enter a valid quantity for manual item #${manualInvalidQty.idx + 1}`);
    }

    const lineItems = auditIds.map((id) => {
      const r = editRows[id] || {};
      const audit = candidates.find((c) => c._id === id);
      return {
        auditId: id,
        cavity: r.cavity || "",
        quantity: Number(r.quantity || 0),
        rate: Number(r.rate || 0),
        assemblyCharge: Number(r.assemblyCharge || 0),
        packagingCharge: Number(r.packagingCharge || 0),
        color: r.color || audit?.color || "",
        colours: Array.isArray(r.colours) ? r.colours : [],
        boxSnapshot: audit?.box
          ? {
              title: audit.box?.title || "",
              code: audit.box?.code || "",
              category: audit.box?.category || "",
            }
          : undefined,
      };
    });

    const manualItemsPayload = manualRowsComputed
      .filter((row) => row.boxId && row.qty > 0)
      .map((row) => ({
        boxId: row.boxId,
        cavity: row.cavity || "",
        quantity: row.qty,
        rate: row.rate || 0,
        assemblyCharge: row.assembly || 0,
        packagingCharge: row.packaging || 0,
        color: row.color || "",
        colours: Array.isArray(row.colours) ? row.colours : [],
        boxSnapshot: {
          title: row.boxTitle || row.searchCode || "",
          code: row.boxCode || "",
          category: row.boxCategory || "",
        },
      }));

    if (auditIds.length === 0 && manualItemsPayload.length === 0) {
      throw new Error("Add at least one manual item or select from audits");
    }

    const hasClientInfo = Object.values(clientDetails).some(
      (val) => (val || "").trim().length > 0
    );

    return {
      auditIds,
      lineItems,
      manualItems: manualItemsPayload,
      terms,
      note,
      hsnCode,
      inventoryType: inventoryType || "subtract", // Ensure it has a value, default to subtract
      challanTaxType: challanTaxType || "GST", // Ensure it has a value, default to GST
      clientDetails: hasClientInfo ? clientDetails : undefined,
      payment_mode: paymentMode || null,
      remarks: remarks.trim() || null,
    };
  };

  const handleGenerate = async () => {
    try {
      const payload = buildCurrentClientPayload();
      console.log("[Frontend] Sending payload with inventoryType:", payload.inventoryType, "taxType:", payload.challanTaxType);
      setSubmitting(true);
      const challan = await createChallan(payload);
      toast.success(`Challan ${challan.number} created`);
      resetCurrentClientDraft();
      await loadData();
      await loadChallans();
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Failed to create challan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdf = async (id, number) => {
    try {
      const blob = await downloadChallanPdf(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download challan PDF");
    }
  };

  return (
    <div className="w-full section-spacing">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="section-title">📋 Challan Generation</h2>
        <p className="section-subtitle">Create and manage challan documents for inventory dispatch</p>
      </div>

      {/* Main Content */}
      <motion.div
        className="dashboard-card hover-lift"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Search and Add Button */}
        <div className="card-header mb-6">
          <h3 className="card-header-title">Select Items for Challan</h3>
          <motion.button
            onClick={addManualRow}
            className="btn btn-success btn-sm"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>➕</span>
            <span>Add Manual Item</span>
          </motion.button>
        </div>

        {/* Search Bar with Filter */}
        <div className="toolbar mb-4">
          <div className="toolbar-left">
            <label className="toolbar-label">
              {Object.keys(selected).filter(k => selected[k]).length} items selected
            </label>
          </div>
          <div className="toolbar-right">
            <div className="flex-1 min-w-[250px] max-w-[500px]">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-muted" size={16} />
                <input
                  type="text"
                  placeholder="Search by user, box name, code, category, color, or quantity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="form-input pl-8 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

      {/* Preview/Edit selected lines */}
      {hasAnyRows && (
        <div className="bg-theme-surface rounded-lg shadow-sm border border-theme-border p-6">
          <h3 className="text-2xl font-bold text-theme-text-primary mb-6">Challan Preview</h3>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="rounded-lg border border-theme-border bg-theme-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-theme-text-secondary font-semibold">Line Items</p>
              <p className="mt-1 text-2xl font-bold text-theme-text-primary">
                {selectedRows.length + manualRowsComputed.length}
              </p>
              <p className="text-xs text-theme-text-muted mt-0.5">
                Audited: {selectedRows.length} • Manual: {manualRowsComputed.length}
              </p>
            </div>
            <div className="rounded-lg border border-theme-border bg-theme-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-theme-text-secondary font-semibold">Total Quantity</p>
              <p className="mt-1 text-2xl font-bold text-theme-text-primary">{summary.totalQty}</p>
            </div>
            <div className="rounded-lg border border-theme-border bg-theme-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-theme-text-secondary font-semibold">Subtotal</p>
              <p className="mt-1 text-2xl font-bold text-theme-text-primary">₹{summary.subtotal.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-theme-border bg-theme-surface px-4 py-3 flex flex-col justify-between">
              <p className="text-xs uppercase tracking-wide text-theme-text-secondary font-semibold">GST</p>
              <div className="mt-2 flex items-center gap-3 text-sm text-theme-text-primary">
                <span className="px-3 py-1 rounded-full bg-theme-accent/10 font-semibold text-theme-accent-dark">Fixed at 5%</span>
              </div>
            </div>
          </div>

          {/* GST preference removed; fixed at 5% */}
          {selectedRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border border-theme-border rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-theme-table-header-bg text-theme-text-primary uppercase tracking-wide text-xs font-semibold border-b border-theme-border">
                 <tr>
                  <th className="px-4 py-3">Sr.</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Cavity (Inner Size)</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Colours</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Assembly</th>
                  <th className="px-4 py-3 text-right">Packaging</th>
                  <th className="px-4 py-3 text-right">Total</th>
                 </tr>
               </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedRows.map(({ audit, edit, idx, qty, rate, assembly, packaging, total }, rowIdx) => (
                  <tr key={audit._id} className={`align-top transition-colors hover:bg-theme-row-hover ${rowIdx % 2 === 0 ? 'bg-theme-surface' : 'bg-theme-surface-2'}`}>
                    <td className="px-4 py-4 text-sm font-semibold text-theme-primary">{idx + 1}</td>
                    <td className="px-4 py-4 text-sm text-theme-text-primary">
                      <div className="font-semibold">{audit.box?.title}</div>
                      <p className="text-xs text-theme-text-muted mt-1">Auto-rate prefilled from box price, adjust if needed.</p>
                    </td>
                    <td className="px-4 py-4 text-sm">
                           <input
                             type="text"
                        value={edit.cavity ?? ""}
                        onChange={(e) => updateRow(audit._id, { cavity: e.target.value })}
                        autoComplete="off"
                        className="w-full sm:w-48 px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-input-bg text-sm shadow-sm text-theme-text-primary"
                           />
                         </td>
                    <td className="px-4 py-4 text-sm font-mono text-theme-text-secondary">{audit.box?.code}</td>
                    <td className="px-4 py-4 text-sm">
                      <div className="space-y-2">
                        <span className="px-2 py-1 rounded-full bg-theme-accent/10 text-theme-accent-dark text-xs font-medium border border-theme-accent/20">
                          {edit.color || audit.color || "-"}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {(edit.colours || []).filter(c => c !== edit.color && c !== audit.color).map((c) => (
                            <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-theme-accent/10 text-theme-accent-dark text-xs border border-theme-accent/20 shadow-sm">
                              {c}
                              <button className="text-theme-primary hover:text-theme-primary-dark" onClick={() => removeColour(audit._id, c)}>✕</button>
                            </span>
                          ))}
                        </div>
                        {/* <div className="mt-2 flex gap-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                addColour(audit._id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-input-bg text-sm shadow-sm text-theme-text-primary"
                          >
                            {Array.isArray(audit.box?.colours) && audit.box.colours
                              .filter(c => !edit.colours?.includes(c) && c !== edit.color && c !== audit.color)
                              .map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                          </select>
                        </div> */}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.quantity ?? 0}
                        onChange={(e) => updateRow(audit._id, { quantity: Number(e.target.value) })}
                        autoComplete="off"
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.rate ?? 0}
                        onChange={(e) => updateRow(audit._id, { rate: Number(e.target.value) })}
                        autoComplete="off"
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.assemblyCharge ?? 0}
                        onChange={(e) => updateRow(audit._id, { assemblyCharge: Number(e.target.value) })}
                        autoComplete="off"
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.packagingCharge ?? 0}
                        onChange={(e) => updateRow(audit._id, { packagingCharge: Number(e.target.value) })}
                        autoComplete="off"
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-right text-theme-primary">₹{total.toFixed(2)}</td>
                  </tr>
                ))}
               </tbody>
             </table>
           </div>
          )}
          <div className="mt-8 rounded-lg border border-theme-border bg-theme-surface px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-theme-text-primary">Manual Items (Optional)</p>
                <p className="text-xs text-theme-text-secondary">
                  Add extra products by code even if no audits are available
                </p>
              </div>
              <button
                type="button"
                onClick={addManualRow}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-theme-input-border text-theme-text-secondary hover:bg-theme-surface-2"
              >
                + Add Manual Item
              </button>
            </div>
            {manualRowsComputed.length === 0 ? (
              <p className="text-sm text-theme-text-secondary mt-4">
                {boxesLoading
                  ? "Loading product catalog..."
                  : "Click “Add Manual Item” to input a product code and create a custom line."}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {manualRowsComputed.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-theme-border bg-theme-surface px-4 py-4 space-y-4 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-theme-text-primary">
                          Manual Item #{row.idx + 1}
                        </p>
                        <p className="text-xs text-theme-text-secondary">
                          {row.boxTitle
                            ? `${row.boxTitle} ${row.boxCategory ? `• ${row.boxCategory}` : ""}`
                            : "Enter product code to fetch box details"}
                        </p>
                        {row.availableColours?.length > 0 && (
                          <p className="text-[11px] text-theme-text-muted mt-1">
                            Available colours: {row.availableColours.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-theme-text-muted">
                          Line Total
                        </p>
                        <p className="text-lg font-bold text-theme-primary">₹{row.total.toFixed(2)}</p>
                        <button
                          type="button"
                          onClick={() => removeManualRow(row.id)}
                          className="mt-2 text-xs text-theme-primary hover:text-theme-primary-light"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary mb-2">
                          Search Mode
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              updateManualRow(row.id, { searchMode: "code", searchCode: "", searchName: "", boxId: "", boxTitle: "", boxCode: "", boxCategory: "", availableColours: [] });
                            }}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                              row.searchMode === "code"
                                ? "bg-theme-primary text-white"
                                : "border border-theme-input-border text-theme-text-secondary hover:bg-theme-surface-2"
                            }`}
                          >
                            By Code
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateManualRow(row.id, { searchMode: "name", searchCode: "", searchName: "", boxId: "", boxTitle: "", boxCode: "", boxCategory: "", availableColours: [] });
                            }}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                              row.searchMode === "name"
                                ? "bg-theme-primary text-white"
                                : "border border-theme-input-border text-theme-text-secondary hover:bg-theme-surface-2"
                            }`}
                          >
                            By Name
                          </button>
                        </div>
                      </div>
                      <div>
                        {row.searchMode === "code" ? (
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                              Product Code *
                            </label>
                            <div className="flex gap-2 mt-1">
                              <input
                                type="text"
                                value={row.searchCode || ""}
                                onChange={(e) =>
                                  updateManualRow(row.id, { searchCode: e.target.value.toUpperCase() })
                                }
                                onBlur={(e) => handleManualCodeLookup(row.id, e.target.value)}
                                placeholder="e.g. BOX001"
                                autoComplete="off"
                                className="w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm font-mono uppercase"
                              />
                              <button
                                type="button"
                                onClick={() => handleManualCodeLookup(row.id, row.searchCode)}
                                className="px-3 py-2 rounded-lg border border-theme-primary text-theme-primary text-xs font-semibold hover:bg-theme-primary hover:text-white transition-colors"
                              >
                                Fetch
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                              Product Name *
                            </label>
                            <div className="flex gap-2 mt-1">
                              <input
                                type="text"
                                value={row.searchName || ""}
                                onChange={(e) =>
                                  updateManualRow(row.id, { searchName: e.target.value })
                                }
                                onBlur={(e) => handleManualNameLookup(row.id, e.target.value)}
                                placeholder="e.g. Luxury Gift Box"
                                autoComplete="off"
                                className="w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleManualNameLookup(row.id, row.searchName)}
                                className="px-3 py-2 rounded-lg border border-theme-primary text-theme-primary text-xs font-semibold hover:bg-theme-primary hover:text-white transition-colors"
                              >
                                Fetch
                              </button>
                            </div>
                          </div>
                        )}
                        {row.boxTitle && (
                          <p className="mt-2 text-xs text-theme-text-secondary">
                            <span className="font-semibold">Product:</span> {row.boxTitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Product Name (Auto-filled)
                        </label>
                        <input
                          type="text"
                          value={row.boxTitle}
                          disabled
                          className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg bg-theme-surface-2 text-theme-text-muted text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Product Code (Auto-filled)
                        </label>
                        <input
                          type="text"
                          value={row.boxCode}
                          disabled
                          className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg bg-theme-surface-2 text-theme-text-muted text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.quantity}
                          onChange={(e) =>
                            updateManualRow(row.id, { quantity: Number(e.target.value) })
                          }
                          autoComplete="off"
                          className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Rate
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.rate}
                          onChange={(e) => updateManualRow(row.id, { rate: Number(e.target.value) })}
                          autoComplete="off"
                          className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Assembly
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.assemblyCharge}
                          onChange={(e) =>
                            updateManualRow(row.id, { assemblyCharge: Number(e.target.value) })
                          }
                          autoComplete="off"
                          className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Packaging
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.packagingCharge}
                          onChange={(e) =>
                            updateManualRow(row.id, { packagingCharge: Number(e.target.value) })
                          }
                          autoComplete="off"
                          className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Primary Color
                        </label>
                        {row.availableColours && row.availableColours.length > 0 ? (
                          <div className="mt-1 space-y-2">
                            <select
                              value={row.color}
                              onChange={(e) => {
                                if (e.target.value === "__add_new__") {
                                  updateManualRow(row.id, { color: "", showAddColorInput: true });
                                } else {
                                  updateManualRow(row.id, { color: e.target.value, showAddColorInput: false });
                                }
                              }}
                              className="w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                            >
                              <option value="">-- Select a color --</option>
                              {row.availableColours.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                              <option value="__add_new__">+ Add new color</option>
                            </select>
                            {row.showAddColorInput && (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  autoComplete="off"
                                  placeholder="Enter new color name"
                                  value={row.newColorInput || ""}
                                  onChange={(e) => updateManualRow(row.id, { newColorInput: e.target.value })}
                                  className="flex-1 px-3 py-2 border border-theme-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const newColor = (row.newColorInput || "").trim();
                                    if (!newColor) {
                                      toast.error("Color name cannot be empty");
                                      return;
                                    }
                                    try {
                                      // Call API to add color to box
                                      await addColorToBox(row.boxId, newColor);
                                      toast.success(`Color "${newColor}" added to product`);
                                      updateManualRow(row.id, { 
                                        color: newColor, 
                                        availableColours: [...(row.availableColours || []), newColor],
                                        showAddColorInput: false,
                                        newColorInput: ""
                                      });
                                    } catch (error) {
                                      const msg = error?.response?.data?.message || error.message || "Failed to add color";
                                      toast.error(msg);
                                    }
                                  }}
                                  className="px-3 py-2 bg-theme-primary text-white rounded-lg text-xs font-semibold hover:bg-theme-primary/80"
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateManualRow(row.id, { showAddColorInput: false, newColorInput: "" })}
                                  className="px-3 py-2 bg-theme-surface-2 text-theme-text-secondary rounded-lg text-xs font-semibold hover:bg-theme-surface-3"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.color}
                            onChange={(e) => updateManualRow(row.id, { color: e.target.value })}
                            placeholder="Enter color (no colors available for this product)"
                            className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">
                          Additional Colors (comma separated)
                        </label>
                        <textarea
                          rows={2}
                          value={row.coloursInput}
                          onChange={(e) => handleManualColoursInput(row.id, e.target.value)}
                          placeholder="e.g. Gold, Silver, Black"
                          className="mt-1 w-full px-3 py-2 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                        />
                        {row.colours.length > 0 && (
                          <p className="text-xs text-theme-text-secondary mt-1">
                            Selected: {row.colours.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addManualRow}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-dashed border-theme-input-border text-theme-text-secondary hover:bg-theme-surface-2"
                >
                  + Add Another Manual Item
                </button>
              </div>
            )}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-theme-border bg-theme-surface px-5 py-4 shadow-md">
              <p className="text-xs uppercase tracking-wide text-theme-text-muted font-semibold mb-3">Summary</p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-theme-text-secondary">Subtotal</span>
                  <span className="font-bold text-theme-text-primary">₹{summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-theme-text-secondary">GST (5%)</span>
                  <span className="font-bold text-theme-primary">₹{summary.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-theme-text-secondary">Round Off</span>
                  <span
                    className={`font-semibold ${
                      summary.roundOff > 0
                        ? "text-amber-600"
                        : summary.roundOff < 0
                        ? "text-theme-primary"
                        : "text-theme-text-secondary"
                    }`}
                  >
                    {summary.roundOff === 0
                      ? "₹0.00"
                      : `${summary.roundOff > 0 ? "+₹" : "-₹"}${Math.abs(summary.roundOff).toFixed(2)} ${
                          summary.roundOff > 0 ? "added" : "deducted"
                        }`}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-theme-border pt-3 mt-3">
                  <span className="font-bold text-theme-text-primary">Total Payable</span>
                  <span className="text-xl font-bold text-theme-primary">₹{summary.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-theme-border bg-theme-surface px-5 py-4 shadow-sm md:col-span-2 lg:col-span-2">
              <label className="block text-sm font-semibold text-theme-text-primary mb-2">Terms & Conditions</label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Add any terms and conditions to appear on the challan"
                className="w-full px-4 py-3 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-theme-text-primary shadow-sm"
              />
            </div>
           </div>
          <div className="mt-4 rounded-lg border border-theme-border bg-theme-surface px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <p className="text-sm font-semibold text-theme-text-primary">Challan Details</p>
              <span className="text-xs text-theme-text-secondary">HSN code is auto-applied to the challan header</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">HSN Code</label>
                <div className="w-full px-4 py-2.5 border border-theme-input-border rounded-lg bg-theme-surface-2 text-sm shadow-sm text-theme-text-secondary font-semibold">
                  481920
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">Inventory Type</label>
                <select
                  value={inventoryType}
                  onChange={(e) => setInventoryType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                >
                  <option value="subtract">Dispatch / Subtract from Inventory</option>
                  <option value="add">Add to Inventory (New Stock)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">Challan Tax Type</label>
                <select
                  value={challanTaxType}
                  onChange={(e) => setChallanTaxType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                >
                  <option value="GST">GST Challan (5% GST Applied)</option>
                  <option value="NON_GST">Non-GST Challan (No GST)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-theme-border bg-theme-surface px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <p className="text-sm font-semibold text-theme-text-primary">Payment & Additional Info (optional)</p>
              <span className="text-xs text-theme-text-secondary">Included in the challan footer</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-4 py-2.5 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                >
                  <option value="">Not Specified</option>
                  <option value="Cash">Cash</option>
                  <option value="GPay">GPay</option>
                  <option value="Bank Account">Bank Account</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">Remarks</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any additional remarks for this challan (optional)"
                  className="w-full px-4 py-3 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-theme-border bg-theme-surface px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <p className="text-sm font-semibold text-theme-text-primary">Client Details (optional)</p>
              <span className="text-xs text-theme-text-secondary">Shown beneath the Prepared By section on the PDF</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">Client Name</label>
                <div className="relative client-search-container">
                  <input
                    type="text"
                    value={clientSearchQuery || clientDetails.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientSearchQuery(val);
                      updateClientDetails("name", val);
                      handleClientSearch(val);
                    }}
                    onFocus={() => {
                      if (clientSearchResults.length > 0) {
                        setShowClientDropdown(true);
                      }
                    }}
                    placeholder="e.g. ABC Pvt. Ltd. (Start typing to search)"
                    className="w-full px-4 py-2.5 border border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-theme-surface text-sm shadow-sm"
                  />
                  {searchingClients && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B5B4F]">Searching...</span>
                  )}
                </div>

                {/* Client suggestions dropdown */}
                <AnimatePresence>
                  {showClientDropdown && clientSearchResults.length > 0 && (
                    <motion.div
                      className="absolute z-50 w-full mt-1 bg-white border-2 border-[#D4AF37] rounded-lg shadow-lg max-h-60 overflow-y-auto"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {clientSearchResults.map((client, idx) => (
                        <motion.button
                          key={idx}
                          onClick={() => selectClientFromSearch(client)}
                          className="w-full px-4 py-2.5 text-left hover:bg-theme-surface-2 transition-colors border-b border-theme-border last:border-b-0"
                          whileHover={{ paddingLeft: 20 }}
                        >
                          <div className="text-sm font-semibold text-theme-text-primary">{client.name}</div>
                          {client.mobile && (
                            <div className="text-xs text-theme-text-secondary">📞 {client.mobile}</div>
                          )}
                          {client.usageCount && (
                            <div className="text-xs text-theme-text-secondary">Used {client.usageCount} times</div>
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">Mobile Number</label>
                <input
                  type="text"
                  value={clientDetails.mobile}
                  onChange={(e) => updateClientDetails("mobile", e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">Address</label>
                <textarea
                  rows={2}
                  value={clientDetails.address}
                  onChange={(e) => updateClientDetails("address", e.target.value)}
                  placeholder="Street, City, State, ZIP"
                  className="w-full px-4 py-2.5 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-theme-text-secondary">GST Number</label>
                <input
                  type="text"
                  value={clientDetails.gstNumber}
                  onChange={(e) => updateClientDetails("gstNumber", e.target.value)}
                  placeholder="27ABCDE1234F1Z5"
                  className="w-full px-4 py-2.5 border border-theme-input-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-transparent bg-theme-surface text-sm shadow-sm"
                />
              </div>
            </div>
          </div>
         </div>
       )}

      {showClientBatchPanel && (
        <div className="mt-6 rounded-lg border border-dashed border-theme-input-border bg-theme-surface px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-theme-text-primary">Client Batch (multi‑challan)</p>
              <p className="text-xs text-theme-text-secondary">
                Save this client’s lines, then repeat for other clients and generate all challans together.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={!hasAnyRows}
                title={hasAnyRows ? "" : "Select audits or add manual items above to enable"}
                onClick={handleSaveNewBatch}
                className="px-4 py-2 rounded-lg border border-theme-input-border text-theme-text-secondary text-xs font-semibold hover:bg-theme-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add as New Client
              </button>
              {clientBatches.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className="px-3 py-2 rounded-lg border border-theme-input-border bg-theme-surface text-xs"
                    value={appendTargetBatchId}
                    onChange={(e) => setAppendTargetBatchId(e.target.value)}
                  >
                    <option value="">Add current selection to…</option>
                    {clientBatches.map((batch) => {
                      const optionId = getBatchId(batch);
                      return (
                        <option key={optionId || batch.label} value={optionId || ""}>
                          {batch.label}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    disabled={!hasAnyRows || !appendTargetBatchId}
                    title={
                      hasAnyRows
                        ? appendTargetBatchId
                          ? ""
                          : "Choose a client batch to append to"
                        : "Select audits or manual items first"
                    }
                    onClick={handleAppendToExistingBatch}
                    className="px-4 py-2 rounded-lg border border-red-200 text-theme-primary text-xs font-semibold hover:bg-theme-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to Existing
                  </button>
                </div>
              )}
            </div>
          </div>

          {loadingBatches ? (
            <p className="text-xs text-theme-text-secondary mt-3">Loading pending client batches...</p>
          ) : clientBatches.length === 0 ? (
            <p className="text-xs text-theme-text-secondary mt-3">
              No clients batched yet. Add the current client selection to start batching.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-semibold text-theme-text-muted uppercase tracking-wide">
                Pending Client Challans ({clientBatches.length})
              </div>
              {clientBatches.map((batch, idx) => {
                const batchId = getBatchId(batch);
                const batchAudits = (batch.auditIds || []).map((id) => {
                  const audit = candidates.find((c) => c._id === id);
                  const line = (batch.lineItems || []).find((li) => String(li.auditId) === String(id));
                  return { id, audit, line };
                });
                return (
                  <div
                    key={batchId || idx}
                    className="rounded-xl border border-theme-border bg-theme-surface px-4 py-3 space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1 text-xs text-theme-text-primary">
                        <div className="font-semibold text-sm text-theme-text-primary">
                          {idx + 1}. {batch.label}
                        </div>
                        <div className="text-theme-text-secondary">
                          Audits:{" "}
                          <span className="font-semibold">
                            {batch.auditIds?.length || 0}
                          </span>{" "}
                          • Manual:{" "}
                          <span className="font-semibold">
                            {Array.isArray(batch.manualItems)
                              ? batch.manualItems.length
                              : 0}
                          </span>
                        </div>
                        <div className="text-xs text-theme-text-muted">
                          HSN: {batch.hsnCode || "N/A"} • Terms:{" "}
                          {batch.terms
                            ? `${batch.terms.slice(0, 40)}${
                                batch.terms.length > 40 ? "..." : ""
                              }`
                            : "N/A"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => batchId && handleRemoveClientBatch(batchId)}
                        className="text-xs text-theme-primary hover:text-theme-primary-dark"
                      >
                        Remove Client
                      </button>
                    </div>
                    {batchAudits.length > 0 && (
                      <div className="mt-2 border-t border-dashed border-theme-border pt-2">
                        <div className="text-xs font-semibold text-theme-text-secondary mb-1">
                          Audits in this client
                        </div>
                        <div className="space-y-1 max-h-40 overflow-auto pr-1">
                          {batchAudits.map(({ id, audit, line }) => (
                            <div
                              key={id}
                              className="flex items-center justify-between gap-2 text-xs text-theme-text-primary"
                            >
                              <div className="flex-1">
                                <div className="font-semibold">
                                    {audit?.box?.title || line?.boxSnapshot?.title || "Unknown box"}
                                </div>
                                <div className="text-xs text-theme-text-secondary">
                                    Code: {audit?.box?.code || line?.boxSnapshot?.code || "-"} • Color:{" "}
                                    {line?.color || audit?.color || "-"}
                                  {" • Qty: "}
                                  {line?.quantity ?? audit?.quantity ?? 0}
                                </div>
                              </div>
                              {clientBatches.length > 1 && (
                                <select
                                  className="text-xs border border-theme-input-border rounded-lg px-1 py-0.5 bg-theme-surface"
                                  onChange={(e) => {
                                    const targetId = e.target.value;
                                    if (!targetId) return;
                                      if (!batchId) return;
                                      handleMoveAuditToBatch(id, batchId, targetId);
                                    e.target.value = "";
                                  }}
                                  defaultValue=""
                                >
                                  <option value="">Move to...</option>
                                  {clientBatches
                                      .filter((b) => getBatchId(b) !== batchId)
                                      .map((other) => {
                                        const otherId = getBatchId(other);
                                        return (
                                          <option key={otherId} value={otherId || ""}>
                                            {other.label}
                                          </option>
                                        );
                                      })}
                                </select>
                              )}
                              <button
                                type="button"
                                  onClick={() => batchId && handleRemoveAuditFromClientBatch(batchId, id)}
                                className="text-[10px] text-[#A01F24] hover:text-[#7B1518]"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* Candidates table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border border-theme-border rounded-lg overflow-hidden text-xs sm:text-sm">
            <thead className="bg-theme-surface-2 text-theme-text-primary uppercase tracking-wide font-semibold">
              <tr>
                <th className="px-4 py-3 w-12">
                  <button onClick={toggleAll} className="text-theme-primary">
                    {allSelected ? <FiCheckSquare /> : <FiSquare />}
                  </button>
                </th>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">User</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Box</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Category</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Code</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Color</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Quantity</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-[#2D1B0E] poppins font-medium" colSpan={7}>Loading candidates...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-[#2D1B0E] poppins font-medium" colSpan={7}>No candidates available</td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a._id} className="border-t border-[#E8DCC6]">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleOne(a._id)} className="text-[#C1272D]">
                        {selected[a._id] ? <FiCheckSquare /> : <FiSquare />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#2D1B0E] whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#2D1B0E] whitespace-nowrap">{a.user?.name || a.user?.email}</td>
                    <td className="px-4 py-3 text-[#2D1B0E]">{a.box?.title}</td>
                    <td className="px-4 py-3 text-[#2D1B0E]">{a.box?.category}</td>
                    <td className="px-4 py-3 text-[#2D1B0E] font-mono whitespace-nowrap">{a.box?.code}</td>
                    <td className="px-4 py-3 text-[#2D1B0E]">
                      <span className="px-2 py-1 rounded-full bg-[#FBE8E7] text-[#C1272D] text-xs font-semibold border border-[#F3C4C1]">
                        {a.color || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#2D1B0E] font-semibold">{a.quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Action */}
        <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
          {inventoryType === "add" ? (
            <motion.button
              onClick={handleGenerate}
              disabled={submitting}
              className="px-6 py-3 bg-linear-to-r from-[#10B981] via-[#059669] to-[#10B981] text-white rounded-xl font-semibold poppins shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed w-full md:w-auto text-center"
              whileHover={{ scale: submitting ? 1 : 1.02, y: submitting ? 0 : -2 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
            >
              <motion.div
                className="absolute inset-0 bg-linear-to-r from-transparent via-[#D4AF37]/30 to-transparent"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.6 }}
              />
              <span className="relative z-10">
                {submitting ? "Adding to Inventory..." : "✅ Add to Inventory (Current Client)"}
              </span>
            </motion.button>
          ) : (
            <motion.button
              onClick={handleGenerate}
              disabled={submitting}
              className="px-6 py-3 bg-linear-to-r from-[#C1272D] via-[#A01F24] to-[#C1272D] text-white rounded-xl font-semibold poppins shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed w-full md:w-auto text-center"
              whileHover={{ scale: submitting ? 1 : 1.02, y: submitting ? 0 : -2 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
            >
              <motion.div
                className="absolute inset-0 bg-linear-to-r from-transparent via-[#D4AF37]/30 to-transparent"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.6 }}
              />
              <span className="relative z-10">
                {submitting ? "Generating..." : "📄 Generate Challan (Current Client)"}
              </span>
            </motion.button>
          )}
          {clientBatches.length > 0 && (
            <motion.button
              onClick={async () => {
                if (!clientBatches.length) return;
                setSubmitting(true);
                const created = [];
                try {
                  for (const batch of clientBatches) {
                    const batchId = getBatchId(batch);
                    try {
                      const challan = await createChallan(batch);
                      created.push(challan);
                      if (batchId) {
                        try {
                          await removeClientBatchApi(batchId);
                        } catch (cleanupError) {
                          console.error("Failed to remove client batch after challan generation", cleanupError);
                        }
                      }
                    } catch (e) {
                      const msg =
                        e?.response?.data?.message ||
                        `Failed to create challan for ${batch.label}`;
                      toast.error(msg);
                    }
                  }
                  if (created.length) {
                    const numbers = created
                      .map((c) => c.number)
                      .filter(Boolean)
                      .join(", ");
                    toast.success(
                      `Created ${created.length} challan(s)${
                        numbers ? `: ${numbers}` : ""
                      }`
                    );
                  }
                  await loadClientBatchesFromServer();
                  await loadData();
                  await loadChallans();
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              className="px-6 py-3 bg-theme-surface text-theme-text-secondary rounded-lg font-semibold border-2 border-theme-input-border shadow-sm hover:bg-theme-surface-2 disabled:opacity-60 disabled:cursor-not-allowed w-full md:w-auto text-center"
              whileHover={{ scale: submitting ? 1 : 1.02, y: submitting ? 0 : -2 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
            >
              Generate All Challans ({clientBatches.length})
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Client-wise challan summary + Recent challans */}
      <motion.div
        className="dashboard-card hover-lift mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="card-header mb-6">
          <h3 className="card-header-title">Client-wise Challan Summary</h3>
        </div>
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full text-left border border-theme-border rounded-lg overflow-hidden text-xs sm:text-sm bg-theme-surface">
            <thead style={{ background: "var(--theme-table-header-bg)" }} className="text-theme-table-header-text font-semibold">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Challans</th>
                <th className="px-4 py-3">Total Items</th>
                <th className="px-4 py-3">Last Challan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {loadingChallans ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-4 text-center text-theme-text-secondary text-sm"
                  >
                    Loading...
                  </td>
                </tr>
              ) : clientChallanSummary.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-4 text-center text-theme-text-secondary text-sm"
                  >
                    No challans yet.
                  </td>
                </tr>
              ) : (
                clientChallanSummary.map((g, idx) => (
                  <tr key={g.clientName} className="border-t border-theme-border transition-colors hover:bg-theme-row-hover">
                    <td className="px-4 py-3 text-xs sm:text-sm text-theme-text-primary font-semibold">
                      {g.clientName}
                    </td>
                    <td className="px-4 py-3 text-xs sm:text-sm text-theme-text-primary font-bold">
                      {g.challanCount}
                    </td>
                    <td className="px-4 py-3 text-xs sm:text-sm text-theme-text-primary font-bold">
                      {g.totalItems}
                    </td>
                    <td className="px-4 py-3 text-xs sm:text-sm text-theme-text-secondary">
                      {g.latestDate ? g.latestDate.toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3 className="text-2xl font-bold playfair text-theme-primary mb-4">Recent Challans</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border border-theme-border rounded-lg overflow-hidden bg-theme-surface">
            <thead style={{ background: "var(--theme-table-header-bg)" }} className="text-theme-table-header-text font-semibold">
              <tr>
                <th className="px-4 py-3 text-sm">Number</th>
                <th className="px-4 py-3 text-sm">Client</th>
                <th className="px-4 py-3 text-sm">Created</th>
                <th className="px-4 py-3 text-sm">Items</th>
                <th className="px-4 py-3 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {loadingChallans ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-theme-text-secondary poppins font-medium"
                    colSpan={5}
                  >
                    Loading...
                  </td>
                </tr>
              ) : recentChallans.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-theme-text-secondary poppins font-medium"
                    colSpan={5}
                  >
                    No challans yet
                  </td>
                </tr>
              ) : (
                recentChallans.map((c) => (
                  <tr key={c._id} className="border-t border-theme-border hover:bg-theme-surface-2 transition-colors">
                    <td className="px-4 py-3 text-sm text-theme-text-primary font-mono">{c.number}</td>
                    <td className="px-4 py-3 text-sm text-theme-text-primary">
                      {(c.clientDetails?.name || "").trim() || "Unnamed Client"}
                    </td>
                    <td className="px-4 py-3 text-sm text-theme-text-secondary">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-theme-text-secondary">
                      {c.items?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => downloadPdf(c._id, c.number)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold shadow-md hover:shadow-lg hover:bg-red-700 transition-all"
                        title="Download PDF"
                      >
                        <FiDownload size={14} /> Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default ChallanGeneration;






