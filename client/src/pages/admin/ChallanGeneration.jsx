import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiSearch, FiCheckSquare, FiSquare, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getChallanCandidates, createChallan, downloadChallanCsv, listChallans } from "../../services/challanService";

const ChallanGeneration = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [recentChallans, setRecentChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(true);

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
      const challan = await createChallan({ auditIds, notes });
      toast.success(`Challan ${challan.number} created`);
      setSelected({});
      setNotes("");
      await loadData();
      await loadChallans();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create challan");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCsv = async (id, number) => {
    try {
      const blob = await downloadChallanCsv(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${number}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download challan");
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="bg-gradient-to-br from-[#F5F1E8] via-white to-[#F4E4BC]/30 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-6">Challan Generation</h3>

        {/* Search */}
        <div className="relative mb-4">
          <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#5D3A00]/50" size={20} />
          <input
            type="text"
            placeholder="Search by user, box name, code, category, or quantity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
          />
        </div>

        {/* Candidates table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden">
            <thead className="bg-[#F4E4BC] text-[#5D3A00]">
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
            <tbody className="bg-white/80">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-[#5D3A00]/60 poppins" colSpan={7}>Loading candidates...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-[#5D3A00]/60 poppins" colSpan={7}>No candidates available</td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a._id} className="border-t border-[#E8DCC6]">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleOne(a._id)} className="text-[#C1272D]">
                        {selected[a._id] ? <FiCheckSquare /> : <FiSquare />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00]">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00]">{a.user?.name || a.user?.email}</td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00]">{a.box?.title}</td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00]">{a.box?.category}</td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00] font-mono">{a.box?.code}</td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00] font-semibold">{a.quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Notes and action */}
        <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for this challan"
            className="flex-1 px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00]"
          />
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
      <div className="bg-gradient-to-br from-[#F5F1E8] via-white to-[#F4E4BC]/30 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-4">Recent Challans</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden">
            <thead className="bg-[#F4E4BC] text-[#5D3A00]">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold">Number</th>
                <th className="px-4 py-3 text-sm font-semibold">Created</th>
                <th className="px-4 py-3 text-sm font-semibold">Items</th>
                <th className="px-4 py-3 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white/80">
              {loadingChallans ? (
                <tr><td className="px-4 py-6 text-center text-[#5D3A00]/60 poppins" colSpan={4}>Loading...</td></tr>
              ) : recentChallans.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-[#5D3A00]/60 poppins" colSpan={4}>No challans yet</td></tr>
              ) : (
                recentChallans.map(c => (
                  <tr key={c._id} className="border-t border-[#E8DCC6]">
                    <td className="px-4 py-3 text-sm text-[#5D3A00] font-mono">{c.number}</td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00]">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-[#5D3A00]">{c.items?.length || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => downloadCsv(c._id, c.number)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#C1272D]/90 text-white text-xs font-semibold shadow-md hover:bg-[#A01F24]"
                        title="Download CSV"
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


