import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import os from "os";
import PDFDocument from "pdfkit";

const COMPANY = {
  name: "VISHAL PAPER PRODUCT",
  address: "172, Khadilkar Raod, Girgaon, Mumbai - 400 004",
  contact: "• Mob.: 8850893493 • E-mail: fancycards@yahoo.com",
  gst: "GST NO.: 27BCZPS4667K1ZD",
};

const HSN_CODE = "481920"; // Fixed HSN Code for Paper Products

const DEFAULT_TERMS = `• Parcel will be dispatched after payment confirmation.
• Order once placed – No refund / No cancellation / No exchange.
• Customised order – colour difference is possible in printing.
• Order will be shipped within 24 hours of payment received.
• Delivery timeline: 2–6 working days, depending on location.`;

const DEFAULT_NOTE = `~ The above-mentioned prices are without GST. GST @ 5% applicable.
~ Shipping & packaging charges are additional.
~ Shipping charges are dynamic and depend on weight and dimensions.
~ Goods once sold will not be taken back / exchanged / refunded.
~ Final amount including shipping & packaging will be shared after order confirmation.
~ Always share payment confirmation screenshot.
~ Order will be dispatched within 24–48 hours after payment receipt.
~ Shipping time: 1–2 days within Mumbai, 5–7 days PAN India, may take longer during festive seasons.
~ Opening video of parcel is mandatory to claim any damage.
~ Tracking ID will be shared once the parcel is picked up.`;

const ensureDirectory = async (dirPath) => {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    console.log(`Directory ensured: ${dirPath}`);
  } catch (err) {
    console.error(`Failed to create directory ${dirPath}:`, err);
    throw err;
  }
};

const formatCurrency = (value) =>
  typeof value === "number" ? value.toFixed(2) : Number(value || 0).toFixed(2);

// Relative width factors to fit within page content width dynamically
const columnConfig = [
  { key: "srNo", label: "Sr. No.", factor: 0.08, align: "center" },
  { key: "item", label: "ITEM", factor: 0.22, align: "left" },
  { key: "code", label: "CODE", factor: 0.12, align: "center" },
  { key: "colours", label: "COLOUR", factor: 0.18, align: "left" },
  { key: "quantity", label: "QTY.", factor: 0.08, align: "right" },
  { key: "rate", label: "RATE", factor: 0.09, align: "right" },
  { key: "total", label: "TOTAL", factor: 0.09, align: "right" },
];

const drawTableBorders = (doc, startX, startY, headerHeight, rowHeights, colWidths) => {
  const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const bodyHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  const totalHeight = headerHeight + bodyHeight;

  let currentY = startY;
  // Top border
  doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke();

  currentY += headerHeight;
  // Header bottom border
  doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke();

  rowHeights.forEach((height) => {
    currentY += height;
    doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke();
  });

  // Vertical borders
  let currentX = startX;
  doc.moveTo(startX, startY).lineTo(startX, startY + totalHeight).stroke();
  colWidths.forEach((w) => {
    currentX += w;
    doc.moveTo(currentX, startY).lineTo(currentX, startY + totalHeight).stroke();
  });
};

const addHeader = (doc, challanNumber, hsnCode) => {
  // Header: Company name and details centered
  doc.font("Helvetica-Bold").fontSize(9).text("DELIVERY CHALLAN", { align: "center" });
  doc.moveDown(0.1);
  doc.fontSize(14).text(COMPANY.name, { align: "center" });
  doc.moveDown(0.08);
  doc.font("Helvetica").fontSize(8).text(COMPANY.address, { align: "center" });
  doc.fontSize(8).text(COMPANY.contact, { align: "center" });
  doc.moveDown(0.08);
  doc.font("Helvetica-Bold").fontSize(8).text(COMPANY.gst, { align: "center" });

  // Challan Number & HSN Code section with proper spacing
  doc.moveDown(0.2);
  const pageWidth = doc.page.width;
  const leftMargin = doc.page.margins.left;
  const rightMargin = doc.page.margins.right;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  
  // Split into two columns: left 50% for Challan No, right 50% for HSN Code
  const columnWidth = contentWidth / 2;
  const currentY = doc.y;
  
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text(`Challan No.: ${challanNumber}`, leftMargin, currentY, {
    width: columnWidth - 10,
    align: "left",
  });
  
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text(`HSN Code: ${HSN_CODE}`, leftMargin + columnWidth + 10, currentY, {
    width: columnWidth - 20,
    align: "left",
  });
  
  doc.moveDown(0.15);
};

