import puppeteer from "puppeteer";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import os from "os";

const COMPANY = {
  name: "VISHAL PAPER PRODUCT",
  address: "172, Khadilkar Raod, Girgaon, Mumbai - 400 004",
  contact: "• Mob.: 9987257279 / 9004433300 • E-mail: fancycards@yahoo.com",
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

/**
 * Generate HTML template for challan PDF
 */
const generateChallanHTML = (challanData, taxType = "GST") => {
  const createdByName = challanData.createdBy?.name || "-";
  const challanNumber = challanData.number || "";
  const clientName = challanData.clientDetails?.name || "-";
  const clientAddress = challanData.clientDetails?.address || "-";
  const clientMobile = challanData.clientDetails?.mobile || "-";
  const clientGST = challanData.clientDetails?.gstNumber || "-";

  // Build items table rows
  let srNo = 1;
  const itemsHTML = (challanData.items || [])
    .map((item) => {
      const baseItemName = item.item || item.box?.title || "";
      const rate = Number(item.rate || 0);
      const assembly = Number(item.assemblyCharge || 0);
      const itemRate = rate + assembly;
      const qty = Number(item.quantity || 0);
      const lineTotal = itemRate * qty;

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

      // If only one color or no specific color breakdown, show as single row
      if (colorsToShow.length === 1) {
        return `<tr>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${srNo++}</td>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${baseItemName}</td>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${item.code || item.box?.code || ""}</td>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${colorsToShow[0] || ""}</td>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">${qty}</td>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">₹${itemRate.toFixed(2)}</td>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">₹${lineTotal.toFixed(2)}</td>
        </tr>`;
      } else {
        // Multiple colors - one row per color
        return colorsToShow
          .map((color, colorIdx) => {
            const isFull = colorIdx === 0;
            return `<tr>
              <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${isFull ? srNo++ : ""}</td>
              <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${isFull ? baseItemName : ""}</td>
              <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${isFull ? item.code || item.box?.code || "" : ""}</td>
              <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${color || ""}</td>
              <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">${qty}</td>
              <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">₹${itemRate.toFixed(2)}</td>
              <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">₹${lineTotal.toFixed(2)}</td>
            </tr>`;
          })
          .join("");
      }
    })
    .join("");

  // Calculate totals
  let subtotal = 0;
  (challanData.items || []).forEach((item) => {
    const rate = Number(item.rate || 0);
    const assembly = Number(item.assemblyCharge || 0);
    const itemRate = rate + assembly;
    const qty = Number(item.quantity || 0);
    subtotal += itemRate * qty;
  });

  const packagingCharges = Number(challanData.packaging_charges_overall) || 0;
  const subtotalWithPackaging = subtotal + packagingCharges;
  
  const gstRate = taxType === "NON_GST" ? 0 : 0.05;
  const gstAmount = subtotalWithPackaging * gstRate;
  const totalBeforeRound = subtotalWithPackaging + gstAmount;
  const roundedTotal = Math.round(totalBeforeRound);
  const roundOff = roundedTotal - totalBeforeRound;

  const roundOffLabel =
    roundOff > 0 ? "Round Off (Added)" : roundOff < 0 ? "Round Off (Deducted)" : "Round Off";
  const roundOffValue =
    roundOff === 0 ? formatCurrency(0) : `${roundOff > 0 ? "+" : "-"}${formatCurrency(Math.abs(roundOff))}`;

  const gstLabel = taxType === "NON_GST" ? "GST (0% - Non-GST)" : "GST (5%)";

  // Build footer section content (Payment Mode, Remarks, Terms, Note)
  // This section should stay together as one unbreakable block
  let footerContentHTML = "";
  
  if (challanData.payment_mode) {
    footerContentHTML += `<div style="margin-bottom: 6pt;">
      <div style="font-weight: bold; font-size: 10pt; margin-bottom: 2pt;">Payment Mode:</div>
      <div style="font-size: 9pt;">${challanData.payment_mode}</div>
    </div>`;
  }

  if (challanData.remarks) {
    footerContentHTML += `<div style="margin-bottom: 6pt;">
      <div style="font-weight: bold; font-size: 10pt; margin-bottom: 2pt;">Remarks:</div>
      <div style="font-size: 9pt; white-space: pre-wrap;">${challanData.remarks}</div>
    </div>`;
  }

  // Terms & Conditions - render ONCE only
  const termsToUse = challanData.terms || DEFAULT_TERMS;
  footerContentHTML += `<div style="margin-bottom: 6pt;">
    <div style="font-weight: bold; font-size: 10pt; margin-bottom: 2pt;">Terms & Conditions:</div>
    <div style="font-size: 9pt; white-space: pre-wrap; line-height: 1.4;">${termsToUse}</div>
  </div>`;

  // Note - render ONCE only
  footerContentHTML += `<div>
    <div style="font-weight: bold; font-size: 10pt; margin-bottom: 2pt;">Note:</div>
    <div style="font-size: 9pt; white-space: pre-wrap; line-height: 1.4;">${DEFAULT_NOTE}</div>
  </div>`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Delivery Challan</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 14mm; }
          body {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #000;
          }
          
          .page-break { page-break-after: always; }
          .no-break { page-break-inside: avoid; }
          
          .header {
            text-align: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #ddd;
          }
          
          .header h1 { font-size: 12pt; font-weight: bold; margin-bottom: 4px; }
          .header h2 { font-size: 14pt; font-weight: bold; margin-bottom: 4px; }
          .header p { font-size: 9pt; margin: 2px 0; }
          
          .challan-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 10pt;
          }
          
          .challan-info-left { flex: 1; }
          .challan-info-right { flex: 1; text-align: right; }
          
          .prepared-by {
            margin-bottom: 8px;
            font-size: 10pt;
          }
          
          .client-details {
            margin-bottom: 12px;
            padding: 8px;
            background-color: #f5f5f5;
            border-radius: 4px;
          }
          
          .client-details h3 {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 4px;
          }
          
          .client-detail-row {
            display: flex;
            font-size: 9pt;
            margin: 2px 0;
          }
          
          .client-detail-label {
            font-weight: bold;
            width: 80px;
            flex-shrink: 0;
          }
          
          .client-detail-value {
            flex: 1;
            margin-left: 8px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            page-break-inside: avoid;
          }
          
          thead {
            background-color: #E8DCC6;
            font-weight: bold;
          }
          
          th {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
            font-size: 9pt;
          }
          
          td {
            border: 1px solid #ccc;
            padding: 8px;
            font-size: 9pt;
          }
          
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          
          .summary-section {
            page-break-inside: avoid;
            margin: 12px 0;
            border-top: 1px solid #ccc;
            padding-top: 8px;
          }
          
          .summary-row {
            display: flex;
            justify-content: flex-end;
            margin: 4px 0;
            font-size: 10pt;
          }
          
          .summary-label {
            flex: 0 0 50%;
            text-align: right;
            padding-right: 12px;
            font-weight: bold;
          }
          
          .summary-value {
            flex: 0 0 25%;
            text-align: right;
            font-weight: bold;
          }
          
          .total-row {
            margin-top: 8px;
            font-size: 11pt;
            border-top: 2px solid #ccc;
            padding-top: 8px;
          }
          
          /* Footer block - keep entire section together */
          .footer-block {
            page-break-inside: avoid;
            margin-top: 16px;
            padding: 8px;
            border-top: 1px solid #ccc;
          }
          
          .hcn-code {
            font-weight: bold;
            font-size: 10pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>DELIVERY CHALLAN</h1>
          <h2>${COMPANY.name}</h2>
          <p>${COMPANY.address}</p>
          <p>${COMPANY.contact}</p>
          <p class="hcn-code">${COMPANY.gst}</p>
        </div>
        
        <div class="challan-info">
          <div class="challan-info-left">
            <strong>Challan No.:</strong> ${challanNumber}
          </div>
          <div class="challan-info-right">
            <strong>HSN Code:</strong> <span class="hcn-code">${HSN_CODE}</span>
          </div>
        </div>
        
        <div class="prepared-by">
          <strong>Prepared By:</strong> ${createdByName}
        </div>
        
        <div class="client-details">
          <h3>Prepared By & Client Details:</h3>
          <div class="client-detail-row">
            <div class="client-detail-label">Name:</div>
            <div class="client-detail-value">${clientName}</div>
          </div>
          <div class="client-detail-row">
            <div class="client-detail-label">Address:</div>
            <div class="client-detail-value">${clientAddress}</div>
          </div>
          <div class="client-detail-row">
            <div class="client-detail-label">Mobile:</div>
            <div class="client-detail-value">${clientMobile}</div>
          </div>
          <div class="client-detail-row">
            <div class="client-detail-label">GST No.:</div>
            <div class="client-detail-value">${clientGST}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 6%;">Sr. No.</th>
              <th style="width: 18%;">ITEM</th>
              <th class="text-center" style="width: 10%;">CODE</th>
              <th style="width: 18%;">COLOUR</th>
              <th class="text-center" style="width: 8%;">QTY.</th>
              <th class="text-right" style="width: 10%;">RATE</th>
              <th class="text-right" style="width: 10%;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        
        <div class="summary-section no-break">
          <div class="summary-row">
            <div class="summary-label">Subtotal:</div>
            <div class="summary-value">₹${formatCurrency(subtotal)}</div>
          </div>
          ${packagingCharges > 0 ? `
          <div class="summary-row">
            <div class="summary-label">Packaging Charges:</div>
            <div class="summary-value">₹${formatCurrency(packagingCharges)}</div>
          </div>
          ` : ''}
          <div class="summary-row">
            <div class="summary-label">${gstLabel}:</div>
            <div class="summary-value">₹${formatCurrency(gstAmount)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">${roundOffLabel}:</div>
            <div class="summary-value">${roundOffValue}</div>
          </div>
          <div class="summary-row total-row">
            <div class="summary-label">TOTAL (Rounded):</div>
            <div class="summary-value">₹${formatCurrency(roundedTotal)}</div>
          </div>
        </div>
        
        <!-- Footer block: kept as single unbreakable unit -->
        <div class="footer-block">
          ${footerContentHTML}
        </div>
      </body>
    </html>
  `;
};

/**
 * Render HTML to PDF using Puppeteer
 */
export const generateChallanPdf = async (challanData, includeGST = true, taxType = "GST") => {
  if (!challanData) {
    throw new Error("Challan data is required to generate PDF");
  }

  let browser;
  try {
    const tempDir = process.env.CHALAN_PDF_DIR || path.join(os.tmpdir(), "challans");
    await ensureDirectory(tempDir);

    // Generate filename
    const safeFilename = `${(challanData.number || `challan-${Date.now()}`).replace(/\//g, "_")}`;
    const filename = `${safeFilename}.pdf`;
    const filePath = path.join(tempDir, filename);

    console.log(`[PDF] Generating PDF for challan: ${challanData.number}`);
    console.log(`[PDF] Output path: ${filePath}`);

    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Generate HTML content
    const htmlContent = generateChallanHTML(challanData, taxType);

    // Set content and wait for network idle
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    // Generate PDF
    await page.pdf({
      path: filePath,
      format: "A4",
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm",
      },
      printBackground: true,
      preferCSSPageSize: true,
    });

    console.log(`[PDF] ✓ PDF generated successfully: ${filePath}`);

    return filePath;
  } catch (error) {
    console.error("[PDF] Error generating challan PDF:", error.message);
    console.error("[PDF] Stack:", error.stack);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("[PDF] Error closing browser:", closeError);
      }
    }
  }
};

export default { generateChallanPdf };
