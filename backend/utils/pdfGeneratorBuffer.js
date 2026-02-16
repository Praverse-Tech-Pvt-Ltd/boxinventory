import PDFDocument from 'pdfkit';

/**
 * Generate a challan PDF as a Buffer (in-memory) using PDFKit.
 * This is serverless-friendly and avoids filesystem writes.
 * 
 * @param {Object} challanData - Challan data with items, totals, client details
 * @param {boolean} includeGST - Whether to include GST (default: true)
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateChallanPdfBuffer = async (challanData, includeGST = true) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper function to format currency
      const formatCurrency = (amount) => {
        const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
        return `₹${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
      };

      // Header - UPDATED: Use correct mobile number format with two numbers
      doc.fontSize(16).font('Helvetica-Bold').text('VISHAL PAPER PRODUCT', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('172, Khadilkar Road, Girgaon, Mumbai - 400 004', { align: 'center' });
      doc.fontSize(9).text('Mob.: +918850893493, +919004433300 | E-mail: fancycards@yahoo.com', { align: 'center' });
      doc.fontSize(9).text('GST NO.: 27BCZPS4667K1ZD', { align: 'center' });

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // Challan title and details
      doc.fontSize(14).font('Helvetica-Bold').text('CHALLAN', { align: 'center' });
      doc.moveDown(0.3);

      const challanNumber = challanData.number || challanData.challanNumber || 'N/A';
      const challanDate = challanData.challanDate || challanData.date || new Date();
      const dateStr = new Date(challanDate).toLocaleDateString('en-IN');

      doc.fontSize(10).font('Helvetica');
      doc.text(`Challan No.: ${challanNumber}`, 50, doc.y);
      doc.text(`Date: ${dateStr}`, 350, doc.y - 15);

      doc.moveDown(1);

      // Client details
      const clientName = challanData.clientDetails?.name || challanData.clientName || 'Unnamed Client';
      const clientAddress = challanData.clientDetails?.address || '';
      const clientMobile = challanData.clientDetails?.mobile || '';
      const clientGST = challanData.clientDetails?.gstNumber || '';

      doc.fontSize(10).font('Helvetica-Bold').text('Bill To:');
      doc.fontSize(9).font('Helvetica');
      doc.text(`Name: ${clientName}`);
      if (clientAddress) doc.text(`Address: ${clientAddress}`);
      if (clientMobile) doc.text(`Mobile: ${clientMobile}`);
      if (clientGST) doc.text(`GST: ${clientGST}`);

      doc.moveDown(0.5);

      // Table header - include Colour between Item and Qty
      const tableTop = doc.y;
      const col1 = 50;    // Item
      const col2 = 200;   // Colour
      const col3 = 280;   // Qty
      const col4 = 330;   // Product Rate
      const col5 = 400;   // Assembly Rate
      const col6 = 470;   // Amount

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Item', col1, tableTop, { width: 145, lineBreak: false });
      doc.text('Colour', col2, tableTop, { width: 70, lineBreak: false });
      doc.text('Qty', col3, tableTop, { width: 40, lineBreak: false });
      doc.text('Prod Rate', col4, tableTop, { width: 65, lineBreak: false });
      doc.text('Assy Rate', col5, tableTop, { width: 65, lineBreak: false });
      doc.text('Amount', col6, tableTop, { width: 75, align: 'right', lineBreak: false });

      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

      // Table rows - show color inline between item and qty
      let yPosition = tableTop + 20;
      const items = challanData.items || [];

      if (items.length === 0) {
        doc.fontSize(9).font('Helvetica').text('(No items)', col1, yPosition);
        yPosition += 20;
      } else {
        items.forEach((item) => {
          const itemName = item.item || item.box?.title || 'Unknown Item';
          const qty = Number(item.quantity || 0);
          // Support both bifurcated and combined rate formats
          const productRate = Number(item.productRate || item.rate || 0);
          const assemblyRate = Number(item.assemblyRate || item.assemblyCharge || 0);

          const itemColorRows = Array.isArray(item.colorLines) && item.colorLines.length > 0
            ? item.colorLines
                .map((line) => ({
                  color: String(line?.color || '').trim() || '-',
                  qty: Number(line?.quantity || 0),
                }))
                .filter((line) => line.qty > 0)
            : [{
                color: String(item.color || '').trim() || '-',
                qty,
              }];

          const rowsToPrint = itemColorRows.length > 0 ? itemColorRows : [{ color: '-', qty }];

          rowsToPrint.forEach((row, rowIndex) => {
            const lineProductAmount = row.qty * productRate;
            const lineAssemblyAmount = row.qty * assemblyRate;
            const lineTotal = lineProductAmount + lineAssemblyAmount;

            doc.fontSize(8).font('Helvetica');
            doc.text(rowIndex === 0 ? itemName : '', col1, yPosition, { width: 145, lineBreak: false });
            doc.text(row.color, col2, yPosition, { width: 70, lineBreak: false });
            doc.text(String(row.qty), col3, yPosition, { width: 40, lineBreak: false });
            doc.text(formatCurrency(productRate), col4, yPosition, { width: 65, lineBreak: false });
            doc.text(formatCurrency(assemblyRate), col5, yPosition, { width: 65, lineBreak: false });
            doc.text(formatCurrency(lineTotal), col6, yPosition, { width: 75, align: 'right', lineBreak: false });
            yPosition += 16;
          });
        });
      }

      doc.moveTo(50, yPosition).lineTo(545, yPosition).stroke();
      yPosition += 10;

      // Totals section - Clean right-aligned format
      const itemsSubtotal = Number(challanData.items_subtotal) || 0;
      const assemblyTotal = Number(challanData.assembly_total) || 0;
      const packagingTotal = Number(challanData.packaging_charges_overall) || 0;
      const discountAmount = Number(challanData.discount_amount) || 0;
      const discountPct = Number(challanData.discount_pct) || 0;
      const taxableAmount = Number(challanData.taxable_subtotal || challanData.taxableAmount) || 0;
      const gstAmount = Number(challanData.gst_amount || challanData.gstAmount) || 0;
      const totalAmount = Number(challanData.grand_total || challanData.totalAmount) || 0;
      const paymentMode = challanData.payment_mode || "Not Specified";

      console.log('[PDF] Totals:', { itemsSubtotal, assemblyTotal, packagingTotal, discountAmount, discountPct, taxableAmount, gstAmount, totalAmount });
      
      // Right-align totals
      const labelCol = 380;
      const valueCol = 490;
      const lineHeight = 16;

      doc.fontSize(9).font('Helvetica');
      
      // Items Subtotal
      doc.text('Items Subtotal:', labelCol, yPosition);
      doc.text(formatCurrency(itemsSubtotal), valueCol, yPosition, { width: 55, align: 'right' });
      yPosition += lineHeight;
      
      // Assembly Total
      doc.text('Assembly Total:', labelCol, yPosition);
      doc.text(formatCurrency(assemblyTotal), valueCol, yPosition, { width: 55, align: 'right' });
      yPosition += lineHeight;
      
      // Packaging Charges (always show)
      doc.text('Packaging Charges:', labelCol, yPosition);
      doc.text(formatCurrency(packagingTotal), valueCol, yPosition, { width: 55, align: 'right' });
      yPosition += lineHeight;
      
      // Discount (always show with percentage)
      const discountLabel = discountPct > 0 ? `Discount (${discountPct}%):` : 'Discount (0%):';
      doc.text(discountLabel, labelCol, yPosition);
      const discountDisplay = discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : formatCurrency(0);
      doc.text(discountDisplay, valueCol, yPosition, { width: 55, align: 'right' });
      yPosition += lineHeight + 3;
      
      // Separator line
      doc.moveTo(labelCol, yPosition).lineTo(545, yPosition).stroke();
      yPosition += 8;
      
      // Taxable Subtotal (bold)
      doc.font('Helvetica-Bold');
      doc.text('Taxable Subtotal:', labelCol, yPosition);
      doc.text(formatCurrency(taxableAmount), valueCol, yPosition, { width: 55, align: 'right' });
      yPosition += lineHeight;
      
      // GST (if applicable)
      if (includeGST) {
        doc.font('Helvetica');
        doc.text('GST (5%):', labelCol, yPosition);
        doc.text(formatCurrency(gstAmount), valueCol, yPosition, { width: 55, align: 'right' });
        yPosition += lineHeight + 3;
      }
      
      // Final separator
      doc.moveTo(labelCol, yPosition).lineTo(545, yPosition).stroke();
      yPosition += 8;
      
      // Grand Total (bold and larger)
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Grand Total:', labelCol, yPosition);
      doc.text(formatCurrency(totalAmount), valueCol, yPosition, { width: 55, align: 'right' });
      yPosition += 20;

      // KEEP-TOGETHER BLOCK: Payment Mode + Remarks + Notes (move entire block if doesn't fit)
      // Calculate required space for this block
      const keepTogetherBlockSize = 50; // Approximate height needed
      const pageHeight = 841.89; // A4 height in points
      const footerMargin = 50;
      
      if (yPosition + keepTogetherBlockSize > pageHeight - footerMargin) {
        // Block doesn't fit on current page, add new page
        doc.addPage();
        yPosition = 50;
      }

      // Payment Mode section (ONLY ONCE)
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Payment Mode: ', 50, yPosition, { continued: true });
      doc.font('Helvetica').text(paymentMode);
      yPosition += 15;

      // Remarks section (if present)
      if (challanData.remarks && challanData.remarks.trim()) {
        doc.fontSize(8).font('Helvetica-Bold').text('Remarks:', 50, yPosition);
        yPosition += 10;
        doc.fontSize(8).font('Helvetica').text(challanData.remarks, 50, yPosition, { width: 495 });
        yPosition += 15;
      }

      // Notes/Terms & Conditions section
      if (challanData.notes) {
        doc.fontSize(8).font('Helvetica-Bold').text('Terms & Conditions:', 50, yPosition);
        yPosition += 10;
        doc.fontSize(8).font('Helvetica').text(challanData.notes, 50, yPosition, { width: 495 });
        yPosition += 15;
      }

      // Footer
      doc.moveDown(1);
      doc.fontSize(7).text('Generated by: Vishal Paper Product | Challan Management System', { align: 'center' });
      doc.fontSize(6).text('[PDF Generator v1.9 - Service Layer Fix Applied]', { align: 'center', color: '#999999' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default { generateChallanPdfBuffer };