const addClientDetails = (doc, clientDetails = {}) => {
  const entries = [
    { label: "Name", value: clientDetails.name },
    { label: "Address", value: clientDetails.address },
    { label: "Mobile", value: clientDetails.mobile },
    { label: "GST No.", value: clientDetails.gstNumber },
  ];

  const hasValue = entries.some((entry) => entry.value);
  doc.moveDown(0.1);
  doc.font("Helvetica-Bold").fontSize(9).text("Prepared By & Client Details:");
  doc.moveDown(0.08);
  doc.font("Helvetica").fontSize(8);
  
  // Use fixed column widths for proper alignment
  const labelWidth = 70;
  const startX = 20;
  
  entries.forEach((entry) => {
    const label = entry.label + ":";
    const value = entry.value?.trim() ? entry.value : "-";
    
    // Draw label in fixed width column
    doc.text(label, startX, undefined, {
      width: labelWidth,
      align: "left",
    });
    
    // Draw value next to label on same line
    const labelHeight = doc.heightOfString(label, { width: labelWidth });
    doc.text(value, startX + labelWidth, doc.y - labelHeight, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - startX - labelWidth - 10,
      align: "left",
    });
  });

  if (!hasValue) {
    doc.moveDown(0.1);
  } else {
    doc.moveDown(0.2);
  }
};

