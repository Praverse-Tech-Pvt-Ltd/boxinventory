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

      // Table header - UPDATED: Show separate Product Rate and Assembly Rate columns
      const tableTop = doc.y;
      const col1 = 50;    // Item
      const col2 = 155;   // Qty
      const col3 = 210;   // Product Rate
      const col4 = 290;   // Assembly Rate
      const col5 = 370;   // Amount

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Item', col1, tableTop);
      doc.text('Qty', col2, tableTop);
      doc.text('Prod Rate', col3, tableTop);
      doc.text('Assy Rate', col4, tableTop);
      doc.text('Amount', col5, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

      // Table rows - UPDATED: Show separate product and assembly rates
      let yPosition = tableTop + 20;
      const items = challanData.items || [];

      if (items.length === 0) {
        doc.fontSize(9).font('Helvetica').text('(No items)', col1, yPosition);
        yPosition += 20;
      } else {
        items.forEach((item) => {
          const itemName = item.item || item.box?.title || 'Unknown Item';
          const qty = item.quantity || 0;
          // Support both bifurcated and combined rate formats
          const productRate = Number(item.productRate || item.rate || 0);
          const assemblyRate = Number(item.assemblyRate || item.assemblyCharge || 0);
          const lineProductAmount = qty * productRate;
          const lineAssemblyAmount = qty * assemblyRate;
          const lineTotal = lineProductAmount + lineAssemblyAmount;

          doc.fontSize(8).font('Helvetica');
          doc.text(itemName, col1, yPosition, { width: 100, height: 40 });
          doc.text(String(qty), col2, yPosition);
          doc.text(formatCurrency(productRate), col3, yPosition);
          doc.text(formatCurrency(assemblyRate), col4, yPosition);
          doc.text(formatCurrency(lineTotal), col5, yPosition);

          yPosition += 25;
        });
      }

      doc.moveTo(50, yPosition).lineTo(545, yPosition).stroke();
      yPosition += 8;

      // Totals section - UPDATED: Reflect bifurcated rates structure with reduced spacing
      const itemsSubtotal = challanData.items_subtotal || 0;
      const assemblyTotal = challanData.assembly_total || 0;
      const packagingTotal = challanData.packaging_charges_overall || 0;
      const discountAmount = challanData.discount_amount || 0;
      const discountPct = challanData.discount_pct || 0;
      const taxableAmount = challanData.taxable_subtotal || challanData.taxableAmount || 0;
      const gstAmount = challanData.gst_amount || challanData.gstAmount || 0;
      const totalAmount = challanData.grand_total || challanData.totalAmount || 0;
      const paymentMode = challanData.payment_mode || "Not Specified";

      console.log('[PDF] Totals:', { itemsSubtotal, assemblyTotal, packagingTotal, discountAmount, taxableAmount, gstAmount, totalAmount });
      
      // Right-align totals using table-like positioning
      const labelCol = 350;
      const valueCol = 480;
      const lineHeight = 15;

      doc.fontSize(8).font('Helvetica');
      doc.text('Items Subtotal:', labelCol, yPosition);
      doc.text(formatCurrency(itemsSubtotal), valueCol, yPosition);
      yPosition += lineHeight;
      
      doc.text('Assembly Total:', labelCol, yPosition);
      doc.text(formatCurrency(assemblyTotal), valueCol, yPosition);
      yPosition += lineHeight;
      
      if (packagingTotal > 0) {
        doc.text('Packaging Charges:', labelCol, yPosition);
        doc.text(formatCurrency(packagingTotal), valueCol, yPosition);
        yPosition += lineHeight;
      }
      
      if (discountAmount > 0) {
        const discountLabel = discountPct > 0 ? `Discount (${discountPct}%):` : 'Discount:';
        doc.text(discountLabel, labelCol, yPosition);
        doc.text(`-${formatCurrency(discountAmount)}`, valueCol, yPosition);
        yPosition += lineHeight;
      }
      
      doc.font('Helvetica-Bold');
      doc.text('Taxable Subtotal:', labelCol, yPosition);
      doc.text(formatCurrency(taxableAmount), valueCol, yPosition);
      yPosition += lineHeight;
      
      if (includeGST) {
        doc.font('Helvetica');
        doc.text('GST (5%):', labelCol, yPosition);
        doc.text(formatCurrency(gstAmount), valueCol, yPosition);
        yPosition += lineHeight;
      }

      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Grand Total:', labelCol, yPosition);
      doc.text(formatCurrency(totalAmount), valueCol, yPosition);
      yPosition += 18;

      // KEEP-TOGETHER BLOCK: Payment Mode + Notes + Terms (move entire block if doesn't fit)
      // Calculate required space for this block
      const keepTogetherBlockSize = 50; // Approximate height needed
      const pageHeight = 841.89; // A4 height in points
      const footerMargin = 50;
      
      if (yPosition + keepTogetherBlockSize > pageHeight - footerMargin) {
        // Block doesn't fit on current page, add new page
        doc.addPage();
        yPosition = 50;
      }

      // Payment Mode section
      doc.fontSize(8).font('Helvetica');
      doc.text(`Payment Mode: ${paymentMode}`, 50, yPosition);
      yPosition += 12;

      // Notes section
      if (challanData.notes) {
        doc.fontSize(8).font('Helvetica-Bold').text('Notes:', 50, yPosition);
        yPosition += 10;
        doc.fontSize(8).font('Helvetica').text(challanData.notes, 50, yPosition, { width: 495 });
        yPosition += 15;
      }

      // Footer
      doc.moveDown(1);
      doc.fontSize(7).text('Generated by: Vishal Paper Product | Challan Management System', { align: 'center' });
      doc.fontSize(6).text('[PDF Generator v1.3 - Build: a95ca10]', { align: 'center', color: '#999999' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default { generateChallanPdfBuffer };
