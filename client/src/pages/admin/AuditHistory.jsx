import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiSearch, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getAllAudits } from "../../services/boxService";
import { downloadChallanPdf, listChallans } from "../../services/challanService";
import jsPDF from "jspdf";
import "../../styles/dashboard.css";

// Helper function to safely convert values to numbers
const safeToNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  // Remove currency symbol and commas
  const cleaned = String(value).replace(/[₹$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

// Helper function to format currency for PDF (using INR instead of ₹ to avoid font issues)
const formatCurrencyForPDF = (amount) => {
  return `INR ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

// Helper function to display client name (replace empty/dash with "Unnamed Client")
const getClientDisplay = (clientName) => {
  if (!clientName || clientName === "-" || clientName.trim() === "") {
    return "Unnamed Client";
  }
  return clientName;
};

// Helper function to format currency for UI display (with thousands separator and ₹)
const formatCurrencyUI = (amount) => {
  return `₹${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

// Function to generate PDF using jsPDF
const generateSalesReportPDF = (salesData, fromDate, toDate, totals) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Helper function to add text
    const addText = (text, x, y, options = {}) => {
      doc.setFont("helvetica", options.weight || "normal");
      doc.setFontSize(options.size || 12);
      doc.setTextColor(options.color ? options.color[0] : 0, options.color ? options.color[1] : 0, options.color ? options.color[2] : 0);
      doc.text(text, x, y, { maxWidth: options.maxWidth || contentWidth, align: options.align || "left" });
    };

    // Header Section
    addText("VISHAL PAPER PRODUCT", margin, yPosition, {
      size: 20,
      weight: "bold",
      color: [220, 38, 38],
    });
    yPosition += 10;

    addText("Sales Report", margin, yPosition, {
      size: 14,
      weight: "bold",
      color: [0, 0, 0],
    });
    yPosition += 8;

    addText(`Date Range: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`, margin, yPosition, {
      size: 10,
      color: [100, 100, 100],
    });
    yPosition += 12;

    // Horizontal line
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Table configuration - equal column widths
    // Page width: 210mm, margins: 12mm each side = 186mm available
    // 6 columns × 31mm = 186mm (perfect fit)
    const columns = [
      { name: "Date", width: 31, align: "center" },
      { name: "Client", width: 31, align: "left" },
      { name: "Challan No.", width: 31, align: "center" },
      { name: "Taxable (INR)", width: 31, align: "right" },
      { name: "GST (INR)", width: 31, align: "right" },
      { name: "Total (INR)", width: 31, align: "right" }
    ];

    // Helper function to truncate and add ellipsis
    const truncateText = (text, maxWidth, fontSize = 8) => {
      if (!text) return "";
      doc.setFontSize(fontSize);
      const textWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
      if (textWidth <= maxWidth) return text;
      
      let truncated = text;
      while (truncated.length > 0 && doc.getStringUnitWidth(truncated + "…") * fontSize / doc.internal.scaleFactor > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      return truncated + "…";
    };;

    // Draw header row
    doc.setFillColor(217, 119, 6);
    doc.rect(margin, yPosition - 6, contentWidth, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);

    let xPos = margin;
    columns.forEach((col) => {
      const colCenter = xPos + (col.width / 2);
      doc.text(col.name, colCenter, yPosition, {
        maxWidth: col.width - 2,
        align: col.align
      });
      xPos += col.width;
    });

    yPosition += 10;

    // Helper function to draw a table row
    const drawTableRow = (data, isTotal = false, isAlternate = false) => {
      if (yPosition > pageHeight - 25) {
        // Add new page and redraw header
        doc.addPage();
        yPosition = margin;

        doc.setFillColor(217, 119, 6);
        doc.rect(margin, yPosition - 6, contentWidth, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);

        let xPos = margin;
        columns.forEach((col) => {
          const colCenter = xPos + (col.width / 2);
          doc.text(col.name, colCenter, yPosition, {
            maxWidth: col.width - 2,
            align: col.align
          });
          xPos += col.width;
        });
        yPosition += 10;
      }

      // Draw row background
      if (isTotal) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition - 5, contentWidth, 7, "F");
      } else if (isAlternate) {
        doc.setFillColor(249, 243, 237);
        doc.rect(margin, yPosition - 5, contentWidth, 7, "F");
      }

      // Draw row data
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);

      let xPos = margin;
      
      // Date column
      const dateText = truncateText(data.date, columns[0].width - 2, 8);
      const dateCenter = xPos + (columns[0].width / 2);
      doc.text(dateText, dateCenter, yPosition, { maxWidth: columns[0].width - 2, align: columns[0].align });
      xPos += columns[0].width;

      // Client column
      const clientText = truncateText(data.client, columns[1].width - 2, 8);
      doc.text(clientText, xPos + 1, yPosition, { maxWidth: columns[1].width - 2, align: columns[1].align });
      xPos += columns[1].width;

      // Challan No. column
      const challanText = truncateText(data.challan, columns[2].width - 2, 8);
      const challanCenter = xPos + (columns[2].width / 2);
      doc.text(challanText, challanCenter, yPosition, { maxWidth: columns[2].width - 2, align: columns[2].align });
      xPos += columns[2].width;

      // Numeric columns - right aligned
      doc.setFont("helvetica", isTotal ? "bold" : "bold");
      
      doc.text(data.taxable, xPos + columns[3].width - 1, yPosition, { maxWidth: columns[3].width - 2, align: columns[3].align });
      xPos += columns[3].width;

      doc.text(data.gst, xPos + columns[4].width - 1, yPosition, { maxWidth: columns[4].width - 2, align: columns[4].align });
      xPos += columns[4].width;

      doc.text(data.total, xPos + columns[5].width - 1, yPosition, { maxWidth: columns[5].width - 2, align: columns[5].align });

      yPosition += 7;
    };

    // Draw data rows
    salesData.forEach((item, idx) => {
      drawTableRow({
        date: item.date,
        client: getClientDisplay(item.client),
        challan: item.challanNo,
        taxable: formatCurrencyForPDF(item.taxableAmount),
        gst: formatCurrencyForPDF(item.gstAmount),
        total: formatCurrencyForPDF(item.totalAmount)
      }, false, idx % 2 === 1);
    });

    // Draw totals row with separator line
    yPosition += 2;
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    drawTableRow({
      date: "TOTAL",
      client: "",
      challan: "",
      taxable: formatCurrencyForPDF(totals.totalTaxable),
      gst: formatCurrencyForPDF(totals.totalGst),
      total: formatCurrencyForPDF(totals.totalAmount)
    }, true, false);

    yPosition += 6;

    // Summary Cards Section
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    doc.text("Total Sales (Excl. GST):", margin, yPosition);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(11);
    doc.text(formatCurrencyForPDF(totals.totalTaxable), margin + 65, yPosition);

    yPosition += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Total GST Collected:", margin, yPosition);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(217, 119, 6);
    doc.setFontSize(11);
    doc.text(formatCurrencyForPDF(totals.totalGst), margin + 65, yPosition);

    yPosition += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Grand Total (Incl. GST):", margin, yPosition);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(11);
    doc.text(formatCurrencyForPDF(totals.totalAmount), margin + 65, yPosition);

    // Add footer with date and company name
    yPosition = pageHeight - margin - 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    
    const generatedDate = new Date().toLocaleDateString();
    const footerText = `Report generated on ${generatedDate} | Vishal Paper Product System`;
    doc.text(footerText, pageWidth / 2, yPosition, { align: "center" });

    // Save PDF
    const filename = `sales-report-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
    toast.success("Sales report PDF downloaded successfully!");
  } catch (error) {
    console.error("Error generating PDF:", error);
    toast.error("Failed to generate PDF report: " + (error.message || "Unknown error"));
  }
};

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
    from.setHours(0, 0, 0, 0); // Start of day
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999); // End of day

    if (from > to) {
      toast.error("From Date must be before To Date");
      return;
    }

    // Filter challans by date range
    const filtered = challans.filter((challan) => {
      const challanDate = new Date(challan.createdAt);
      return challanDate >= from && challanDate <= to;
    });

    console.log(`Found ${filtered.length} challans in date range`);

    // Helper function to calculate challan line totals
    const calculateChallanTotals = (challan) => {
      let subtotal = 0;
      
      // Calculate subtotal from items
      if (Array.isArray(challan.items)) {
        challan.items.forEach((item) => {
          const rate = safeToNumber(item.rate || 0);
          const assembly = safeToNumber(item.assemblyCharge || 0);
          const packaging = safeToNumber(item.packagingCharge || 0);
          const quantity = safeToNumber(item.quantity || 1);
          const lineTotal = (rate + assembly + packaging) * quantity;
          subtotal += lineTotal;
        });
      }

      // GST is fixed at 5%
      const gst = subtotal * 0.05;
      const gstRounded = Math.round(gst * 100) / 100;
      const total = Math.round((subtotal + gst) * 100) / 100;

      return {
        taxable: subtotal,
        gst: gstRounded,
        total: total,
      };
    };

    // Calculate totals from filtered challans
    let runningTotalTaxable = 0;
    let runningTotalGst = 0;
    let runningTotalAmount = 0;

    const data = filtered.map((challan) => {
      const amounts = calculateChallanTotals(challan);

      // Update running totals
      runningTotalTaxable += amounts.taxable;
      runningTotalGst += amounts.gst;
      runningTotalAmount += amounts.total;

      return {
        _id: challan._id,
        date: new Date(challan.createdAt).toLocaleDateString(),
        client: getClientDisplay(challan.clientDetails?.name || "-"),
        challanNo: challan.number || "-",
        taxableAmount: amounts.taxable,
        gstAmount: amounts.gst,
        totalAmount: amounts.total,
      };
    });

    setSalesData(data);

    // Log totals for debugging
    console.log("Calculated totals:", {
      totalTaxable: runningTotalTaxable,
      totalGst: runningTotalGst,
      totalAmount: runningTotalAmount,
    });

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
              onClick={() => setActiveTab("challans")}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                activeTab === "challans"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              All Challans
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

        {/* All Challans Tab */}
        {activeTab === "challans" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900">All Generated Challans</h3>
              <div className="text-sm text-slate-600">
                Total: {challans.length} {challans.length === 1 ? "challan" : "challans"}
              </div>
            </div>

            {challans.length > 0 ? (
              <div className="table-container">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Challan No.</th>
                      <th>Client</th>
                      <th>Items</th>
                      <th>Total Amount</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challans.map((challan, idx) => (
                      <tr
                        key={challan._id}
                        className={`border-b border-slate-200 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                        } hover:bg-slate-100`}
                      >
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-sm">
                          {challan.createdAt ? new Date(challan.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-mono font-semibold text-sm">
                          {challan.challanNo || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-sm">
                          {challan.clientDetails?.name || challan.clientName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-sm">
                          {challan.items ? challan.items.length : 0} item(s)
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-semibold text-sm">
                          {formatCurrencyUI(challan.totalAmount || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              challan.inventoryType === "add"
                                ? "bg-green-100 text-green-800"
                                : challan.inventoryType === "subtract"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {challan.inventoryType === "add"
                              ? "ADD"
                              : challan.inventoryType === "subtract"
                              ? "DISPATCH"
                              : "MANUAL"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <button
                            onClick={() => handleDownload(challan._id)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm transition-colors"
                            title="Download PDF"
                          >
                            📄 PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p className="font-medium">No challans generated yet</p>
              </div>
            )}
          </div>
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
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrencyUI(salesTotals.totalTaxable)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Total GST Collected</p>
                    <p className="mt-2 text-2xl font-bold text-amber-600">{formatCurrencyUI(salesTotals.totalGst)}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs uppercase tracking-wide text-red-600 font-semibold">Grand Total (Incl. GST)</p>
                    <p className="mt-2 text-2xl font-bold text-red-600">{formatCurrencyUI(salesTotals.totalAmount)}</p>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="mb-6 flex gap-3">
                  <button
                    onClick={() => {
                      generateSalesReportPDF(salesData, fromDate, toDate, salesTotals);
                    }}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 shadow-md"
                  >
                    <FiDownload /> Download PDF Report
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 shadow-md"
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
                          <td className="px-4 py-3 text-slate-700 font-semibold text-sm">{formatCurrencyUI(item.taxableAmount)}</td>
                          <td className="px-4 py-3 text-amber-600 font-semibold text-sm">{formatCurrencyUI(item.gstAmount)}</td>
                          <td className="px-4 py-3 text-red-600 font-bold text-sm">{formatCurrencyUI(item.totalAmount)}</td>
                        </tr>
                      ))}
                      {/* Totals Row */}
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td colSpan="3" className="px-4 py-4 text-slate-900 text-sm">TOTAL</td>
                        <td className="px-4 py-4 text-slate-900 text-sm">{formatCurrencyUI(salesTotals.totalTaxable)}</td>
                        <td className="px-4 py-4 text-amber-600 text-sm">{formatCurrencyUI(salesTotals.totalGst)}</td>
                        <td className="px-4 py-4 text-red-600 text-sm">{formatCurrencyUI(salesTotals.totalAmount)}</td>
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



