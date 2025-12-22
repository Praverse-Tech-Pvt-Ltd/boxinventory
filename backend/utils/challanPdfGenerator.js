import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import os from "os";
import PDFDocument from "pdfkit";

const COMPANY = {
  name: "VISHAL PAPER PRODUCT",
  address: "172, Khadilkar Raod, Girgaon, Mumbai - 400 004",
  contact: "• Mob.: 9987257279 / 9004433300 • E-mail: fancycards@yahoo.com",
  gst: "GST NO.: 27BCZPS4667K1ZD",
};

const HSN_CODE = "481920"; // Fixed HSN Code for Paper Products

const DEFAULT_TERMS = `Terms & Conditions:
• Parcel will be dispatched after payment confirmation.
• Order once placed – No refund / No cancellation / No exchange.
• Customised order – colour difference is possible in printing.
• Order will be shipped within 24 hours of payment received.
• Delivery timeline: 2–6 working days, depending on location.`;

const DEFAULT_NOTE = `Note:
~ The above-mentioned prices are without GST. GST @ 5% applicable.
~ Shipping & packaging charges are additional.
~ Shipping charges are dynamic and depend on weight and dimensions.
~ Goods once sold will not be taken back / exchanged / refunded.
~ Final amount including shipping & packaging will be shared after order confirmation.
~ Always share payment confirmation screenshot.
~ Order will be dispatched within 24–48 hours after payment receipt.
~ Shipping time:
  • 1–2 days within Mumbai
  • 5–7 days PAN India
  • May take longer during festive seasons
~ Opening video of parcel is mandatory to claim any damage.
~ Tracking ID will be shared once the parcel is picked up.`;

const ensureDirectory = async (dirPath) => {
  await fsPromises.mkdir(dirPath, { recursive: true });
};

const formatCurrency = (value) =>
  typeof value === "number" ? value.toFixed(2) : Number(value || 0).toFixed(2);

// Relative width factors to fit within page content width dynamically
const columnConfig = [
  { key: "srNo", label: "Sr. No.", factor: 0.08, align: "center" },
  { key: "item", label: "ITEM", factor: 0.22, align: "left" },
  { key: "cavity", label: "CAVITY", factor: 0.14, align: "left" },
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
  doc.font("Helvetica-Bold").fontSize(10).text("DELIVERY CHALLAN", { align: "center" });
  doc.moveDown(0.25);
  doc.fontSize(18).text(COMPANY.name, { align: "center" });
  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(9.5).text(COMPANY.address, { align: "center" });
  doc.fontSize(9).text(COMPANY.contact, { align: "center" });
  doc.moveDown(0.15);
  doc.font("Helvetica-Bold").fontSize(9).text(COMPANY.gst, { align: "center" });

  // Challan Number & HSN Code section with proper spacing
  doc.moveDown(0.4);
  const pageWidth = doc.page.width;
  const leftMargin = doc.page.margins.left;
  const rightMargin = doc.page.margins.right;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  
  // Split into two columns: left 50% for Challan No, right 50% for HSN Code
  const columnWidth = contentWidth / 2;
  const currentY = doc.y;
  
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text(`Challan No.: ${challanNumber}`, leftMargin, currentY, {
    width: columnWidth - 10,
    align: "left",
  });
  
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text(`HSN Code: ${HSN_CODE}`, leftMargin + columnWidth + 10, currentY, {
    width: columnWidth - 20,
    align: "left",
  });
  
  doc.moveDown(0.35);
};

