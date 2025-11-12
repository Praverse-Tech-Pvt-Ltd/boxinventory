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
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
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
       {Object.keys(selected).some(id => selected[id]) && (
         <div className="mt-6 bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
           <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-4">Challan Preview (Editable)</h3>
           <div className="mb-4 flex items-center gap-4">
             <span className="text-sm font-semibold text-[#2D1B0E]">GST:</span>
             <label className="inline-flex items-center gap-2 text-sm text-[#2D1B0E]">
               <input
                 type="radio"
                 name="gstOption"
                 checked={includeGST === true}
                 onChange={() => setIncludeGST(true)}
               />
               With GST
             </label>
             <label className="inline-flex items-center gap-2 text-sm text-[#2D1B0E]">
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
             <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden">
               <thead className="bg-[#F4E4BC] text-[#2D1B0E]">
                 <tr>
                   <th className="px-4 py-3 text-sm font-semibold">Sr. No.</th>
                   <th className="px-4 py-3 text-sm font-semibold">Item</th>
                   <th className="px-4 py-3 text-sm font-semibold">Cavity (Inner Size)</th>
                   <th className="px-4 py-3 text-sm font-semibold">Code</th>
                   <th className="px-4 py-3 text-sm font-semibold">Colours</th>
                   <th className="px-4 py-3 text-sm font-semibold">Qty</th>
                   <th className="px-4 py-3 text-sm font-semibold">Rate</th>
                   <th className="px-4 py-3 text-sm font-semibold">Assembly</th>
                   <th className="px-4 py-3 text-sm font-semibold">Packaging</th>
                   <th className="px-4 py-3 text-sm font-semibold">Total</th>
                 </tr>
               </thead>
               <tbody className="bg-white">
                 {candidates
                   .filter(a => selected[a._id])
                   .map((a, idx) => {
                     const r = editRows[a._id] || {};
                     const qty = Number(r.quantity || 0);
                     const total = (Number(r.rate || 0) + Number(r.assemblyCharge || 0) + Number(r.packagingCharge || 0)) * qty;
                     return (
                       <tr key={a._id} className="border-t border-[#E8DCC6] align-top">
                         <td className="px-4 py-3 text-sm">{idx + 1}</td>
                         <td className="px-4 py-3 text-sm">{a.box?.title}</td>
                         <td className="px-4 py-3 text-sm">
                           <input
                             type="text"
                             value={r.cavity ?? ""}
                             onChange={(e) => updateRow(a._id, { cavity: e.target.value })}
                             className="w-44 px-3 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white"
                           />
                         </td>
                         <td className="px-4 py-3 text-sm font-mono">{a.box?.code}</td>
                         <td className="px-4 py-3 text-sm">
                           <div className="flex flex-wrap gap-2">
                             {(r.colours || []).map((c) => (
                               <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#F4E4BC] text-[#2D1B0E] text-xs border border-[#E8DCC6]">
                                 {c}
                                 <button className="text-[#C1272D]" onClick={() => removeColour(a._id, c)}>✕</button>
                               </span>
                             ))}
                           </div>
                           <div className="mt-2 flex gap-2">
                             <input
                               type="text"
                               placeholder="Add colour"
                               onKeyDown={(e) => {
                                 if (e.key === "Enter") {
                                   addColour(a._id, e.currentTarget.value);
                                   e.currentTarget.value = "";
                                 }
                               }}
                               className="w-40 px-3 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white"
                             />
                             <button
                               onClick={(e) => {
                                 const input = (e.currentTarget.previousSibling);
                                 if (input && input.value) {
                                   addColour(a._id, input.value);
                                   input.value = "";
                                 }
                               }}
                               className="px-3 py-2 rounded-lg bg-[#C1272D] text-white text-xs"
                             >
                               Add
                             </button>
                           </div>
                         </td>
                         <td className="px-4 py-3 text-sm">
                           <input
                             type="number"
                             min="0"
                             value={r.quantity ?? 0}
                             onChange={(e) => updateRow(a._id, { quantity: Number(e.target.value) })}
                             className="w-24 px-3 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white"
                           />
                         </td>
                         <td className="px-4 py-3 text-sm">
                           <input
                             type="number"
                             min="0"
                             value={r.rate ?? 0}
                             onChange={(e) => updateRow(a._id, { rate: Number(e.target.value) })}
                             className="w-24 px-3 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white"
                           />
                         </td>
                         <td className="px-4 py-3 text-sm">
                           <input
                             type="number"
                             min="0"
                             value={r.assemblyCharge ?? 0}
                             onChange={(e) => updateRow(a._id, { assemblyCharge: Number(e.target.value) })}
                             className="w-24 px-3 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white"
                           />
                         </td>
                         <td className="px-4 py-3 text-sm">
                           <input
                             type="number"
                             min="0"
                             value={r.packagingCharge ?? 0}
                             onChange={(e) => updateRow(a._id, { packagingCharge: Number(e.target.value) })}
                             className="w-24 px-3 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white"
                           />
                         </td>
                         <td className="px-4 py-3 text-sm font-semibold">{Number.isFinite(total) ? total.toFixed(2) : "0.00"}</td>
                       </tr>
                     );
                   })}
               </tbody>
             </table>
           </div>
           <div className="mt-4">
             <label className="block text-sm font-semibold text-[#2D1B0E] mb-2">Terms & Conditions</label>
             <textarea
               rows={3}
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               placeholder="Add any terms and conditions to appear on the challan"
               className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E]"
             />
           </div>
         </div>
       )}

        {/* Candidates table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden">
            <thead className="bg-[#F4E4BC] text-[#2D1B0E]">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold w-12">
                  <button onClick={toggleAll} className="text-[#C1272D]">
                    {allSelected ? <FiCheckSquare /> : <FiSquare />}
                  </button>
                </th>
                <th className="px-4 py-3 text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-sm font-semibold">User</th>
                <th className="px-4 py-3 text-sm font-semibold">Box</th>
                <th className="px-4 py-3 text-sm font-semibold">Category</th>
                <th className="px-4 py-3 text-sm font-semibold">Code</th>
                <th className="px-4 py-3 text-sm font-semibold">Quantity</th>
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
                    <td className="px-4 py-3 text-sm text-[#2D1B0E]">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-[#2D1B0E]">{a.user?.name || a.user?.email}</td>
                    <td className="px-4 py-3 text-sm text-[#2D1B0E]">{a.box?.title}</td>
                    <td className="px-4 py-3 text-sm text-[#2D1B0E]">{a.box?.category}</td>
                    <td className="px-4 py-3 text-sm text-[#2D1B0E] font-mono">{a.box?.code}</td>
                    <td className="px-4 py-3 text-sm text-[#2D1B0E] font-semibold">{a.quantity}</td>
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
            className="px-6 py-3 bg-gradient-to-r from-[#C1272D] via-[#A01F24] to-[#C1272D] text-white rounded-xl font-semibold poppins shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed"
            whileHover={{ scale: submitting ? 1 : 1.02, y: submitting ? 0 : -2 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent"
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.6 }}
            />
            <span className="relative z-10">{submitting ? "Generating..." : "Generate Challan"}</span>
          </motion.button>
        </div>
      </div>

      {/* Recent challans */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
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


