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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900">📊 Audit History</h1>
          <p className="mt-1 text-sm text-slate-600">Track all inventory movements and transactions</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by user, box name, category, code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filter by Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
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

          {/* Content */}
          <div className="mt-6">
            {loadingAudits ? (
              <div className="text-center py-10 text-slate-600 font-medium">Loading audits...</div>
            ) : filteredAudits.length === 0 ? (
              <div className="text-center py-10 text-slate-600 font-medium">No audits found.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">User</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Action</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Quantity</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Color</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Box</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Category</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Code</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Client</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Challan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudits.map((a, idx) => (
                    <tr
                      key={a._id}
                      className={`border-b border-slate-200 transition-colors hover:bg-slate-50 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-sm">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-sm">
                        {a.user?.name || a.user?.email || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-semibold text-sm">{a.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                          {a.color || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-sm">{a.box?.title || "-"}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm">{a.box?.category || "-"}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap text-sm">
                        {a.box?.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-sm">
                        {challanToClientMap.get(String(a.challan)) || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {a.challan ? (
                          <button
                            onClick={() => handleDownload(a.challan)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors"
                          >
                            <FiDownload /> Download
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">No challan</span>
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


