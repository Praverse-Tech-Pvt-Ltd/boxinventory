import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiSearch, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getAllAudits } from "../../services/boxService";
import { downloadChallanPdf, listChallans } from "../../services/challanService";
import "../../styles/dashboard.css";

const AuditHistory = () => {
  const [activeTab, setActiveTab] = useState("audits"); // "audits" or "sales"
  const [audits, setAudits] = useState([]);
  const [challans, setChallans] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(""); // Client name filter
  
  // Total Sales tab states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [salesData, setSalesData] = useState([]);

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

  // Calculate sales data based on date range
  const calculateSalesData = () => {
    if (!fromDate || !toDate) {
      toast.error("Please select both From Date and To Date");
      return;
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    if (from > to) {
      toast.error("From Date must be before To Date");
      return;
    }

    const filtered = challans.filter((challan) => {
      const challanDate = new Date(challan.createdAt);
      return challanDate >= from && challanDate <= to;
    });

    const data = filtered.map((challan) => {
      const taxable = Number(challan.subtotal || 0);
      const gst = Number(challan.gstAmount || 0);
      const total = taxable + gst;

      return {
        _id: challan._id,
        date: new Date(challan.createdAt).toLocaleDateString(),
        client: challan.clientDetails?.name || "-",
        challanNo: challan.number || "-",
        taxableAmount: taxable,
        gstAmount: gst,
        totalAmount: total,
      };
    });

    setSalesData(data);
    if (data.length === 0) {
      toast.info("No sales found for the selected date range");
    } else {
      toast.success(`Found ${data.length} challan(s) in the selected date range`);
    }
  };

  // Calculate totals for sales data
  const salesTotals = useMemo(() => {
    const totalTaxable = salesData.reduce((sum, item) => sum + item.taxableAmount, 0);
    const totalGst = salesData.reduce((sum, item) => sum + item.gstAmount, 0);
    const totalAmount = salesData.reduce((sum, item) => sum + item.totalAmount, 0);

    return {
      totalTaxable,
      totalGst,
      totalAmount,
    };
  }, [salesData]);

  const exportToCSV = () => {
    if (salesData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Date", "Client", "Challan No.", "Taxable Amount", "GST Amount", "Total Amount"];
    const rows = salesData.map((item) => [
      item.date,
      item.client,
      item.challanNo,
      item.taxableAmount.toFixed(2),
      item.gstAmount.toFixed(2),
      item.totalAmount.toFixed(2),
    ]);

    // Add totals row
    rows.push(["", "", "TOTAL", salesTotals.totalTaxable.toFixed(2), salesTotals.totalGst.toFixed(2), salesTotals.totalAmount.toFixed(2)]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sales-report-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Sales report exported as CSV");
  };

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
        {/* Tab Navigation */}
        <div className="border-b border-slate-200 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("audits")}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                activeTab === "audits"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab("sales")}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                activeTab === "sales"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Total Sales
            </button>
          </div>
        </div>

        {/* Audit Logs Tab */}
        {activeTab === "audits" && (
          <>
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
          </>
        )}

        {/* Total Sales Tab */}
        {activeTab === "sales" && (
          <>
            {/* Date Range Selection */}
            <div className="mb-6 p-6 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Select Date Range</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="form-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="form-input w-full"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={calculateSalesData}
                    className="w-full px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Calculate Sales
                  </button>
                </div>
              </div>
            </div>

            {/* Sales Results */}
            {salesData.length > 0 && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Total Sales (Excl. GST)</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">₹{salesTotals.totalTaxable.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Total GST Collected</p>
                    <p className="mt-2 text-2xl font-bold text-amber-600">₹{salesTotals.totalGst.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs uppercase tracking-wide text-red-600 font-semibold">Grand Total (Incl. GST)</p>
                    <p className="mt-2 text-2xl font-bold text-red-600">₹{salesTotals.totalAmount.toFixed(2)}</p>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="mb-6 flex gap-3">
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                  >
                    <FiDownload /> Download Excel
                  </button>
                </div>

                {/* Sales Table */}
                <div className="table-container">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Challan No.</th>
                        <th>Taxable Amount</th>
                        <th>GST Amount</th>
                        <th>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.map((item, idx) => (
                        <tr
                          key={item._id}
                          className={`border-b border-slate-200 transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-sm">{item.date}</td>
                          <td className="px-4 py-3 text-slate-700 text-sm">{item.client}</td>
                          <td className="px-4 py-3 text-slate-700 font-mono text-sm">{item.challanNo}</td>
                          <td className="px-4 py-3 text-slate-700 font-semibold text-sm">₹{item.taxableAmount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-amber-600 font-semibold text-sm">₹{item.gstAmount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-red-600 font-bold text-sm">₹{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {/* Totals Row */}
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td colSpan="3" className="px-4 py-4 text-slate-900 text-sm">TOTAL</td>
                        <td className="px-4 py-4 text-slate-900 text-sm">₹{salesTotals.totalTaxable.toFixed(2)}</td>
                        <td className="px-4 py-4 text-amber-600 text-sm">₹{salesTotals.totalGst.toFixed(2)}</td>
                        <td className="px-4 py-4 text-red-600 text-sm">₹{salesTotals.totalAmount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Empty State */}
            {salesData.length === 0 && fromDate && toDate && (
              <div className="text-center py-12 text-slate-500">
                <p className="font-medium">No sales found for the selected date range</p>
                <p className="text-sm mt-2">Select a date range and click "Calculate Sales" to view sales data</p>
              </div>
            )}

            {/* Initial State */}
            {!fromDate && !toDate && (
              <div className="text-center py-12 text-slate-500">
                <p className="font-medium">Select a date range to view sales data</p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AuditHistory;