const addTable = (doc, items, startY) => {
  const startX = 50;
  const headerHeight = 22;
  let currentY = startY;

  doc.lineWidth(0.5);
  doc.font("Helvetica-Bold").fontSize(8.5);

  // Compute dynamic widths based on available width
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableWidth = contentWidth - (startX - doc.page.margins.left) - 10;
  const totalFactor = columnConfig.reduce((s, c) => s + c.factor, 0);
  const colWidths = columnConfig.map((c) => Math.floor((c.factor / totalFactor) * tableWidth));

  // Adjust the last column to fill rounding difference
  const widthSum = colWidths.reduce((a, b) => a + b, 0);
  if (widthSum !== tableWidth) {
    colWidths[colWidths.length - 1] += tableWidth - widthSum;
  }

  // Draw header row background
  doc.save();
  doc.rect(startX, currentY, tableWidth, headerHeight).fill("#E8DCC6");
  doc.restore();
  doc.fillColor("#000");

  // Header row with better spacing
  let cursorX = startX;
  columnConfig.forEach((col, idx) => {
    const w = colWidths[idx];
    doc.text(col.label, cursorX + 4, currentY + 7, {
      width: w - 8,
      align: col.align,
    });
    cursorX += w;
  });
  currentY += headerHeight;

  doc.font("Helvetica").fontSize(8);

  // Expand items into rows - one row per color-quantity pair
  const expandedRows = [];
  let srNoCounter = 1;

  items.forEach((item, itemIndex) => {
    const rate = Number(item.rate || 0);
    const assembly = Number(item.assemblyCharge || 0);
    const baseItemName = item.item || item.box?.title || "";
    
    // Check if item has colorLines (color-wise quantities)
    if (Array.isArray(item.colorLines) && item.colorLines.length > 0) {
      // Use colorLines for color-wise breakdown
      item.colorLines.forEach((line, lineIndex) => {
        const qty = Number(line.quantity || 0);
        const lineTotal = (rate + assembly) * qty;
        expandedRows.push({
          srNo: lineIndex === 0 ? srNoCounter++ : "", // Show sr no only on first row
          item: lineIndex === 0 ? baseItemName : "", // Show item name only on first row
          code: lineIndex === 0 ? (item.code || item.box?.code || "") : "",
          colours: line.color || "",
          quantity: qty,
          rate: (rate + assembly).toFixed(2),
          total: lineTotal.toFixed(2),
          rawTotal: lineTotal,
        });
      });
    } else {
      // Fallback to old logic for colors array or single color
      let colorsToShow = [];
      if (item.color) {
        colorsToShow = [item.color];
      } else if (Array.isArray(item.colours) && item.colours.length > 0) {
        colorsToShow = item.colours;
      } else if (Array.isArray(item.box?.colours) && item.box.colours.length > 0) {
        colorsToShow = item.box.colours;
      } else {
        colorsToShow = [""]; // No color specified
      }

      // If only one color, show it as a single row
      if (colorsToShow.length === 1) {
        const qty = Number(item.quantity || 0);
        const lineTotal = (rate + assembly) * qty;
        expandedRows.push({
          srNo: srNoCounter++,
          item: baseItemName,
          code: item.code || item.box?.code || "",
          colours: colorsToShow[0] || "",
          quantity: qty,
          rate: (rate + assembly).toFixed(2),
          total: lineTotal.toFixed(2),
          rawTotal: lineTotal,
        });
      } else {
        // Multiple colors - create separate rows for each color
        const qtyPerColor = Number(item.quantity || 0);
        colorsToShow.forEach((color, colorIndex) => {
          const lineTotal = (rate + assembly) * qtyPerColor;
          expandedRows.push({
            srNo: colorIndex === 0 ? srNoCounter++ : "", // Show sr no only on first row
            item: colorIndex === 0 ? baseItemName : "", // Show item name only on first color row
            code: colorIndex === 0 ? (item.code || item.box?.code || "") : "",
            colours: color || "",
            quantity: qtyPerColor,
            rate: (rate + assembly).toFixed(2),
            total: lineTotal.toFixed(2),
            rawTotal: lineTotal,
          });
        });
      }
    }
  });

  const rowsData = expandedRows;

  const rowHeights = [];

    rowsData.forEach((row, idx) => {
    let rowHeight = 0;
    let x = startX;
    columnConfig.forEach((col, cIdx) => {
      const w = colWidths[cIdx];
      const value = row[col.key] ?? "";
      const cellText = String(value);
      const cellHeight = doc.heightOfString(cellText || " ", {
        width: w - 8,
        align: col.align,
        lineGap: 2,
      });
      rowHeight = Math.max(rowHeight, cellHeight + 8);
    });
    rowHeight = Math.max(rowHeight, 20);
    rowHeights.push(rowHeight);

    x = startX;
    columnConfig.forEach((col, cIdx) => {
      const w = colWidths[cIdx];
      const value = row[col.key] ?? "";
      doc.text(String(value), x + 4, currentY + 4, {
        width: w - 8,
        align: col.align,
        lineGap: 2,
      });
      x += w;
    });
    currentY += rowHeight;
  });

  drawTableBorders(doc, startX, startY, headerHeight, rowHeights, colWidths);

  const subtotal = rowsData.reduce((sum, row) => sum + row.rawTotal, 0);

  return {
    endY: currentY,
    subtotal,
    tableWidth,
    startX,
  };
};

