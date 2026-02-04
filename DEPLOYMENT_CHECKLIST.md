# Assembly Charges Fix - Deployment Checklist

## Pre-Deployment Verification (DO THIS FIRST)

- [ ] Backend syntax valid: `node -c backend/server.js` 
- [ ] Frontend compiles: `cd client && npm run build`
- [ ] No console errors in Node output
- [ ] Database has `items_subtotal` and `assembly_total` fields in Challan schema
- [ ] All 4 modified files saved correctly
- [ ] Both new utility files created

## Deployment Steps

### 1. Backend Deployment
- [ ] Stop running backend server
- [ ] Copy `/backend/utils/calculateChallanTotals.js` to backend
- [ ] Verify import in `challanController.js` line 15
- [ ] Verify createChallan uses utility (line 443)
- [ ] Verify downloadChallanPdf passes items_subtotal (line 630)
- [ ] Verify `challanPdfGenerator.js` shows Assembly line (line 377)
- [ ] Verify `pdfGeneratorBuffer.js` shows Assembly line (line 138)
- [ ] Start backend: `npm start` from backend directory
- [ ] Check logs: "Server running on port 5000" or similar
- [ ] No errors in startup logs

### 2. Frontend Deployment  
- [ ] Stop running frontend dev server
- [ ] Copy `/client/src/utils/calculateChallanTotals.js` to client
- [ ] Verify import in `ChallanGeneration.jsx` line 9
- [ ] Verify summary uses utility (line 685)
- [ ] Verify UI displays assembly line (line 1473)
- [ ] Start frontend: `npm run dev` from client directory
- [ ] Check: "Local: http://localhost:5175" appears
- [ ] No compile errors

### 3. Test in Browser
- [ ] Open: `http://localhost:5175/admin/challan-generation`
- [ ] Page loads without errors
- [ ] No red error messages in console

## Acceptance Testing (Run These Tests)

### Test 1: Assembly Charges Visible in UI
**Setup:**
- Go to Challan Generation
- Add an item: qty=10, rate=25, assemblyCharge=5

**Expected:**
```
In Summary section:
Items Subtotal:      ₹250.00
Assembly Charges:    ₹50.00     ← MUST BE VISIBLE
```

**Verify:** 
- [ ] Items Subtotal = 250 (10 × 25) ✓
- [ ] Assembly Charges = 50 (10 × 5) ✓
- [ ] Both lines visible ✓
- [ ] No error in console ✓

---

### Test 2: Zero Assembly Still Shown
**Setup:**
- Create challan with assemblyCharge=0

**Expected:**
```
In Summary section:
Assembly Charges:    ₹0.00      ← STILL VISIBLE, NOT HIDDEN
```

**Verify:**
- [ ] Assembly line appears ✓
- [ ] Shows ₹0.00 ✓
- [ ] Not hidden even though zero ✓

---

### Test 3: PDF Download
**Setup:**
- Create challan with assembly charges (e.g., 10 qty, 25 rate, 5 assembly)
- Click Download PDF

**Expected PDF:**
```
Items Subtotal:         ₹250.00
Assembly Charges:       ₹50.00     ← MUST BE SEPARATE LINE
Taxable Subtotal:       ₹300.00
GST (5%):              ₹15.00
Grand Total:           ₹315
```

**Verify:**
- [ ] PDF downloads successfully ✓
- [ ] Assembly Charges line visible ✓
- [ ] Amount is ₹50.00 (10 × 5) ✓
- [ ] Taxable Subtotal = Items + Assembly ✓
- [ ] Calculation chain correct ✓

---

### Test 4: Discount Calculation
**Setup:**
- qty=10, rate=50, assembly=10
- Add 10% discount
- No packaging, no other charges

**Expected:**
```
Items Subtotal:         ₹500.00
Assembly Charges:       ₹100.00
Pre-discount Subtotal:  ₹600.00 (implicit)
Discount (10%):         -₹60.00    (10% of 600, NOT just items)
Taxable Subtotal:       ₹540.00
GST (5%):              ₹27.00
Grand Total:           ₹567
```

**Verify:**
- [ ] Pre-discount = Items + Assembly (600) ✓
- [ ] Discount = 10% of 600 = 60 ✓
- [ ] NOT 10% of items only (which would be 50) ✓
- [ ] Taxable = 600 - 60 = 540 ✓
- [ ] GST = 540 × 0.05 = 27 ✓

---

### Test 5: Edit and Update
**Setup:**
- Create challan with assemblyCharge=5
- Click Edit
- Change assemblyCharge to 15
- Check UI updates before saving

**Expected:**
- UI totals should update in real-time

**Verify:**
- [ ] Assembly Charges value changes immediately ✓
- [ ] Totals recalculate as you type ✓
- [ ] No lag or errors ✓

---

### Test 6: Non-GST Challan
**Setup:**
- Create Non-GST challan
- Include assembly charges

**Expected:**
```
In PDF/UI:
Assembly Charges:       ₹X.XX
Taxable Subtotal:       ₹Y.YY
GST (0% - Non-GST):     ₹0.00
Grand Total:           ₹Y.YY
```

**Verify:**
- [ ] Assembly shown correctly ✓
- [ ] GST shows as 0% ✓
- [ ] No GST amount added ✓

---

## Rollback Procedure (If Issues Found)

If tests fail:
1. Stop servers
2. Revert the 4 modified files to previous versions
3. Remove the 2 new utility files
4. Restart servers
5. Verify old behavior returns

## Performance Check

- [ ] Page loads in <2 seconds
- [ ] No memory leaks (check DevTools)
- [ ] PDF generation <5 seconds
- [ ] No CPU spike during calculations
- [ ] Multiple challan creations don't slow down system

## Final Sign-Off

- [ ] All 6 tests passed
- [ ] No errors in browser console
- [ ] No errors in backend logs
- [ ] Performance acceptable
- [ ] Ready for production ✓

---

## Quick Verification Commands

```bash
# Test 1: Backend syntax
cd backend
node -c server.js
# Should output nothing (no errors)

# Test 2: Frontend build
cd ../client
npm run build
# Should show "✓ built successfully"

# Test 3: Check calculation utility
# From browser console:
import { calculateChallanTotals } from './utils/calculateChallanTotals.js'
const result = calculateChallanTotals(
  [{rate: 25, assemblyCharge: 5, quantity: 10}],
  {packagingChargesOverall: 0, discountPct: 0, taxType: 'GST'}
);
console.log(result);
// Should show: { itemsSubtotal: 250, assemblyTotal: 50, ... }
```

---

## Support Contacts

If issues arise:
- Check `/ASSEMBLY_CHARGES_FIX_COMPLETE.md` for detailed troubleshooting
- Check browser console for specific error messages
- Check backend logs for calculation errors
- Verify database record has all required fields

---

**Date Completed:** February 3, 2026
**Status:** READY FOR DEPLOYMENT ✅
