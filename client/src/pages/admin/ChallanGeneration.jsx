import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiSearch, FiCheckSquare, FiSquare, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getChallanCandidates, createChallan, downloadChallanPdf, listChallans } from "../../services/challanService";

const ChallanGeneration = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [recentChallans, setRecentChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(true);
   const [editRows, setEditRows] = useState({});
  const [includeGST, setIncludeGST] = useState(true);

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

  useEffect(() => {
    loadData();
    loadChallans();
  }, []);

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
             colours: Array.isArray(audit.box?.colours) ? [...audit.box.colours] : [],
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

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter((a) => {
      const user = (a.user?.name || a.user?.email || "").toLowerCase();
      const title = (a.box?.title || "").toLowerCase();
      const code = (a.box?.code || "").toLowerCase();
      const category = (a.box?.category || "").toLowerCase();
      const qty = String(a.quantity || "").toLowerCase();
      return user.includes(q) || title.includes(q) || code.includes(q) || category.includes(q) || qty.includes(q);
    });
  }, [candidates, searchQuery]);

  const allSelected = useMemo(() => filtered.length > 0 && filtered.every(a => selected[a._id]), [filtered, selected]);
  const toggleAll = () => {
    if (allSelected) {
      const copy = { ...selected };
      filtered.forEach(a => { delete copy[a._id]; });
      setSelected(copy);
    } else {
      const copy = { ...selected };
      filtered.forEach(a => { copy[a._id] = true; });
      setSelected(copy);
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
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

  const summary = useMemo(() => {
    const subtotal = selectedRows.reduce((sum, row) => sum + row.total, 0);
    const totalQty = selectedRows.reduce((sum, row) => sum + row.qty, 0);
    const gstAmount = includeGST ? subtotal * 0.18 : 0;
    return {
      subtotal,
      totalQty,
      gstAmount,
      grandTotal: subtotal + gstAmount,
    };
  }, [selectedRows, includeGST]);

  const handleGenerate = async () => {
    const auditIds = Object.keys(selected).filter(id => selected[id]);
    if (auditIds.length === 0) {
      toast.error("Select at least one item");
      return;
    }
    try {
      setSubmitting(true);
      const lineItems = auditIds.map((id) => {
        const r = editRows[id] || {};
        return {
          auditId: id,
          cavity: r.cavity || "",
          quantity: Number(r.quantity || 0),
          rate: Number(r.rate || 0),
          assemblyCharge: Number(r.assemblyCharge || 0),
          packagingCharge: Number(r.packagingCharge || 0),
          colours: Array.isArray(r.colours) ? r.colours : [],
        };
      });
      const challan = await createChallan({ auditIds, notes, lineItems, includeGST });
      toast.success(`Challan ${challan.number} created`);
      setSelected({});
      setNotes("");
      setEditRows({});
      setIncludeGST(true);
      await loadData();
      await loadChallans();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create challan");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdf = async (id, number, includeGSTFlag) => {
    try {
      const blob = await downloadChallanPdf(id, includeGSTFlag);
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
    <div className="w-full space-y-6">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-4 sm:p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#D4AF37] to-transparent" />
        <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-6">Challan Generation</h3>

        {/* Search */}
        <div className="relative mb-4">
          <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B5B4F]" size={20} />
          <input
            type="text"
            placeholder="Search by user, box name, code, category, or quantity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] placeholder:text-[#8B7355] transition-all duration-300"
          />
        </div>

      {/* Preview/Edit selected lines */}
      {selectedRows.length > 0 && (
         <div className="mt-6 bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-4 sm:p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#D4AF37] to-transparent" />
          <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-4">Challan Preview (Editable)</h3>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="rounded-2xl border border-[#E8DCC6] bg-[#FDF9EE] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#C1272D]/80 font-semibold">Items Selected</p>
              <p className="mt-1 text-2xl font-bold text-[#2D1B0E]">{selectedRows.length}</p>
            </div>
            <div className="rounded-2xl border border-[#E8DCC6] bg-[#EEF7FF] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#2563EB]/70 font-semibold">Total Quantity</p>
              <p className="mt-1 text-2xl font-bold text-[#2D1B0E]">{summary.totalQty}</p>
            </div>
            <div className="rounded-2xl border border-[#E8DCC6] bg-[#F9F5FF] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#7C3AED]/70 font-semibold">Subtotal</p>
              <p className="mt-1 text-2xl font-bold text-[#2D1B0E]">₹{summary.subtotal.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-[#E8DCC6] bg-[#F4E4BC]/70 px-4 py-3 flex flex-col justify-between">
              <p className="text-xs uppercase tracking-wide text-[#7C5A1F]/80 font-semibold">GST Mode</p>
              <div className="mt-2 flex items-center gap-3 text-sm text-[#2D1B0E]">
                <span className="px-3 py-1 rounded-full bg-white/80 font-semibold">{includeGST ? "With GST" : "Without GST"}</span>
                <span className="text-xs text-[#6B5B4F]">Adjust below</span>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <span className="text-sm font-semibold text-[#2D1B0E] uppercase tracking-wide">GST Preference</span>
            <label className="inline-flex items-center gap-2 text-sm text-[#2D1B0E] bg-[#FDF9EE] px-3 py-1.5 rounded-full border border-[#E8DCC6] shadow-sm cursor-pointer hover:border-[#D4AF37] transition-colors">
               <input
                 type="radio"
                 name="gstOption"
                 checked={includeGST === true}
                 onChange={() => setIncludeGST(true)}
               />
              With GST (adds 18%)
             </label>
            <label className="inline-flex items-center gap-2 text-sm text-[#2D1B0E] bg-[#FDF9EE] px-3 py-1.5 rounded-full border border-[#E8DCC6] shadow-sm cursor-pointer hover:border-[#D4AF37] transition-colors">
               <input
                 type="radio"
                 name="gstOption"
                 checked={includeGST === false}
                 onChange={() => setIncludeGST(false)}
               />
              Without GST
             </label>
           </div>
           <div className="overflow-x-auto">
             <table className="min-w-full text-left border border-[#F0E5CF] rounded-2xl overflow-hidden shadow-sm">
              <thead className="bg-linear-to-r from-[#F4E4BC] via-[#F9F1D6] to-[#F4E4BC] text-[#2D1B0E] uppercase tracking-wide text-xs">
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
              <tbody className="bg-white divide-y divide-[#F0E5CF]">
                {selectedRows.map(({ audit, edit, idx, qty, rate, assembly, packaging, total }) => (
                  <tr key={audit._id} className="align-top hover:bg-[#FFF9EF] transition-colors">
                    <td className="px-4 py-4 text-sm font-semibold text-[#C1272D]">{idx + 1}</td>
                    <td className="px-4 py-4 text-sm text-[#2D1B0E]">
                      <div className="font-semibold">{audit.box?.title}</div>
                      <p className="text-xs text-[#6B5B4F] mt-1">Auto-rate prefilled from box price, adjust if needed.</p>
                    </td>
                    <td className="px-4 py-4 text-sm">
                           <input
                             type="text"
                        value={edit.cavity ?? ""}
                        onChange={(e) => updateRow(audit._id, { cavity: e.target.value })}
                        className="w-full sm:w-48 px-3 py-2 border border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white text-sm shadow-sm"
                           />
                         </td>
                    <td className="px-4 py-4 text-sm font-mono text-[#2D1B0E]">{audit.box?.code}</td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {(edit.colours || []).map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#FBE8E7] text-[#C1272D] text-xs border border-[#F3C4C1] shadow-sm">
                            {c}
                            <button className="text-[#A01F24] hover:text-[#7B1518]" onClick={() => removeColour(audit._id, c)}>✕</button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          placeholder="Add colour"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              addColour(audit._id, e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white text-sm shadow-sm"
                        />
                        <button
                          onClick={(e) => {
                            const input = e.currentTarget.previousSibling;
                            if (input && input.value) {
                              addColour(audit._id, input.value);
                              input.value = "";
                            }
                          }}
                          className="px-3 py-2 rounded-lg bg-[#C1272D] text-white text-xs font-semibold shadow hover:bg-[#A01F24] transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.quantity ?? 0}
                        onChange={(e) => updateRow(audit._id, { quantity: Number(e.target.value) })}
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.rate ?? 0}
                        onChange={(e) => updateRow(audit._id, { rate: Number(e.target.value) })}
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.assemblyCharge ?? 0}
                        onChange={(e) => updateRow(audit._id, { assemblyCharge: Number(e.target.value) })}
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      <input
                        type="number"
                        min="0"
                        value={edit.packagingCharge ?? 0}
                        onChange={(e) => updateRow(audit._id, { packagingCharge: Number(e.target.value) })}
                        className="w-full sm:w-24 ml-auto px-3 py-2 border border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white text-right text-sm shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-right text-[#C1272D]">₹{total.toFixed(2)}</td>
                  </tr>
                ))}
               </tbody>
             </table>
           </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#E8DCC6] bg-[#FFF9EF] px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[#6B5B4F] font-semibold">Summary</p>
              <div className="mt-3 space-y-2 text-sm text-[#2D1B0E]">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹{summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>GST (18%)</span>
                  <span className="font-semibold text-[#2563EB]">₹{summary.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-[#E8DCC6] pt-2">
                  <span className="font-semibold text-[#C1272D]">Grand Total</span>
                  <span className="text-lg font-bold text-[#C1272D]">₹{summary.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[#E8DCC6] bg-white px-5 py-4 shadow-sm md:col-span-2 lg:col-span-2">
              <label className="block text-sm font-semibold text-[#2D1B0E] mb-2">Terms & Conditions</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any terms and conditions to appear on the challan"
                className="w-full px-4 py-3 border border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] shadow-inner"
              />
            </div>
           </div>
         </div>
       )}

        {/* Candidates table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden text-xs sm:text-sm">
            <thead className="bg-[#F4E4BC] text-[#2D1B0E] uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold w-12">
                  <button onClick={toggleAll} className="text-[#C1272D]">
                    {allSelected ? <FiCheckSquare /> : <FiSquare />}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">User</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Box</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Category</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Code</th>
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
                    <td className="px-4 py-3 text-[#2D1B0E] font-semibold">{a.quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Action */}
        <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
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
            <span className="relative z-10">{submitting ? "Generating..." : "Generate Challan"}</span>
          </motion.button>
        </div>
      </div>

      {/* Recent challans */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-4 sm:p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#D4AF37] to-transparent" />
        <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-4">Recent Challans</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden">
            <thead className="bg-[#F4E4BC] text-[#2D1B0E]">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold">Number</th>
                <th className="px-4 py-3 text-sm font-semibold">Created</th>
                <th className="px-4 py-3 text-sm font-semibold">Items</th>
                <th className="px-4 py-3 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loadingChallans ? (
                <tr><td className="px-4 py-6 text-center text-[#2D1B0E] poppins font-medium" colSpan={4}>Loading...</td></tr>
              ) : recentChallans.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-[#2D1B0E] poppins font-medium" colSpan={4}>No challans yet</td></tr>
              ) : (
                recentChallans.map(c => (
                  <tr key={c._id} className="border-t border-[#E8DCC6]">
                    <td className="px-4 py-3 text-sm text-[#2D1B0E] font-mono">{c.number}</td>
                    <td className="px-4 py-3 text-sm text-[#2D1B0E]">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-[#2D1B0E]">{c.items?.length || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => downloadPdf(c._id, c.number, c.includeGST !== false)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#C1272D]/90 text-white text-xs font-semibold shadow-md hover:bg-[#A01F24]"
                        title="Download PDF"
                      >
                        <FiDownload /> Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChallanGeneration;


