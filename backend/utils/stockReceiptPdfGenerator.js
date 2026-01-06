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

const ensureDirectory = async (dirPath) => {
  await fsPromises.mkdir(dirPath, { recursive: true });
};

const formatCurrency = (value) =>
  typeof value === "number" ? value.toFixed(2) : Number(value || 0).toFixed(2);

const columnConfig = [
  { key: "srNo", label: "Sr. No.", factor: 0.08, align: "center" },
  { key: "item", label: "ITEM", factor: 0.22, align: "left" },
  { key: "cavity", label: "CAVITY", factor: 0.14, align: "left" },
  { key: "code", label: "CODE", factor: 0.12, align: "center" },
  { key: "colours", label: "COLOUR", factor: 0.18, align: "left" },
  { key: "quantity", label: "QTY.", factor: 0.08, align: "right" },
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

const addHeader = (doc, receiptNumber, taxType = "GST") => {
  // Header: Company name and details centered
  const headerText = taxType === "NON_GST" ? "STOCK ADDITION RECEIPT (NON-GST)" : "STOCK ADDITION RECEIPT";
  doc.font("Helvetica-Bold").fontSize(10).text(headerText, { align: "center" });
  doc.moveDown(0.25);
  doc.fontSize(18).text(COMPANY.name, { align: "center" });
  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(9.5).text(COMPANY.address, { align: "center" });
  doc.fontSize(9).text(COMPANY.contact, { align: "center" });
  doc.moveDown(0.15);
  doc.font("Helvetica-Bold").fontSize(9).text(COMPANY.gst, { align: "center" });

  // Receipt Number & Date section
  doc.moveDown(0.4);
  const pageWidth = doc.page.width;
  const leftMargin = doc.page.margins.left;
  const rightMargin = doc.page.margins.right;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  const columnWidth = contentWidth / 2;
  const currentY = doc.y;

  doc.font("Helvetica-Bold").fontSize(11);
  doc.text(`Receipt No.: ${receiptNumber}`, leftMargin, currentY, {
    width: columnWidth - 10,
    align: "left",
  });

  doc.font("Helvetica-Bold").fontSize(11);
  const today = new Date().toLocaleDateString("en-IN");
  doc.text(`Date: ${today}`, leftMargin + columnWidth + 10, currentY, {
    width: columnWidth - 20,
    align: "left",
  });

  doc.moveDown(0.35);
};

const addClientDetails = (doc, clientDetails = {}) => {
  const entries = [
    { label: "Prepared By", value: clientDetails.name },
    { label: "Address", value: clientDetails.address },
    { label: "Mobile", value: clientDetails.mobile },
  ];

  const hasValue = entries.some((entry) => entry.value);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Details:");
  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(9.5);

  const labelWidth = 70;
  const startX = 20;

  entries.forEach((entry) => {
    const label = entry.label + ":";
    const value = entry.value?.trim() ? entry.value : "-";

    doc.text(label, startX, undefined, {
      width: labelWidth,
      align: "left",
    });

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

  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableWidth = contentWidth - (startX - doc.page.margins.left) - 10;
  const totalFactor = columnConfig.reduce((s, c) => s + c.factor, 0);
  const colWidths = columnConfig.map((c) => Math.floor((c.factor / totalFactor) * tableWidth));

  const widthSum = colWidths.reduce((a, b) => a + b, 0);
  if (widthSum !== tableWidth) {
    colWidths[colWidths.length - 1] += tableWidth - widthSum;
  }

  // Draw header row background
  doc.save();
  doc.rect(startX, currentY, tableWidth, headerHeight).fill("#E8DCC6");
  doc.restore();
  doc.fillColor("#000");

  // Header row
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

  const expandedRows = [];
  let srNoCounter = 1;

  items.forEach((item) => {
    const baseItemName = item.item || item.box?.title || "";
    let colorsToShow = [];

    if (item.color) {
      colorsToShow = [item.color];
    } else if (Array.isArray(item.colours) && item.colours.length > 0) {
      colorsToShow = item.colours;
    } else if (Array.isArray(item.box?.colours) && item.box.colours.length > 0) {
      colorsToShow = item.box.colours;
    } else {
      colorsToShow = [""];
    }

    if (colorsToShow.length === 1) {
      const qty = Number(item.quantity || 0);
      expandedRows.push({
        srNo: srNoCounter++,
        item: baseItemName,
        cavity: item.cavity || "",
        code: item.code || item.box?.code || "",
        colours: colorsToShow[0] || "",
        quantity: qty,
      });
    } else {
      const qtyPerColor = Number(item.quantity || 0);
      colorsToShow.forEach((color, colorIndex) => {
        expandedRows.push({
          srNo: colorIndex === 0 ? srNoCounter++ : "",
          item: colorIndex === 0 ? baseItemName : "",
          cavity: colorIndex === 0 ? (item.cavity || "") : "",
          code: colorIndex === 0 ? (item.code || item.box?.code || "") : "",
          colours: color || "",
          quantity: qtyPerColor,
        });
      });
    }
  });

  const rowHeights = [];
  expandedRows.forEach((row) => {
    let rowHeight = 0;
    columnConfig.forEach((col) => {
      const w = colWidths[columnConfig.indexOf(col)];
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

    let x = startX;
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

  return {
    endY: currentY,
    tableWidth,
    startX,
  };
};

const addFooter = (doc, startY) => {
  const footerStartY = startY + 10;
  const footerY = footerStartY;

  doc.lineWidth(0.7);
  doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).stroke();

  // Note
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(9).text("Note:", 50, footerY + 8);
  doc.font("Helvetica").fontSize(8).text(
    "This is a stock addition receipt confirming the receipt of the above-mentioned items into inventory.",
    50,
    footerY + 22,
    {
      width: doc.page.width - 100,
      align: "left",
      lineGap: 2,
    }
  );

  // Signature area on right
  doc.font("Helvetica-Bold").fontSize(9).text("VISHAL PAPER PRODUCT", 50, footerY + 8, {
    width: doc.page.width - 100,
    align: "right",
  });
  doc.font("Helvetica").fontSize(8).text("PRO.", 50, footerY + 22, {
    width: doc.page.width - 100,
    align: "right",
  });
};

export const generateStockReceiptPdf = async (receiptData) => {
  if (!receiptData) {
    throw new Error("Receipt data is required to generate PDF");
  }

  try {
    const tempDir = process.env.CHALAN_PDF_DIR || path.join(os.tmpdir(), "receipts");
    await ensureDirectory(tempDir);

    // Replace slashes in filename to avoid directory creation issues
    const safeFilename = `${(receiptData.number || `receipt-${Date.now()}`).replace(/\//g, "_")}`;
    const filename = `${safeFilename}.pdf`;
    const filePath = path.join(tempDir, filename);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Pass tax type to addHeader for display
    const taxType = receiptData.taxType || "GST";
    addHeader(doc, receiptData.number || "", taxType);

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10).text(`Prepared By: ${receiptData.createdBy?.name || "-"}`);

    if (receiptData.clientDetails) {
      addClientDetails(doc, receiptData.clientDetails);
    }

    doc.moveDown(0.5);
    const tableInfo = addTable(doc, receiptData.items || [], doc.y + 10);

    const footerStartY = tableInfo.endY + 20;
    addFooter(doc, footerStartY);

    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log(`Stock receipt PDF generated successfully at: ${filePath}`);
        resolve();
      });
      writeStream.on("error", (err) => {
        console.error(`WriteStream error for stock receipt PDF: ${filePath}`, err);
        reject(err);
      });
    });

    return filePath;
  } catch (error) {
    console.error("Error generating stock receipt PDF:", error);
    throw error;
  }
}
