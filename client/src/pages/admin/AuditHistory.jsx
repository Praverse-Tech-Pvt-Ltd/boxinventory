import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiSearch, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getAllAudits } from "../../services/boxService";
import { downloadChallanPdf, listChallans } from "../../services/challanService";
import "../../styles/dashboard.css";

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
    <div className="w-full section-spacing">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="section-title">📊 Audit History</h2>
        <p className="section-subtitle">Track all inventory movements and transactions</p>
      </div>

      {/* Main Card */}
      <motion.div
        className="dashboard-card hover-lift"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Card Header */}
        <div className="card-header">
          <h3 className="card-header-title">Audit Records</h3>
          <span className="text-sm text-gray-500">{filteredAudits.length} records found</span>
        </div>

        {/* Filters */}
        <div className="toolbar mb-4">
          <div className="toolbar-left">
            <label className="toolbar-label">Filters:</label>
          </div>
          <div className="toolbar-right">
            <div className="flex-1 min-w-[250px] max-w-[400px]">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by user, box name, category, code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-8 text-sm"
                />
              </div>
            </div>

            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="form-select text-sm"
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

        {/* Table */}
        <div className="card-body">
          {loadingAudits ? (
            <div className="text-center py-12 text-gray-500 font-medium">Loading audits...</div>
          ) : filteredAudits.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-medium">No audits found.</div>
          ) : (
            <div className="table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold shadow-sm hover:bg-red-700 transition-colors"
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
      </motion.div>
    </div>
  );
};

export default AuditHistory;