const addClientDetails = (doc, clientDetails = {}) => {
  const entries = [
    { label: "Name", value: clientDetails.name },
    { label: "Address", value: clientDetails.address },
    { label: "Mobile", value: clientDetails.mobile },
    { label: "GST No.", value: clientDetails.gstNumber },
  ];

  const hasValue = entries.some((entry) => entry.value);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Prepared By & Client Details:");
  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(9.5);
  
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
  const headerHeight = 28;
  let currentY = startY;

  doc.lineWidth(0.7);
  doc.font("Helvetica-Bold").fontSize(9.5);

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

  doc.font("Helvetica").fontSize(9);

  // Expand items into rows - one row per color-quantity pair
  const expandedRows = [];
  let srNoCounter = 1;

  items.forEach((item, itemIndex) => {
    const rate = Number(item.rate || 0);
    const assembly = Number(item.assemblyCharge || 0);
    const packaging = Number(item.packagingCharge || 0);
    const baseItemName = item.item || item.box?.title || "";
    
    // Get colors - prioritize item.color, then item.colours array
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
      const lineTotal = (rate + assembly + packaging) * qty;
      const itemLines = [
        baseItemName,
        `Assembly: ₹${formatCurrency(assembly)}`,
        `Packaging: ₹${formatCurrency(packaging)}`,
      ].filter(Boolean);
      expandedRows.push({
        srNo: srNoCounter++,
        item: itemLines.join("\n"),
        cavity: item.cavity || "",
        code: item.code || item.box?.code || "",
        colours: colorsToShow[0] || "",
        quantity: qty,
        rate: (rate + assembly + packaging).toFixed(2),
        total: lineTotal.toFixed(2),
        rawTotal: lineTotal,
      });
    } else {
      // Multiple colors - create separate rows for each color
      // Distribute quantity evenly or show same quantity for each (based on requirement)
      // For now, we'll show the same quantity for each color
      const qtyPerColor = Number(item.quantity || 0);
      colorsToShow.forEach((color, colorIndex) => {
        const lineTotal = (rate + assembly + packaging) * qtyPerColor;
        const itemLines = [
          colorIndex === 0 ? baseItemName : "", // Show item name only on first color row
          colorIndex === 0 ? `Assembly: ₹${formatCurrency(assembly)}` : "",
          colorIndex === 0 ? `Packaging: ₹${formatCurrency(packaging)}` : "",
        ].filter(Boolean);
        expandedRows.push({
          srNo: colorIndex === 0 ? srNoCounter++ : "", // Show sr no only on first row
          item: itemLines.join("\n"),
          cavity: colorIndex === 0 ? (item.cavity || "") : "",
          code: colorIndex === 0 ? (item.code || item.box?.code || "") : "",
          colours: color || "",
          quantity: qtyPerColor,
          rate: (rate + assembly + packaging).toFixed(2),
          total: lineTotal.toFixed(2),
          rawTotal: lineTotal,
        });
      });
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
        lineGap: 3,
      });
      rowHeight = Math.max(rowHeight, cellHeight + 14);
    });
    rowHeight = Math.max(rowHeight, 26);
    rowHeights.push(rowHeight);

    x = startX;
    columnConfig.forEach((col, cIdx) => {
      const w = colWidths[cIdx];
      const value = row[col.key] ?? "";
      doc.text(String(value), x + 4, currentY + 7, {
        width: w - 8,
        align: col.align,
        lineGap: 3,
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

const addSummary = (doc, summary, includeGST, yTopOverride) => {
  const { subtotal, startX, tableWidth } = summary;
  const baseY = typeof yTopOverride === "number" ? yTopOverride : summary.endY;
  const labelWidth = tableWidth * 0.65;
  const valueWidth = tableWidth * 0.35;
  const gstAmount = subtotal * 0.05;
  const totalBeforeRound = subtotal + gstAmount;
  const roundedTotal = Math.round(totalBeforeRound);
  const roundOff = roundedTotal - totalBeforeRound;
  const roundOffLabel =
    roundOff > 0 ? "Round Off (Added)" : roundOff < 0 ? "Round Off (Deducted)" : "Round Off";
  const roundOffValue =
    roundOff === 0 ? formatCurrency(0) : `${roundOff > 0 ? "+" : "-"}${formatCurrency(Math.abs(roundOff))}`;

  doc.lineWidth(0.7);
  doc.moveTo(startX, baseY).lineTo(startX + tableWidth, baseY).stroke();

  doc.font("Helvetica-Bold").fontSize(9.5);
  doc.text("GST (5%)", startX + 4, baseY + 8, { width: labelWidth - 8, align: "right" });
  doc.text(formatCurrency(gstAmount), startX + labelWidth, baseY + 8, {
    width: valueWidth - 8,
    align: "right",
  });

  doc.text(roundOffLabel, startX + 4, baseY + 26, { width: labelWidth - 8, align: "right" });
  doc.text(roundOffValue, startX + labelWidth, baseY + 26, {
    width: valueWidth - 8,
    align: "right",
  });

  doc.moveTo(startX, baseY + 38).lineTo(startX + tableWidth, baseY + 38).stroke();

  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("TOTAL (Rounded)", startX + 4, baseY + 46, { width: labelWidth - 8, align: "right" });
  doc.text(`₹ ${formatCurrency(roundedTotal)}`, startX + labelWidth, baseY + 46, {
    width: valueWidth - 8,
    align: "right",
  });

  return baseY + 80;
};

const addFooter = (doc, startY, terms) => {
  const footerY = Math.max(startY, doc.page.height - 280);
  doc.lineWidth(0.7);
  doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).stroke();

  // Terms & Conditions
  const termsToUse = terms || DEFAULT_TERMS;
  doc.font("Helvetica-Bold").fontSize(9).text("Terms & Conditions:", 50, footerY + 8);
  doc.font("Helvetica").fontSize(8).text(termsToUse, 50, footerY + 22, {
    width: doc.page.width - 100,
    align: "left",
    lineGap: 2,
  });

  // Calculate height used by terms
  const termsHeight = doc.heightOfString(termsToUse, { width: doc.page.width - 100 });
  const noteStartY = footerY + 22 + termsHeight + 12;

  // Note Section
  doc.font("Helvetica-Bold").fontSize(9).text("Note:", 50, noteStartY);
  doc.font("Helvetica").fontSize(7.5).text(DEFAULT_NOTE, 50, noteStartY + 14, {
    width: doc.page.width - 100,
    align: "left",
    lineGap: 1.5,
  });

  // Signature area on right
  doc.font("Helvetica-Bold")
    .fontSize(9)
    .text("VISHAL PAPER PRODUCT", 50, footerY + 8, {
      width: doc.page.width - 100,
      align: "right",
    });
  doc.font("Helvetica").fontSize(8).text("PRO.", 50, footerY + 22, {
    width: doc.page.width - 100,
    align: "right",
  });
};

export const generateChallanPdf = async (challanData, includeGST = true) => {
  if (!challanData) {
    throw new Error("Challan data is required to generate PDF");
  }

  const tempDir = process.env.CHALAN_PDF_DIR || path.join(os.tmpdir(), "challans");
  await ensureDirectory(tempDir);

  const filename = `${challanData.number || `challan-${Date.now()}`}.pdf`;
  const filePath = path.join(tempDir, filename);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  addHeader(doc, challanData.number || "", challanData.hsnCode || "");

  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).text(`Prepared By: ${challanData.createdBy?.name || "-"}`);

  if (challanData.clientDetails) {
    addClientDetails(doc, challanData.clientDetails);
  }

  doc.moveDown(0.5);
  const tableInfo = addTable(doc, challanData.items || [], doc.y + 10);

  // Always render GST/TOTAL just above the footer horizontal line
  const summaryBlockHeight = 78; // must match addSummary's return delta
  const summarySpacing = 12;
  let targetFooterY = Math.max(tableInfo.endY + 20, doc.page.height - 160);
  let summaryTop = targetFooterY - summaryBlockHeight - summarySpacing;

  if (summaryTop <= tableInfo.endY + 8) {
    // Not enough space above footer on this page, move to new page
    doc.addPage();
    // Recompute targets on new page
    targetFooterY = doc.page.height - 160;
    summaryTop = targetFooterY - summaryBlockHeight - summarySpacing;
  }

  addSummary(doc, tableInfo, includeGST, summaryTop);

  addFooter(doc, targetFooterY, challanData.terms);

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return filePath;
};


