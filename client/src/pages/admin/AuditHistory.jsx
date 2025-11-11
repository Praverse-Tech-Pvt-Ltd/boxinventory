import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiSearch } from "react-icons/fi";
import { getAllAudits } from "../../services/boxService";

const AuditHistory = () => {
  const [audits, setAudits] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadAudits = async () => {
      try {
        setLoadingAudits(true);
        const data = await getAllAudits();
        setAudits(data);
      } finally {
        setLoadingAudits(false);
      }
    };
    loadAudits();
  }, []);

  const filteredAudits = useMemo(() => {
    if (!searchQuery.trim()) return audits;
    const q = searchQuery.toLowerCase();
    return audits.filter((a) => {
      const userNameOrEmail = (a.user?.name || a.user?.email || "").toLowerCase();
      const qty = String(a.quantity || "").toLowerCase();
      const title = (a.box?.title || "").toLowerCase();
      const category = (a.box?.category || "").toLowerCase();
      const code = (a.box?.code || "").toLowerCase();
      return (
        userNameOrEmail.includes(q) ||
        qty.includes(q) ||
        title.includes(q) ||
        category.includes(q) ||
        code.includes(q)
      );
    });
  }, [audits, searchQuery]);

  return (
    <div className="w-full space-y-6">
      <div className="bg-gradient-to-br from-[#F5F1E8] via-white to-[#F4E4BC]/30 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-6">Audit History</h3>

        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#5D3A00]/50" size={20} />
          <input
            type="text"
            placeholder="Search by user, quantity, box name, category, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
          />
        </div>

        <div className="mt-6">
          {loadingAudits ? (
            <div className="text-center py-10 text-[#5D3A00]/60 poppins">Loading audits...</div>
          ) : filteredAudits.length === 0 ? (
            <div className="text-center py-10 text-[#5D3A00]/60 poppins">No audits found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden">
                <thead className="bg-[#F4E4BC] text-[#5D3A00]">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-sm font-semibold">User</th>
                    <th className="px-4 py-3 text-sm font-semibold">Quantity Subtracted</th>
                    <th className="px-4 py-3 text-sm font-semibold">Box</th>
                    <th className="px-4 py-3 text-sm font-semibold">Category</th>
                    <th className="px-4 py-3 text-sm font-semibold">Code</th>
                  </tr>
                </thead>
                <tbody className="bg-white/80">
                  {filteredAudits.map((a) => (
                    <tr key={a._id} className="border-t border-[#E8DCC6]">
                      <td className="px-4 py-3 text-sm text-[#5D3A00]">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5D3A00]">
                        {a.user?.name || a.user?.email || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5D3A00] font-semibold">{a.quantity}</td>
                      <td className="px-4 py-3 text-sm text-[#5D3A00]">{a.box?.title || "-"}</td>
                      <td className="px-4 py-3 text-sm text-[#5D3A00]">{a.box?.category || "-"}</td>
                      <td className="px-4 py-3 text-sm text-[#5D3A00] font-mono">{a.box?.code || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditHistory;


