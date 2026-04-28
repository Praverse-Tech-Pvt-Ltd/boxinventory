import PDFDocument from 'pdfkit';

const formatCurrency = (amount) => {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return `INR ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const cleanPdfText = (text) =>
  String(text || '').replace(/₹/g, 'INR ').replace(/â‚¹/g, 'INR ').trim();

const cleanTermsText = (text) =>
  cleanPdfText(text).replace(/^\s*Terms\s*&\s*Conditions\s*:?\s*/i, '').trim();

/**
 * Generate a challan PDF as a Buffer (in-memory) using PDFKit.
 */
export const generateChallanPdfBuffer = async (challanData, includeGST = true) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageBottom = () => doc.page.height - doc.page.margins.bottom;
      const ensureSpace = (height) => {
        if (doc.y + height > pageBottom()) {
          doc.addPage();
        }
      };

      const drawHeader = () => {
        doc.fontSize(16).font('Helvetica-Bold').text('VISHAL PAPER PRODUCT', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('172, Khadilkar Road, Girgaon, Mumbai - 400 004', { align: 'center' });
        doc.fontSize(9).text('Mob.: +918850893493, +919004433300 | E-mail: fancycards@yahoo.com', { align: 'center' });
        doc.fontSize(9).text('GST NO.: 27BCZPS4667K1ZD', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
      };

      const columns = {
        item: { x: 50, width: 145 },
        colour: { x: 200, width: 70 },
        qty: { x: 280, width: 40 },
        productRate: { x: 330, width: 65 },
        assemblyRate: { x: 400, width: 65 },
        amount: { x: 470, width: 75 },
      };

      const drawTableHeader = () => {
        ensureSpace(42);
        const y = doc.y;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Item', columns.item.x, y, { width: columns.item.width });
        doc.text('Colour', columns.colour.x, y, { width: columns.colour.width });
        doc.text('Qty', columns.qty.x, y, { width: columns.qty.width });
        doc.text('Prod Rate', columns.productRate.x, y, { width: columns.productRate.width });
        doc.text('Assy Rate', columns.assemblyRate.x, y, { width: columns.assemblyRate.width });
        doc.text('Amount', columns.amount.x, y, { width: columns.amount.width, align: 'right' });
        doc.moveTo(50, y + 15).lineTo(545, y + 15).stroke();
        doc.y = y + 20;
      };

      const drawCellRow = (values) => {
        doc.fontSize(8).font('Helvetica');
        const rowHeight = Math.max(
          16,
          ...Object.values(values).map((cell) =>
            doc.heightOfString(cell.text || ' ', {
              width: cell.width,
              lineGap: 1,
            }) + 6
          )
        );

        if (doc.y + rowHeight > pageBottom()) {
          doc.addPage();
          drawTableHeader();
        }

        const y = doc.y;
        Object.values(values).forEach((cell) => {
          doc.text(cell.text, cell.x, y, {
            width: cell.width,
            align: cell.align || 'left',
            lineGap: 1,
          });
        });
        doc.y = y + rowHeight;
      };

      drawHeader();

      doc.fontSize(14).font('Helvetica-Bold').text('CHALLAN', { align: 'center' });
      doc.moveDown(0.3);

      const challanNumber = challanData.number || challanData.challanNumber || 'N/A';
      const challanDate = challanData.challanDate || challanData.date || new Date();
      const dateStr = new Date(challanDate).toLocaleDateString('en-IN');

      doc.fontSize(10).font('Helvetica');
      const detailY = doc.y;
      doc.text(`Challan No.: ${challanNumber}`, 50, detailY);
      doc.text(`Date: ${dateStr}`, 350, detailY);
      doc.moveDown(1);

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

      drawTableHeader();

      const items = challanData.items || [];
      if (items.length === 0) {
        drawCellRow({
          item: { ...columns.item, text: '(No items)' },
          colour: { ...columns.colour, text: '' },
          qty: { ...columns.qty, text: '' },
          productRate: { ...columns.productRate, text: '' },
          assemblyRate: { ...columns.assemblyRate, text: '' },
          amount: { ...columns.amount, text: '' },
        });
      } else {
        items.forEach((item) => {
          const itemName = item.item || item.box?.title || 'Unknown Item';
          const qty = Number(item.quantity || 0);
          const productRate = Number(item.productRate || item.rate || 0);
          const assemblyRate = Number(item.assemblyRate || item.assemblyCharge || 0);

          const colorRows = Array.isArray(item.colorLines) && item.colorLines.length > 0
            ? item.colorLines
                .map((line) => ({
                  color: String(line?.color || '').trim() || '-',
                  qty: Number(line?.quantity || 0),
                }))
                .filter((line) => line.qty > 0)
            : [{
                color: String(item.color || '').trim() ||
                  (Array.isArray(item.colours) && item.colours.length > 0 ? String(item.colours[0]).trim() : '') ||
                  (Array.isArray(item.box?.colours) && item.box.colours.length > 0 ? String(item.box.colours[0]).trim() : '') ||
                  '-',
                qty,
              }];

          (colorRows.length ? colorRows : [{ color: '-', qty }]).forEach((row, rowIndex) => {
            const lineTotal = row.qty * (productRate + assemblyRate);
            drawCellRow({
              item: { ...columns.item, text: rowIndex === 0 ? itemName : '' },
              colour: { ...columns.colour, text: row.color },
              qty: { ...columns.qty, text: String(row.qty) },
              productRate: { ...columns.productRate, text: formatCurrency(productRate) },
              assemblyRate: { ...columns.assemblyRate, text: formatCurrency(assemblyRate) },
              amount: { ...columns.amount, text: formatCurrency(lineTotal), align: 'right' },
            });
          });
        });
      }

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.y += 10;

      const itemsSubtotal = Number(challanData.items_subtotal) || 0;
      const assemblyTotal = Number(challanData.assembly_total) || 0;
      const packagingTotal = Number(challanData.packaging_charges_overall) || 0;
      const discountAmount = Number(challanData.discount_amount) || 0;
      const discountPct = Number(challanData.discount_pct) || 0;
      const taxableAmount = Number(challanData.taxable_subtotal || challanData.taxableAmount) || 0;
      const gstAmount = Number(challanData.gst_amount || challanData.gstAmount) || 0;
      const totalAmount = Number(challanData.grand_total || challanData.totalAmount) || 0;
      const paymentMode = challanData.payment_mode || 'Not Specified';
      const labelCol = 360;
      const valueCol = 470;
      const lineHeight = 16;

      ensureSpace(includeGST ? 158 : 142);
      let yPosition = doc.y;
      const totalLine = (label, value, options = {}) => {
        doc.fontSize(options.size || 9).font(options.bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(label, labelCol, yPosition, { width: 105, align: 'right' });
        doc.text(value, valueCol, yPosition, { width: 75, align: 'right' });
        yPosition += options.gap || lineHeight;
      };

      totalLine('Items Subtotal:', formatCurrency(itemsSubtotal));
      totalLine('Assembly Total:', formatCurrency(assemblyTotal));
      totalLine('Packaging Charges:', formatCurrency(packagingTotal));
      totalLine(`Discount (${discountPct || 0}%):`, discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : formatCurrency(0), { gap: lineHeight + 3 });
      doc.moveTo(labelCol, yPosition).lineTo(545, yPosition).stroke();
      yPosition += 8;
      totalLine('Taxable Subtotal:', formatCurrency(taxableAmount), { bold: true });
      if (includeGST) {
        totalLine('GST (5%):', formatCurrency(gstAmount), { gap: lineHeight + 3 });
      }
      doc.moveTo(labelCol, yPosition).lineTo(545, yPosition).stroke();
      yPosition += 8;
      totalLine('Grand Total:', formatCurrency(totalAmount), { bold: true, size: 11, gap: 20 });
      doc.y = yPosition;

      const remarksText = cleanPdfText(challanData.remarks);
      const termsText = cleanTermsText(challanData.notes);
      const remarksContentHeight = remarksText
        ? Math.max(28, doc.heightOfString(remarksText, { width: 495, lineGap: 2 }) + 8)
        : 0;
      const termsContentHeight = termsText
        ? Math.max(42, doc.heightOfString(termsText, { width: 495, lineGap: 2 }) + 8)
        : 0;
      const detailsHeight =
        17 +
        (remarksText ? 10 + remarksContentHeight : 0) +
        (termsText ? 10 + termsContentHeight : 0) +
        8;
      ensureSpace(detailsHeight);

      yPosition = doc.y;
      doc.fontSize(9).font('Helvetica-Bold').text('Payment Mode: ', 50, yPosition, { continued: true });
      doc.font('Helvetica').text(paymentMode);
      yPosition += 15;

      if (remarksText) {
        doc.fontSize(8).font('Helvetica-Bold').text('Remarks:', 50, yPosition);
        yPosition += 10;
        doc.fontSize(8).font('Helvetica').text(remarksText, 50, yPosition, { width: 495, lineGap: 2 });
        yPosition += remarksContentHeight;
      }

      if (termsText) {
        doc.fontSize(8).font('Helvetica-Bold').text('Terms & Conditions:', 50, yPosition);
        yPosition += 10;
        doc.fontSize(8).font('Helvetica').text(termsText, 50, yPosition, { width: 495, lineGap: 2 });
        yPosition += termsContentHeight;
      }

      doc.y = yPosition + 5;
      ensureSpace(18);
      doc.fontSize(7).text('Generated by: Vishal Paper Product | Challan Management System', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default { generateChallanPdfBuffer };
