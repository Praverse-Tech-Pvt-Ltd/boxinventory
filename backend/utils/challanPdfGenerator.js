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

const DEFAULT_TERMS = "Goods once sold will not be taken back.";

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

const addHeader = (doc, challanNumber) => {
  doc.font("Helvetica-Bold").fontSize(10).text("DELIVERY CHALLAN", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(18).text(COMPANY.name, { align: "center" });
  doc.moveDown(0.1);
  doc.font("Helvetica").fontSize(10).text(COMPANY.address, { align: "center" });
  doc.text(COMPANY.contact, { align: "center" });
  doc.moveDown(0.1);
  doc.font("Helvetica-Bold").text(COMPANY.gst, { align: "center" });

  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(11).text(`Challan No.: ${challanNumber}`, 50, doc.y, {
    align: "left",
  });
  doc.moveDown(0.2);
};

const addTable = (doc, items, startY) => {
  const startX = 40;
  const headerHeight = 26;
  let currentY = startY;

  doc.lineWidth(0.6);
  doc.font("Helvetica-Bold").fontSize(10);

  // Compute dynamic widths based on available width
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableWidth = contentWidth - (startX - doc.page.margins.left) * 2 + (doc.page.margins.left - 40);
  const totalFactor = columnConfig.reduce((s, c) => s + c.factor, 0);
  const colWidths = columnConfig.map((c) => Math.floor((c.factor / totalFactor) * tableWidth));

  // Adjust the last column to fill rounding difference
  const widthSum = colWidths.reduce((a, b) => a + b, 0);
  if (widthSum !== tableWidth) {
    colWidths[colWidths.length - 1] += tableWidth - widthSum;
  }

  // Draw header row background
  doc.save();
  doc.rect(startX, currentY, tableWidth, headerHeight).fill("#f5f1e8");
  doc.restore();
  doc.fillColor("#000");

  // Header row
  let cursorX = startX;
  columnConfig.forEach((col, idx) => {
    const w = colWidths[idx];
    doc.text(col.label, cursorX + 4, currentY + 6, {
      width: w - 8,
      align: col.align,
    });
    cursorX += w;
  });
  currentY += headerHeight;

  doc.font("Helvetica").fontSize(10);

  const rowsData = items.map((item, index) => {
    const rate = Number(item.rate || 0);
    const assembly = Number(item.assemblyCharge || 0);
    const packaging = Number(item.packagingCharge || 0);
    const qty = Number(item.quantity || 0);
    const lineTotal = (rate + assembly + packaging) * qty;
    const itemLines = [
      item.item || item.box?.title || "",
      `Assembly: ₹${formatCurrency(assembly)}`,
      `Packaging: ₹${formatCurrency(packaging)}`,
    ].filter(Boolean);
    return {
      srNo: index + 1,
      item: itemLines.join("\n"),
      cavity: item.cavity || "",
      code: item.code || item.box?.code || "",
      colours: Array.isArray(item.colours) ? item.colours.join(", ") : item.colours || "",
      quantity: qty,
      rate: (rate + assembly + packaging).toFixed(2),
      total: lineTotal.toFixed(2),
      rawTotal: lineTotal,
    };
  });

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
      rowHeight = Math.max(rowHeight, cellHeight + 12);
    });
    rowHeight = Math.max(rowHeight, 24);
    rowHeights.push(rowHeight);

    x = startX;
    columnConfig.forEach((col, cIdx) => {
      const w = colWidths[cIdx];
      const value = row[col.key] ?? "";
      doc.text(String(value), x + 4, currentY + 6, {
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

const addSummary = (doc, summary, includeGST, yTopOverride) => {
  const { subtotal, startX, tableWidth } = summary;
  const baseY = typeof yTopOverride === "number" ? yTopOverride : summary.endY;
  const labelWidth = tableWidth * 0.7;
  const valueWidth = tableWidth * 0.3;
  const gstAmount = includeGST ? subtotal * 0.18 : 0;
  const totalWithGst = subtotal + gstAmount;

  doc.moveTo(startX, baseY).lineTo(startX + tableWidth, baseY).stroke();

  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("GST (18%)", startX + 4, baseY + 6, { width: labelWidth - 8, align: "right" });
  doc.text(formatCurrency(gstAmount), startX + labelWidth, baseY + 6, {
    width: valueWidth - 8,
    align: "right",
  });

  doc.moveTo(startX, baseY + 24).lineTo(startX + tableWidth, baseY + 24).stroke();

  doc.text("TOTAL", startX + 4, baseY + 30, { width: labelWidth - 8, align: "right" });
  doc.text(
    formatCurrency(includeGST ? totalWithGst : subtotal),
    startX + labelWidth,
    baseY + 30,
    { width: valueWidth - 8, align: "right" }
  );

  return baseY + 60;
};

const addFooter = (doc, startY, terms) => {
  const footerY = Math.max(startY, doc.page.height - 160);
  doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).stroke();

  doc.font("Helvetica-Bold").fontSize(11).text("Terms & Conditions:", 40, footerY + 12);
  doc.font("Helvetica").fontSize(10).text(terms || DEFAULT_TERMS, {
    width: doc.page.width / 2,
    align: "left",
  });

  doc.font("Helvetica-Bold")
    .fontSize(11)
    .text("VISHAL PAPER PRODUCT", 0, footerY + 12, {
      width: doc.page.width - 80,
      align: "right",
    });
  doc.font("Helvetica").fontSize(10).text("PRO.", 0, footerY + 28, {
    width: doc.page.width - 80,
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

  addHeader(doc, challanData.number || "");

  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).text(`Prepared By: ${challanData.createdBy?.name || "-"}`);

  doc.moveDown(0.5);
  const tableInfo = addTable(doc, challanData.items || [], doc.y + 10);

  // Always render GST/TOTAL just above the footer horizontal line
  const summaryBlockHeight = 60; // must match addSummary's return delta
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