const addSummary = (doc, summary, includeGST, yTopOverride, taxType = "GST", packagingChargesOverall = 0, discountPct = 0, discountAmount = 0, taxableSubtotal = 0, gstAmount = 0, assemblyTotal = 0) => {
  const { subtotal, startX, tableWidth } = summary;
  const baseY = typeof yTopOverride === "number" ? yTopOverride : summary.endY;
  const labelWidth = tableWidth * 0.65;
  const valueWidth = tableWidth * 0.35;
  
  // Use server-calculated values if provided, otherwise compute from subtotal
  let finalGstAmount = gstAmount;
  let finalTaxableSubtotal = taxableSubtotal;
  let finalGrandTotal = 0;
  
  if (taxableSubtotal > 0) {
    // Server-calculated values are provided
    finalTaxableSubtotal = taxableSubtotal;
    finalGstAmount = gstAmount;
  } else {
    // Fallback to old calculation (for backwards compatibility)
    const packagingCharges = Number(packagingChargesOverall) || 0;
    const subtotalWithPackaging = subtotal + packagingCharges;
    finalTaxableSubtotal = subtotalWithPackaging;
    const gstRate = taxType === "NON_GST" ? 0 : 0.05;
    finalGstAmount = subtotalWithPackaging * gstRate;
  }
  
  const totalBeforeRound = finalTaxableSubtotal + finalGstAmount;
  const roundedTotal = Math.round(totalBeforeRound);
  const roundOff = roundedTotal - totalBeforeRound;
  const roundOffLabel =
    roundOff > 0 ? "Round Off (Added)" : roundOff < 0 ? "Round Off (Deducted)" : "Round Off";
  const roundOffValue =
    roundOff === 0 ? formatCurrency(0) : `${roundOff > 0 ? "+" : "-"}${formatCurrency(Math.abs(roundOff))}`;

  doc.lineWidth(0.5);
  doc.moveTo(startX, baseY).lineTo(startX + tableWidth, baseY).stroke();

  let currentLineY = baseY + 4;
  
  // The subtotal from table includes both rate and assembly combined
  // We need to show them separately
  // subtotal = itemsTotal + assemblyTotal (from the table)
  const assemblyChargeAmount = Number(assemblyTotal) || 0;
  const itemsTotal = subtotal - assemblyChargeAmount;
  
  doc.font("Helvetica-Bold").fontSize(8.5);
  doc.text("Items Subtotal", startX + 4, currentLineY, { width: labelWidth - 8, align: "right" });
  doc.text(formatCurrency(itemsTotal), startX + labelWidth, currentLineY, {
    width: valueWidth - 8,
    align: "right",
  });
  currentLineY += 11;
  
  // Show assembly charge separately (always, even if 0)
  doc.font("Helvetica-Bold").fontSize(8.5);
  doc.text("Assembly Charges", startX + 4, currentLineY, { width: labelWidth - 8, align: "right" });
  doc.text(formatCurrency(assemblyChargeAmount), startX + labelWidth, currentLineY, {
    width: valueWidth - 8,
    align: "right",
  });
  currentLineY += 11;
  
  // Show packaging charges if present
  if (packagingChargesOverall > 0) {
    doc.font("Helvetica-Bold").fontSize(8.5);
    doc.text("Packaging Charges", startX + 4, currentLineY, { width: labelWidth - 8, align: "right" });
    doc.text(formatCurrency(packagingChargesOverall), startX + labelWidth, currentLineY, {
      width: valueWidth - 8,
      align: "right",
    });
    currentLineY += 11;
  }
  
  // Show discount if present
  if (discountAmount > 0) {
    doc.font("Helvetica-Bold").fontSize(8.5);
    const discountLabel = discountPct > 0 ? `Discount (${discountPct}%)` : "Discount";
    doc.text(discountLabel, startX + 4, currentLineY, { width: labelWidth - 8, align: "right" });
    doc.text(`-${formatCurrency(discountAmount)}`, startX + labelWidth, currentLineY, {
      width: valueWidth - 8,
      align: "right",
    });
    currentLineY += 11;
  }
  
  // Show taxable subtotal
  doc.font("Helvetica-Bold").fontSize(8.5);
  doc.text("Taxable Subtotal", startX + 4, currentLineY, { width: labelWidth - 8, align: "right" });
  doc.text(formatCurrency(finalTaxableSubtotal), startX + labelWidth, currentLineY, {
    width: valueWidth - 8,
    align: "right",
  });
  currentLineY += 11;

  // Show GST line with appropriate label and amount
  const gstLabel = taxType === "NON_GST" ? "GST (0% - Non-GST)" : "GST @ 5%";
  doc.font("Helvetica-Bold").fontSize(8.5);
  doc.text(gstLabel, startX + 4, currentLineY, { width: labelWidth - 8, align: "right" });
  doc.text(formatCurrency(finalGstAmount), startX + labelWidth, currentLineY, {
    width: valueWidth - 8,
    align: "right",
  });
  currentLineY += 11;

  doc.text(roundOffLabel, startX + 4, currentLineY, { width: labelWidth - 8, align: "right" });
  doc.text(roundOffValue, startX + labelWidth, currentLineY, {
    width: valueWidth - 8,
    align: "right",
  });
  currentLineY += 9;

  doc.moveTo(startX, currentLineY).lineTo(startX + tableWidth, currentLineY).stroke();

  doc.font("Helvetica-Bold").fontSize(9.5);
  doc.text("TOTAL (Rounded)", startX + 4, currentLineY + 6, { width: labelWidth - 8, align: "right" });
  doc.text(`INR ${formatCurrency(roundedTotal)}`, startX + labelWidth, currentLineY + 6, {
    width: valueWidth - 8,
    align: "right",
  });

  return currentLineY + 26;
};

