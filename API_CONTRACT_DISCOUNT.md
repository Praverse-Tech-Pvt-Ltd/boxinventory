# API Contract - Discount Feature

## POST /api/challans - Create Challan

### Request Body (New Field)

```json
{
  "auditIds": ["id1", "id2"],
  "manualItems": [...],
  "terms": "...",
  "note": "...",
  "clientDetails": {...},
  "hsnCode": "481920",
  "inventory_mode": "record_only|dispatch|inward",
  "challanTaxType": "GST|NON_GST",
  "payment_mode": "Cash|GPay|Bank Account|Credit",
  "remarks": "...",
  "packaging_charges_overall": 100.50,
  "discount_pct": 5.0              // NEW: Percentage discount (0-100)
}
```

### Response Body (New Fields)

```json
{
  "_id": "ObjectId",
  "number": "VPP/26-27/0001",
  "challan_seq": 1,
  "challan_fy": "26-27",
  "challan_tax_type": "GST",
  "items": [...],
  "notes": "...",
  "includeGST": true,
  "createdBy": "ObjectId",
  "hsnCode": "481920",
  "inventory_mode": "record_only",
  "clientDetails": {...},
  "payment_mode": "Cash",
  "remarks": "...",
  
  "packaging_charges_overall": 100.50,      // Overall packaging charges
  "discount_pct": 5.0,                       // NEW: Discount percentage
  "discount_amount": 55.00,                  // NEW: Calculated discount amount
  "taxable_subtotal": 1045.00,              // NEW: Subtotal after discount
  "gst_amount": 52.25,                       // NEW: Calculated GST
  "grand_total": 1097,                       // NEW: Final total (rounded)
  
  "doc_type": "OUTWARD_CHALLAN",
  "createdAt": "2026-01-30T...",
  "updatedAt": "2026-01-30T..."
}
```

### Calculation Flow (Server-Side)

```javascript
// 1. Calculate items total
itemsTotal = Σ(rate + assemblyCharge) * quantity

// 2. Add packaging
preDiscountSubtotal = itemsTotal + packagingCharges

// 3. Apply discount (percentage-based)
discountAmount = round2(preDiscountSubtotal * discountPct / 100)

// 4. Calculate taxable amount
taxableSubtotal = round2(preDiscountSubtotal - discountAmount)

// 5. Calculate GST (5% for GST challan, 0% for Non-GST)
gstAmount = round2(taxableSubtotal * 0.05)

// 6. Round final total
grandTotal = Math.round(taxableSubtotal + gstAmount)
```

### Notes

- **discountPct**: User-provided percentage (0-100)
  - Validated on backend: `Math.min(Math.max(discountPct, 0), 100)`
  - Default: 0 (no discount)
  - Validation: Frontend enforces min=0, max=100; Backend re-validates

- **discountAmount**: Calculated amount in INR (read-only from frontend)
  - Formula: `round2(preDiscountSubtotal * discountPct / 100)`
  - Stored in database for audit trail
  - Used in PDF generation

- **taxable_subtotal**: Amount subject to GST (after discount)
  - Formula: `round2(preDiscountSubtotal - discountAmount)`
  - Critical for GST calculation

- **gst_amount**: GST calculated on taxable subtotal (not original amount)
  - Formula: `round2(taxableSubtotal * 0.05)` (5% for GST mode)
  - Formula: `0` (for Non-GST mode)
  - **Important**: GST applies AFTER discount

- **grand_total**: Final rounded total
  - Formula: `Math.round(taxableSubtotal + gstAmount)`
  - This is the amount client pays

### Example Request-Response

**Request:**
```json
{
  "auditIds": ["612abc", "612def"],
  "clientDetails": {
    "name": "ABC Corp",
    "address": "123 Main St",
    "mobile": "9876543210",
    "gstNumber": "27ABCPQ1234K1Z5"
  },
  "packaging_charges_overall": 100,
  "discount_pct": 5,
  "challanTaxType": "GST",
  "terms": "...",
  "inventory_mode": "record_only"
}
```

**Response:**
```json
{
  "_id": "67a1b2c3d4e5f6g7h8i9j0k1",
  "number": "VPP/26-27/0042",
  "items": [
    {
      "audit": "612abc",
      "box": {...},
      "quantity": 100,
      "rate": 10.00,
      "assemblyCharge": 0,
      ...
    }
  ],
  "packaging_charges_overall": 100,
  "discount_pct": 5,
  "discount_amount": 55.00,      // (1000 + 100) * 5 / 100 = 55
  "taxable_subtotal": 1045.00,   // 1100 - 55 = 1045
  "gst_amount": 52.25,           // 1045 * 0.05 = 52.25
  "grand_total": 1097,           // round(1045 + 52.25) = 1097
  "challan_tax_type": "GST",
  "createdAt": "2026-01-30T10:30:00Z",
  "updatedAt": "2026-01-30T10:30:00Z"
}
```

