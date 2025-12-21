import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiSearch, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getAllAudits } from "../../services/boxService";
import { downloadChallanPdf, listChallans } from "../../services/challanService";

const AuditHistory = () => {
  const [audits, setAudits] = useState([]);
  const [challans, setChallans] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(""); // Client name filter

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingAudits(true);
        const [auditData, challanData] = await Promise.all([
          getAllAudits(),
          listChallans(),
        ]);
        setAudits(auditData);
        setChallans(challanData);
      } catch (e) {
        console.error("Failed to load audits or challans", e);
        toast.error("Failed to load audit history");
      } finally {
        setLoadingAudits(false);
      }
    };
    loadData();
  }, []);

  const handleDownload = async (challanId) => {
    if (!challanId) return;
    try {
      const blob = await downloadChallanPdf(challanId, true);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `challan-${challanId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to download challan PDF");
    }
  };

  // Get unique client names from challans with clientDetails
  const clientsList = useMemo(() => {
    const clients = new Set();
    challans.forEach((c) => {
      if (c.clientDetails?.name) {
        clients.add(c.clientDetails.name);
      }
    });
    return Array.from(clients).sort();
  }, [challans]);

  // Create a map of challan IDs to client names for quick lookup
  const challanToClientMap = useMemo(() => {
    const map = new Map();
    challans.forEach((c) => {
      if (c._id) {
        map.set(String(c._id), c.clientDetails?.name || null);
      }
    });
    return map;
  }, [challans]);

  const filteredAudits = useMemo(() => {
    let result = audits;

    // Filter by client if selected
    if (selectedClient) {
      result = result.filter((a) => {
        const clientName = challanToClientMap.get(String(a.challan));
        return clientName === selectedClient;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => {
        const userNameOrEmail = (a.user?.name || a.user?.email || "").toLowerCase();
        const qty = String(a.quantity || "").toLowerCase();
        const color = (a.color || "").toLowerCase();
        const title = (a.box?.title || "").toLowerCase();
        const category = (a.box?.category || "").toLowerCase();
        const code = (a.box?.code || "").toLowerCase();
        return (
          userNameOrEmail.includes(q) ||
          qty.includes(q) ||
          color.includes(q) ||
          title.includes(q) ||
          category.includes(q) ||
          code.includes(q)
        );
      });
    }

    return result;
  }, [audits, searchQuery, selectedClient, challanToClientMap]);

  return (
    <div className="w-full space-y-6">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-4 sm:p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-6">Audit History</h3>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B5B4F]" size={20} />
            <input
              type="text"
              placeholder="Search by user, quantity, color, box name, category, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] placeholder:text-[#8B7355] transition-all duration-300"
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B5B4F] mb-2">Filter by Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] transition-all duration-300"
            >
              <option value="">All Clients</option>
              {clientsList.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>
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
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Color</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Box</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Category</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Code</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Client</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Challan</th>
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
                      <td className="px-4 py-3 text-[#2D1B0E]">
                        <span className="px-2 py-1 rounded-full bg-[#FBE8E7] text-[#C1272D] text-xs font-semibold border border-[#F3C4C1]">
                          {a.color || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#2D1B0E]">{a.box?.title || "-"}</td>
                      <td className="px-4 py-3 text-[#2D1B0E]">{a.box?.category || "-"}</td>
                      <td className="px-4 py-3 text-[#2D1B0E] font-mono whitespace-nowrap">{a.box?.code || "-"}</td>
                      <td className="px-4 py-3 text-[#2D1B0E]">
                        {challanToClientMap.get(String(a.challan)) || "-"}
                      </td>
                      <td className="px-4 py-3 text-[#2D1B0E]">
                        {a.challan ? (
                          <button
                            onClick={() => handleDownload(a.challan)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#C1272D]/90 text-white text-xs font-semibold shadow-md hover:bg-[#A01F24]"
                          >
                            <FiDownload /> Download
                          </button>
                        ) : (
                          <span className="text-xs text-[#6B5B4F]">No challan</span>
                        )}
                      </td>
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