const addFooter = (doc, startY, terms, paymentMode = null, remarks = null) => {
  let contentY = startY;
  const pageHeight = doc.page.height;
  const bottomMargin = 40;
  const sectionGap = 3;
  const headerFontSize = 8;
  const contentFontSize = 7;
  
  // Add Payment Mode if present
  if (paymentMode) {
    if (contentY + 18 > pageHeight - bottomMargin) {
      doc.addPage();
      contentY = 50;
    }
    doc.font("Helvetica-Bold").fontSize(headerFontSize).text("Payment Mode:", 50, contentY);
    doc.font("Helvetica").fontSize(contentFontSize).text(paymentMode, 50, contentY + 9);
    contentY += 18;
  }
  
  // Add Remarks if present
  if (remarks) {
    const remarksHeight = doc.heightOfString(remarks, { width: doc.page.width - 100 });
    if (contentY + 10 + remarksHeight > pageHeight - bottomMargin) {
      doc.addPage();
      contentY = 50;
    }
    doc.font("Helvetica-Bold").fontSize(headerFontSize).text("Remarks:", 50, contentY);
    doc.font("Helvetica").fontSize(contentFontSize).text(remarks, 50, contentY + 9, {
      width: doc.page.width - 100,
    });
    contentY += 10 + remarksHeight + sectionGap;
  }
  
  // Add separator if we had payment/remarks
  if (paymentMode || remarks) {
    doc.lineWidth(0.5);
    doc.moveTo(50, contentY).lineTo(doc.page.width - 50, contentY).stroke();
    contentY += sectionGap;
  }

  // Terms & Conditions - render header and content ONCE
  const termsToUse = terms || DEFAULT_TERMS;
  const termsHeight = doc.heightOfString(termsToUse, { width: doc.page.width - 100, lineGap: 1 });
  const termsRequiredHeight = 12 + termsHeight + sectionGap;
  
  if (contentY + termsRequiredHeight > pageHeight - bottomMargin) {
    doc.addPage();
    contentY = 50;
  }
  
  doc.font("Helvetica-Bold").fontSize(headerFontSize).text("Terms & Conditions:", 50, contentY);
  doc.font("Helvetica").fontSize(contentFontSize).text(termsToUse, 50, contentY + 10, {
    width: doc.page.width - 100,
    align: "left",
    lineGap: 1,
  });
  
  contentY += termsRequiredHeight;

  // Note - render header and content ONCE
  const noteHeight = doc.heightOfString(DEFAULT_NOTE, { width: doc.page.width - 100, lineGap: 1 });
  const noteRequiredHeight = 12 + noteHeight + sectionGap;
  
  if (contentY + noteRequiredHeight > pageHeight - bottomMargin) {
    doc.addPage();
    contentY = 50;
  }
  
  doc.font("Helvetica-Bold").fontSize(headerFontSize).text("Note:", 50, contentY);
  doc.font("Helvetica").fontSize(contentFontSize).text(DEFAULT_NOTE, 50, contentY + 10, {
    width: doc.page.width - 100,
    align: "left",
    lineGap: 1,
  });
};

