# Quick Testing Guide - Discount Feature & PDF Download

## ✅ What Was Changed

### A. Discount Feature (Percentage-wise)
✓ Added discount (%) input field in Challan Summary  
✓ Auto-calculates discount amount in INR  
✓ Shows breakdown: Items Total → Packaging → Discount → Taxable Subtotal → GST → Grand Total  
✓ Displays "You saved ₹X" when discount > 0  
✓ Backend calculates all values server-side (do NOT trust frontend math)  
✓ PDF shows discount clearly with minus sign  

### B. PDF Download Fix  
✓ Backend returns proper PDF stream (not wrapped in JSON)  
✓ Frontend receives blob and triggers browser download  
✓ Added error handling and validation  
✓ Works in Chrome, Edge, Firefox  

---

## 🧪 Quick Testing Steps

### Test 1: Create Challan with No Discount
1. Go to Challan Generation page
2. Select items (audited or manual)
3. Leave Discount (%) field as 0
4. Fill other required fields
5. Click "Create Challan"
6. Verify: Totals unchanged, no discount line in summary

### Test 2: Create Challan with 5% Discount
1. Go to Challan Generation page
2. Select items with total = ₹1000
3. Set Packaging Charges = ₹100 (optional)
4. Set Discount (%) = 5
5. Verify Frontend Calculation:
   - Items Total = ₹1000
   - Pre-Discount Subtotal = ₹1100 (if packaging added)
   - Discount Amount = ₹55 (5% of 1100)
   - Taxable Subtotal = ₹1045
   - GST (5%) = ₹52.25
   - Grand Total = ₹1097
6. Click "Create Challan"
7. Verify: Challan saved with discount_pct=5, discount_amount=55

### Test 3: Download PDF with Discount
1. Create a challan with discount (see Test 2)
2. Go to "Recent Challans" section
3. Click "Download" button on the challan
4. Verify:
   - File downloads successfully
   - Filename contains challan number
   - PDF opens without errors
   - PDF shows:
     * Items Total: ₹1000
     * Packaging Charges: ₹100 (if added)
     * Discount (5%): -₹55 ← In amber/red color
     * Taxable Subtotal: ₹1045
     * GST @ 5%: ₹52.25
     * TOTAL (Rounded): ₹1097

### Test 4: Download PDF without Discount
1. Create a challan with NO discount
2. Click "Download" button
3. Verify:
   - File downloads successfully
   - PDF does NOT show discount line
   - All other totals correct

### Test 5: Edge Case - Very Small Discount
1. Create challan with items = ₹1000
2. Set Discount (%) = 0.5
3. Verify calculation:
   - Discount Amount = ₹5 (0.5% of 1000, rounded to 2 decimals)
   - Taxable Subtotal = ₹995
   - GST = ₹49.75
   - Grand Total = ₹1045
4. Download PDF and verify all values match

### Test 6: Download Multiple Times
1. Create a challan
2. Click "Download" 3 times rapidly
3. Verify: All 3 PDFs download successfully without errors

---

## 🔍 Backend Verification

### Check Database Record
```bash
# Connect to MongoDB
db.challans.findOne({_id: ObjectId("...")})

# Verify fields:
# - discount_pct: 5
# - discount_amount: 55.00
# - taxable_subtotal: 1045.00
# - gst_amount: 52.25
# - grand_total: 1097
```

### Check Logs
```bash
# Backend console should show:
[createChallan] Discount calculation: discountPct=5, discountAmount=55
[Download] PDF generated successfully: /tmp/challans/VPP_26-27_0001.pdf
[Download] Sending PDF file: /tmp/challans/VPP_26-27_0001.pdf
[Download] PDF sent successfully to client
```

---

## 📊 Calculation Verification

### Manual Calculation Example
**Items:** Box A (qty=100, rate=10) = ₹1000  
**Packaging:** ₹100  
**Discount:** 5%

**Step-by-step:**
1. Items Total = 100 × 10 = ₹1000
2. Pre-Discount Subtotal = 1000 + 100 = ₹1100
3. Discount Amount = 1100 × 5 / 100 = ₹55
4. Taxable Subtotal = 1100 - 55 = ₹1045
5. GST = 1045 × 0.05 = ₹52.25
6. Grand Total = round(1045 + 52.25) = ₹1097

**Frontend should show:** ₹1097  
**PDF should show:** INR 1097.00  
**Backend should store:** 1097

---

## ✨ Success Criteria

- [x] Frontend shows discount input (0-100%)
- [x] Summary updates in real-time as discount changes
- [x] "You saved ₹X" appears when discount > 0
- [x] Backend calculates server-side (independent of frontend)
- [x] PDF displays discount clearly with minus sign
- [x] PDF downloads successfully every time
- [x] Works for GST and Non-GST challans
- [x] Handles edge cases (0%, 100%, fractional %)
- [x] No console errors
- [x] Backward compatible with existing challans

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| PDF doesn't download | Check browser console → check backend logs → verify Content-Type header |
| Discount amount incorrect | Verify all calculations use 2-decimal rounding → check backend logs |
| "You saved" label missing | Ensure discountAmount > 0 → check frontend state |
| Old challans show errors | Discount fields default to 0 → should display correctly |
| PDF missing discount line | Expected if discount_pct = 0 → PDF skips discount section |

---

## 📝 Notes

- Discount is **percentage-only** (not fixed amount)
- Discount range: **0-100%**
- Default discount: **0%**
- GST is **always 5%** for GST challans, **0%** for Non-GST challans
- All monetary values rounded to **2 decimals**
- Server calculates all totals (**trust backend, not frontend**)
- If discount = 0%, display is clean (no "Discount (0%)" line in PDF)

---

**Last Updated:** January 30, 2026  
**Implementation Status:** ✅ Complete