## GET /api/challans/:id/download - Download PDF

### Changes

- **Already Working Correctly:**
  - Endpoint returns binary PDF (not JSON)
  - Proper `Content-Type: application/pdf` header
  - Proper `Content-Disposition: attachment; filename="..."` header
  - Uses `res.download()` for streaming

- **New Data Passed to PDF Generator:**
  - `discount_pct`: Percentage discount
  - `discount_amount`: Calculated discount amount
  - `taxable_subtotal`: Amount subject to GST
  - `gst_amount`: Calculated GST amount

### PDF Output Format

**Summary Section (New Layout):**
```
Items Total                          ₹1000.00
Packaging Charges                    ₹100.00
Discount (5%)                        -₹55.00    ← Shows percentage, minus sign
Taxable Subtotal                     ₹1045.00
GST @ 5%                             ₹52.25
Round Off                            -₹0.25
────────────────────────────────────────────
TOTAL (Rounded)                  INR 1097.00
```

**Display Rules:**
- "Items Total" line: Always shown
- "Packaging Charges" line: Only if > 0
- "Discount (X%)" line: Only if discount_amount > 0
- "Taxable Subtotal" line: Always shown
- "GST @ 5%" or "GST (0% - Non-GST)" line: Always shown
- "Round Off" line: Always shown
- Discount amount displayed in amber/red color (visual emphasis)
- Minus sign (-) clearly shows deduction

## Database Schema Updates

```javascript
// In Challan Model

// New fields (added to schema):
discount_pct: {
  type: Number,
  default: 0,
  min: 0,
  max: 100,
  required: false
},
discount_amount: {
  type: Number,
  default: 0,
  required: false
},
taxable_subtotal: {
  type: Number,
  default: 0,
  required: false
},
gst_amount: {
  type: Number,
  default: 0,
  required: false
},
grand_total: {
  type: Number,
  default: 0,
  required: false
}
```

## Backward Compatibility

- **Existing Challans:** Missing fields default to 0
  - `discount_pct: 0` → no discount applied in display
  - `discount_amount: 0` → no discount shown in PDF
  - `taxable_subtotal: 0` → fallback to old calculation if needed
  - `gst_amount: 0` → fallback to old calculation if needed
  - `grand_total: 0` → fallback to old calculation if needed

- **PDF Generation:** Handles missing discount fields gracefully
  - If `discount_amount === 0`, discount line omitted from PDF
  - Calculation falls back to legacy method

- **API Versioning:** No breaking changes
  - Old clients (not sending `discount_pct`) still work
  - New clients benefit from discount feature
  - Backend always calculates server-side regardless

## Error Handling

### Validation Errors

| Scenario | Status | Response |
|----------|--------|----------|
| Invalid discount_pct (< 0) | Backend clamps to 0 | Proceeds normally |
| Invalid discount_pct (> 100) | Backend clamps to 100 | Proceeds normally |
| Invalid discount_pct (NaN) | Backend defaults to 0 | Proceeds normally |
| Non-numeric discount_pct | Backend coerces with `Number()` | Proceeds normally |
| Missing discount_pct | Backend defaults to 0 | Proceeds normally |

### PDF Download Errors

| Error | Status Code | Message |
|-------|-------------|---------|
| Document not found | 404 | "Document not found" |
| PDF generation fails | 500 | "Failed to generate PDF" |
| File path empty | 500 | "PDF file path not generated" |
| Unexpected error | 500 | "Server error" |

---

## Testing Recommendations

1. **Unit Tests:**
   - Test discount calculation formula with various inputs
   - Test rounding behavior (2 decimals)
   - Test boundary cases (0%, 100%, fractional %)

2. **Integration Tests:**
   - Create challan with discount
   - Verify database stores all new fields
   - Verify PDF generation with discount data
   - Verify PDF download works

3. **Manual Tests:**
   - Create challan with 0% discount → no discount shown
   - Create challan with 5% discount → verify amount
   - Download PDF → verify all totals in summary
   - Test with both GST and Non-GST modes

---

**API Version:** 1.0  
**Last Updated:** January 30, 2026  
**Status:** Production Ready