export const generateChallanPdf = async (challanData, includeGST = true, taxType = "GST") => {
  if (!challanData) {
    throw new Error("Challan data is required to generate PDF");
  }

  try {
    const tempDir = process.env.CHALAN_PDF_DIR || path.join(os.tmpdir(), "challans");
    console.log(`[PDF] Temp directory: ${tempDir}`);
    
    await ensureDirectory(tempDir);

    // Replace slashes in filename to avoid directory creation issues
    const safeFilename = `${(challanData.number || `challan-${Date.now()}`).replace(/\//g, "_")}`;
    const filename = `${safeFilename}.pdf`;
    const filePath = path.join(tempDir, filename);
    
    console.log(`[PDF] File path: ${filePath}`);
    console.log(`[PDF] Creating PDF for challan: ${challanData.number}`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const writeStream = fs.createWriteStream(filePath);
    
    writeStream.on('error', (err) => {
      console.error(`[PDF] WriteStream error:`, err);
    });
    
    doc.on('error', (err) => {
      console.error(`[PDF] Document error:`, err);
    });
    
    doc.pipe(writeStream);

    addHeader(doc, challanData.number || "", challanData.hsnCode || "");

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10).text(`Prepared By: ${challanData.createdBy?.name || "-"}`);

    if (challanData.clientDetails) {
      addClientDetails(doc, challanData.clientDetails);
    }

    doc.moveDown(0.1);
    const tableInfo = addTable(doc, challanData.items || [], doc.y + 3);

    // Always render GST/TOTAL just above the footer horizontal line
    const summaryBlockHeight = 65;
    const summarySpacing = 3;
    let targetFooterY = Math.max(tableInfo.endY + 8, doc.page.height - 155);
    let summaryTop = targetFooterY - summaryBlockHeight - summarySpacing;

    if (summaryTop <= tableInfo.endY + 8) {
      // Not enough space above footer on this page, move to new page
      doc.addPage();
      // Recompute targets on new page
      targetFooterY = doc.page.height - 160;
      summaryTop = targetFooterY - summaryBlockHeight - summarySpacing;
    }

    addSummary(
      doc,
      tableInfo,
      includeGST,
      summaryTop,
      taxType,
      challanData.packaging_charges_overall || 0,
      challanData.discount_pct || 0,
      challanData.discount_amount || 0,
      challanData.taxable_subtotal || 0,
      challanData.gst_amount || 0,
      challanData.assembly_total || 0
    );

    // Footer starts right after summary (let PDFKit track position)
    doc.moveDown(0.2);
    addFooter(doc, doc.y, challanData.terms, challanData.payment_mode, challanData.remarks);

    console.log(`[PDF] Document finalized, waiting for stream finish`);
    doc.end();

    const result = await new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log(`[PDF] ✓ PDF generated successfully: ${filePath}`);
        resolve(filePath);
      });
      writeStream.on("error", (err) => {
        console.error(`[PDF] ✗ WriteStream error:`, err);
        reject(err);
      });
      
      // Timeout safety
      setTimeout(() => {
        reject(new Error("PDF generation timeout after 30s"));
      }, 30000);
    });

    return result;
  } catch (error) {
    console.error("[PDF] Error generating challan PDF:", error.message);
    console.error("[PDF] Stack:", error.stack);
    throw error;
  }
};


