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
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-4 sm:p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-6">Audit History</h3>

        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B5B4F]" size={20} />
          <input
            type="text"
            placeholder="Search by user, quantity, box name, category, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] placeholder:text-[#8B7355] transition-all duration-300"
          />
        </div>

        <div className="mt-6">
          {loadingAudits ? (
            <div className="text-center py-10 text-[#2D1B0E] poppins font-medium">Loading audits...</div>
          ) : filteredAudits.length === 0 ? (
            <div className="text-center py-10 text-[#2D1B0E] poppins font-medium">No audits found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-2 border-[#E8DCC6] rounded-xl overflow-hidden text-xs sm:text-sm">
                <thead className="bg-[#F4E4BC] text-[#2D1B0E] uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">User</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Quantity</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Box</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Category</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Code</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredAudits.map((a) => (
                    <tr key={a._id} className="border-t border-[#E8DCC6]">
                      <td className="px-4 py-3 text-[#2D1B0E] whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[#2D1B0E] whitespace-nowrap">
                        {a.user?.name || a.user?.email || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-[#2D1B0E] font-semibold">{a.quantity}</td>
                      <td className="px-4 py-3 text-[#2D1B0E]">{a.box?.title || "-"}</td>
                      <td className="px-4 py-3 text-[#2D1B0E]">{a.box?.category || "-"}</td>
                      <td className="px-4 py-3 text-[#2D1B0E] font-mono whitespace-nowrap">{a.box?.code || "-"}</td>
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


