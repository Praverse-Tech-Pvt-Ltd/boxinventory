import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { FiSearch, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getAllAudits } from "../../services/boxService";
import { downloadChallanPdf, listChallans, editChallan, cancelChallan } from "../../services/challanService";
import { getProfile } from "../../services/authService";
import jsPDF from "jspdf";
import AddItemLookupModal from "../../components/AddItemLookupModal";
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
  const num = typeof amount === 'number' ? amount : (typeof amount === 'string' ? parseFloat(amount) : 0);
  return isNaN(num) ? '₹0.00' : `₹${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
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

    addText(`Date Range: ${safeFormatDate(fromDate)} to ${safeFormatDate(toDate)}`, margin, yPosition, {
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
  // Safe date parsing utility
  const safeParseDate = (dateValue) => {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const safeFormatDate = (dateValue) => {
    const date = safeParseDate(dateValue);
    return date ? date.toLocaleDateString() : "N/A";
  };

  const safeToISODate = (dateValue) => {
    const date = safeParseDate(dateValue);
    return date ? date.toISOString().split('T')[0] : "";
  };
  const [activeTab, setActiveTab] = useState("audits"); // "audits" or "sales"
  const [audits, setAudits] = useState([]);
  const [challans, setChallans] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(""); // Client name filter
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Total Sales tab states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [salesData, setSalesData] = useState([]);

  // Edit/Cancel modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [cancelReason, setCancelReason] = useState("");
  const [challanStatusFilter, setChallanStatusFilter] = useState("all"); // "all", "active", "cancelled"
  const [isEditingChallan, setIsEditingChallan] = useState(false);
  const [isCancellingChallan, setIsCancellingChallan] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingAudits(true);
        const [auditData, challanData, userProfile] = await Promise.all([
          getAllAudits(),
          listChallans(),
          getProfile().catch(() => null),
        ]);
        setAudits(auditData);
        setChallans(challanData);
        if (userProfile) {
          setCurrentUser(userProfile);
          setIsAdmin(userProfile.role === "admin");
        }
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
      const blob = await downloadChallanPdf(challanId);
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

  // Edit challan handlers
  const handleOpenEditModal = (challan) => {
    setSelectedChallan(challan);
    setEditFormData({
      clientName: challan.clientDetails?.name || challan.clientName || "",
      paymentMode: challan.payment_mode || "",
      remarks: challan.remarks || "",
      termsAndConditions: challan.notes || challan.terms || "",
      hsnCode: challan.hsnCode || "",
      packagingTotal: challan.packaging_charges_overall || 0,
      discountPercent: challan.discount_pct || 0,
      challanDate: challan.challanDate ? new Date(challan.challanDate).toISOString().split("T")[0] : (challan.createdAt ? new Date(challan.createdAt).toISOString().split("T")[0] : ""),
      // Items array for editing
      items: challan.items?.map((item) => ({
        _id: item._id || Math.random().toString(),
        boxId: item.box?._id || item.box || "",
        code: item.box?.code || item.code || "",
        name: item.box?.title || item.name || "",
        color: item.color || "",
        quantity: item.quantity || 0,
        rate: item.rate || 0,
        assemblyCharge: item.assemblyCharge || 0,
      })) || [],
    });
    setShowEditModal(true);
    // Disable background scroll
    document.body.style.overflow = "hidden";
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    // Restore body scroll
    document.body.style.overflow = "";
    setSelectedChallan(null);
    setEditFormData({});
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveEditChallan = async () => {
    if (!selectedChallan) return;

    // Validate items
    if (!editFormData.items || editFormData.items.length === 0) {
      toast.error("Challan must have at least one item");
      return;
    }

    // Validate each item
    for (const item of editFormData.items) {
      if (!item.boxId) {
        toast.error("All items must have a product selected");
        return;
      }
      if (item.quantity <= 0) {
        toast.error(`Item ${item.code} must have quantity > 0`);
        return;
      }
      if (item.rate < 0) {
        toast.error(`Item ${item.code} must have rate >= 0`);
        return;
      }
    }

    setIsEditingChallan(true);
    try {
      const payload = {
        clientName: editFormData.clientName,
        paymentMode: editFormData.paymentMode,
        remarks: editFormData.remarks,
        termsAndConditions: editFormData.termsAndConditions,
        hsnCode: editFormData.hsnCode,
        packagingTotal: parseFloat(editFormData.packagingTotal) || 0,
        discountPercent: parseFloat(editFormData.discountPercent) || 0,
        challanDate: editFormData.challanDate ? new Date(editFormData.challanDate).toISOString() : undefined,
        // Include items for full challan edit
        items: editFormData.items.map((item) => ({
          box: item.boxId,
          code: item.code,
          title: item.name,
          color: item.color || "",
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          assemblyCharge: Number(item.assemblyCharge) || 0,
        })),
      };

      // Remove undefined fields
      Object.keys(payload).forEach(
        (key) => payload[key] === undefined && delete payload[key]
      );

      const updatedChallan = await editChallan(selectedChallan._id, payload);
      
      // Update challans list
      setChallans((prev) =>
        prev.map((c) => (c._id === selectedChallan._id ? updatedChallan : c))
      );

      toast.success("Challan updated successfully");
      handleCloseEditModal();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update challan");
      console.error("Edit challan error:", error);
    } finally {
      setIsEditingChallan(false);
    }
  };

  // Item management handlers
  const handleAddItem = () => {
    setShowAddItemModal(true);
  };

  const handleSelectBoxForItem = (newItem) => {
    // Ensure item has a unique _id (use crypto.randomUUID or timestamp for new items)
    const itemWithId = {
      ...newItem,
      _id: newItem._id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setEditFormData((prev) => ({
      ...prev,
      items: [...prev.items, itemWithId],
    }));
    toast.success("Item added successfully");
  };

  const handleDeleteItem = (itemId) => {
    if (window.confirm("Delete this item?")) {
      setEditFormData((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item._id !== itemId),
      }));
      toast.success("Item removed");
    }
  };

  const handleUpdateItem = (itemId, field, value) => {
    setEditFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item._id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  // Cancel challan handlers
  const handleOpenCancelModal = (challan) => {
    setSelectedChallan(challan);
    setCancelReason("");
    setShowCancelModal(true);
    // Disable background scroll
    document.body.style.overflow = "hidden";
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    // Restore body scroll
    document.body.style.overflow = "";
    setSelectedChallan(null);
    setCancelReason("");
  };

  const handleConfirmCancelChallan = async () => {
    if (!selectedChallan || !cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }

    setIsCancellingChallan(true);
    try {
      const updatedChallan = await cancelChallan(selectedChallan._id, cancelReason);
      
      // Update challans list
      setChallans((prev) =>
        prev.map((c) => (c._id === selectedChallan._id ? updatedChallan : c))
      );

      toast.success("Challan cancelled successfully");
      handleCloseCancelModal();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to cancel challan");
      console.error("Cancel challan error:", error);
    } finally {
      setIsCancellingChallan(false);
    }
  };

  // Filter challans by status
  const filteredChallans = useMemo(() => {
    if (challanStatusFilter === "active") {
      return challans.filter((c) => c.status !== "CANCELLED");
    } else if (challanStatusFilter === "cancelled") {
      return challans.filter((c) => c.status === "CANCELLED");
    }
    return challans;
  }, [challans, challanStatusFilter]);

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

    // Filter challans by date range and status
    // ONLY ACTIVE CHALLANS count towards sales (CANCELLED are excluded)
    const filtered = challans.filter((challan) => {
      const challanDate = new Date(challan.createdAt);
      const isOutward = challan.inventory_mode !== "inward"; // Exclude stock inward (adds)
      const isActive = challan.status !== "CANCELLED"; // Exclude cancelled
      return challanDate >= from && challanDate <= to && isOutward && isActive;
    });

    console.log(`Found ${filtered.length} active challans in date range`);

    // Calculate totals from filtered challans using server-side values
    let runningTotalTaxable = 0;
    let runningTotalGst = 0;
    let runningTotalAmount = 0;

    const data = filtered.map((challan) => {
      // Use server-side calculated totals (mapped fields from backend)
      const taxableAmount = challan.taxableAmount || challan.taxable_subtotal || 0;
      const gstAmount = challan.gstAmount || challan.gst_amount || 0;
      const totalAmount = challan.totalAmount || challan.grand_total || 0;

      // Update running totals
      runningTotalTaxable += safeToNumber(taxableAmount);
      runningTotalGst += safeToNumber(gstAmount);
      runningTotalAmount += safeToNumber(totalAmount);

      return {
        _id: challan._id,
        date: safeFormatDate(challan.createdAt),
        client: getClientDisplay(challan.clientName || challan.clientDetails?.name || "-"),
        challanNo: challan.challanNumber || challan.number || "-",
        taxableAmount: safeToNumber(taxableAmount),
        gstAmount: safeToNumber(gstAmount),
        totalAmount: safeToNumber(totalAmount),
      };
    });

    setSalesData(data);

    // Log totals for debugging
    console.log("Calculated totals (ACTIVE CHALLANS ONLY):", {
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
                            {a.challan && a.challan._id
                              ? challanToClientMap.get(String(a.challan._id)) || "-"
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {a.challan ? (
                              <button
                                onClick={() => handleDownload(a.challan._id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold shadow-sm hover:bg-red-700 transition-colors"
                              >
                                <FiDownload /> {a.challan.number || "Download"}
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
              <div className="flex items-center gap-4">
                {/* Status Filter Dropdown */}
                <select
                  value={challanStatusFilter}
                  onChange={(e) => setChallanStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:border-slate-400 focus:border-red-600 focus:outline-none bg-white"
                >
                  <option value="all">All Challans</option>
                  <option value="active">Active Only</option>
                  <option value="cancelled">Cancelled Only</option>
                </select>
                <div className="text-sm text-slate-600">
                  Total: {filteredChallans.length} {filteredChallans.length === 1 ? "challan" : "challans"}
                </div>
              </div>
            </div>

            {filteredChallans.length > 0 ? (
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
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChallans.map((challan, idx) => (
                      <tr
                        key={challan._id}
                        className={`border-b border-slate-200 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                        } hover:bg-slate-100 ${challan.status === "CANCELLED" ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-sm">
                          {safeFormatDate(challan.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-mono font-semibold text-sm">
                          {challan.challanNumber || challan.number || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-sm">
                          {challan.clientName || challan.clientDetails?.name || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-sm">
                          {challan.items ? challan.items.length : 0} item(s)
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-semibold text-sm">
                          {formatCurrencyUI(challan.totalAmount || challan.grand_total || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              challan.inventory_mode === "inward"
                                ? "bg-green-100 text-green-800"
                                : challan.inventory_mode === "dispatch"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {challan.inventory_mode === "inward"
                              ? "ADD"
                              : challan.inventory_mode === "dispatch"
                              ? "DISPATCH"
                              : "RECORD"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              challan.status === "CANCELLED"
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {challan.status === "CANCELLED" ? "CANCELLED" : "ACTIVE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownload(challan._id)}
                              className="text-blue-600 hover:text-blue-800 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Download PDF"
                              disabled={challan.status === "CANCELLED"}
                            >
                              📄
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleOpenEditModal(challan)}
                                  className="text-amber-600 hover:text-amber-800 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Edit Challan (Admin Only)"
                                  disabled={challan.status === "CANCELLED"}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleOpenCancelModal(challan)}
                                  className="text-red-600 hover:text-red-800 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Cancel Challan (Admin Only)"
                                  disabled={challan.status === "CANCELLED"}
                                >
                                  ❌
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p className="font-medium">
                  {challanStatusFilter === "all" ? "No challans generated yet" : `No ${challanStatusFilter} challans found`}
                </p>
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

        {/* Edit Challan Modal - Using React Portal - WITH ITEMS TABLE */}
        {showEditModal && selectedChallan && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.45)",
              padding: "16px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseEditModal();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                handleCloseEditModal();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
              style={{
                width: "min(1000px, 100%)",
                maxHeight: "min(90vh, 900px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header - Fixed */}
              <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Edit Challan</h2>
                  <p className="text-sm text-slate-500 mt-1">Challan #: {selectedChallan.number}</p>
                </div>
                <button
                  onClick={handleCloseEditModal}
                  className="text-slate-500 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                  title="Close (ESC)"
                >
                  ×
                </button>
              </div>

              {/* Modal Body - Scrollable with proper overflow handling */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="p-6 space-y-6">
                  {/* SECTION A: Challan Info (Read-only + Editable) */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-4">Challan Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Challan Number (read-only) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Challan Number</label>
                        <div className="px-3 py-2 bg-slate-200 rounded text-slate-800 font-mono">{selectedChallan.number}</div>
                      </div>

                      {/* Challan Type (read-only) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Type</label>
                        <div className="px-3 py-2 bg-slate-200 rounded text-slate-800 font-semibold">
                          {selectedChallan.challan_tax_type === "GST" ? "GST Challan" : "Non-GST Challan"}
                        </div>
                      </div>

                      {/* Client Name (editable) */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Client Name</label>
                        <input
                          type="text"
                          value={editFormData.clientName}
                          onChange={(e) => handleEditFormChange("clientName", e.target.value)}
                          className="form-input w-full"
                          placeholder="Client Name"
                        />
                      </div>

                      {/* Payment Mode (editable) */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Mode</label>
                        <select
                          value={editFormData.paymentMode}
                          onChange={(e) => handleEditFormChange("paymentMode", e.target.value)}
                          className="form-input w-full"
                        >
                          <option value="">Select Payment Mode</option>
                          <option value="Cash">Cash</option>
                          <option value="GPay">GPay</option>
                          <option value="Bank Account">Bank Account</option>
                          <option value="Credit">Credit</option>
                        </select>
                      </div>

                      {/* HSN Code (editable) */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">HSN Code</label>
                        <input
                          type="text"
                          value={editFormData.hsnCode}
                          onChange={(e) => handleEditFormChange("hsnCode", e.target.value)}
                          className="form-input w-full"
                          placeholder="481920"
                        />
                      </div>

                      {/* Challan Date (editable) */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Challan Date</label>
                        <input
                          type="date"
                          value={editFormData.challanDate || safeToISODate(selectedChallan.createdAt)}
                          onChange={(e) => handleEditFormChange("challanDate", e.target.value)}
                          className="form-input w-full"
                        />
                      </div>

                      {/* Packaging Total (editable) */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Packaging Total (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.packagingTotal}
                          onChange={(e) => handleEditFormChange("packagingTotal", e.target.value)}
                          className="form-input w-full"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Discount Percent (editable) */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Discount (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editFormData.discountPercent}
                          onChange={(e) => handleEditFormChange("discountPercent", e.target.value)}
                          className="form-input w-full"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Remarks (full width) */}
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Remarks</label>
                      <textarea
                        value={editFormData.remarks}
                        onChange={(e) => handleEditFormChange("remarks", e.target.value)}
                        className="form-input w-full min-h-[60px] resize-none"
                        placeholder="Enter remarks"
                      />
                    </div>

                    {/* Terms and Conditions (full width) */}
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Terms and Conditions</label>
                      <textarea
                        value={editFormData.termsAndConditions}
                        onChange={(e) => handleEditFormChange("termsAndConditions", e.target.value)}
                        className="form-input w-full min-h-[60px] resize-none"
                        placeholder="Enter terms and conditions"
                      />
                    </div>
                  </div>

                  {/* SECTION B: Challan Items Table */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-slate-900">Items in Challan</h3>
                      <button
                        onClick={handleAddItem}
                        className="px-3 py-1 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition-colors"
                      >
                        + Add Item
                      </button>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-200 border-b-2 border-slate-300">
                            <th className="px-3 py-2 text-left font-semibold text-slate-700">Product Code</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-700">Product Name</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-700">Color</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-700">Qty</th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-700">Rate (₹)</th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-700">Assembly (₹)</th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-700">Line Total (₹)</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-700">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editFormData.items && editFormData.items.length > 0 ? (
                            editFormData.items.map((item, idx) => {
                              const lineTotal = 
                                (Number(item.rate) || 0 + Number(item.assemblyCharge) || 0) * (Number(item.quantity) || 0);
                              return (
                                <tr key={item._id} className={`border-b border-slate-300 ${idx % 2 === 0 ? "bg-white" : "bg-slate-100"}`}>
                                  <td className="px-3 py-2">
                                    <div className="text-xs font-medium text-slate-900">{item.code}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="text-xs font-medium text-slate-900">{item.name}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={item.color}
                                      onChange={(e) => handleUpdateItem(item._id, "color", e.target.value)}
                                      className="form-select w-full py-1 text-xs border border-slate-300 rounded bg-white"
                                    >
                                      <option value="">Select Color</option>
                                      {item.colors && Array.isArray(item.colors) && item.colors.length > 0 ? (
                                        item.colors.map((colorObj) => (
                                          <option key={colorObj.color || colorObj} value={colorObj.color || colorObj}>
                                            {colorObj.color || colorObj} {colorObj.available ? `(${colorObj.available})` : ""}
                                          </option>
                                        ))
                                      ) : (
                                        <option disabled>No colors available</option>
                                      )}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateItem(item._id, "quantity", e.target.value)}
                                      className="form-input w-full py-1 text-xs text-center border border-slate-300 rounded bg-white"
                                      placeholder="0"
                                      min="0"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.rate}
                                      onChange={(e) => handleUpdateItem(item._id, "rate", e.target.value)}
                                      className="form-input w-full py-1 text-xs text-right border border-slate-300 rounded bg-white"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.assemblyCharge}
                                      onChange={(e) => handleUpdateItem(item._id, "assemblyCharge", e.target.value)}
                                      className="form-input w-full py-1 text-xs text-right border border-slate-300 rounded bg-white"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                    {formatCurrencyUI(lineTotal)}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      onClick={() => handleDeleteItem(item._id)}
                                      className="px-2 py-1 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="8" className="px-3 py-4 text-center text-slate-500">No items</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer - Fixed */}
              <div className="flex-shrink-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
                  disabled={isEditingChallan}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditChallan}
                  className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isEditingChallan}
                >
                  {isEditingChallan ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

        {/* Cancel Challan Modal - Using React Portal */}
        {showCancelModal && selectedChallan && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.45)",
              padding: "16px",
            }}
            onClick={(e) => {
              // Close on overlay click (outside modal)
              if (e.target === e.currentTarget) {
                handleCloseCancelModal();
              }
            }}
            onKeyDown={(e) => {
              // Close on ESC key
              if (e.key === "Escape") {
                handleCloseCancelModal();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
              style={{
                width: "min(600px, 100%)",
                maxHeight: "calc(100vh - 32px)",
              }}
            >
              {/* Modal Header - Fixed */}
              <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-6 py-4">
                <h2 className="text-xl font-bold text-red-800">Cancel Challan</h2>
                <p className="text-sm text-red-700 mt-1">
                  Challan #{selectedChallan.challanNumber || selectedChallan.number || "N/A"}
                </p>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-4">
                  <p className="text-slate-700 text-sm">
                    {selectedChallan.inventory_mode === "dispatch"
                      ? "This will mark the challan as cancelled and reverse the inventory for all items."
                      : "This will mark the challan as cancelled. No inventory will be affected."}
                  </p>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Cancellation Reason *</label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="form-input w-full min-h-[100px]"
                      placeholder="Please enter the reason for cancelling this challan"
                    />
                    {!cancelReason.trim() && (
                      <p className="text-xs text-red-600 mt-1">Cancellation reason is required</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer - Fixed */}
              <div className="flex-shrink-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={handleCloseCancelModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
                  disabled={isCancellingChallan}
                >
                  Close
                </button>
                <button
                  onClick={handleConfirmCancelChallan}
                  className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCancellingChallan || !cancelReason.trim()}
                >
                  {isCancellingChallan ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

        {/* Add Item Lookup Modal */}
        <AddItemLookupModal
          isOpen={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          onSelectBox={handleSelectBoxForItem}
        />
      </motion.div>
    </div>
  );
};

export default AuditHistory;

