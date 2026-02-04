# Quick Testing Guide - All 8 Requirements

**Last Updated:** February 3, 2026

---

## A) Financial Year Logic - DISPATCH Challans Only

### Test Case: Create challan on January 30, 2026

**Steps:**
1. Go to ChallanGeneration page
2. Select audit item(s) to dispatch
3. Ensure `inventory_mode` is set to "dispatch"
4. Set challanDate to 2026-01-30
5. Create challan

**Expected Result:**
- Challan number format: `VPP/25-26/0003` (FY is 25-26, NOT 26-27)
- Challan displays as ACTIVE in recent list
- DISPATCH mode visible in list (if you check inventory_mode field)

**Verification SQL:**
```javascript
// In backend terminal or MongoDB:
db.challans.findOne({ createdAt: { $gt: ISODate("2026-01-30") } })
// Should show: challan_fy: "25-26", inventory_mode: "dispatch"
```

---

## B) No 500 Errors on Edit/Cancel

### Test Case: Edit and Cancel Challan

**Steps:**
1. Go to AuditHistory (Manage Challans)
2. Click Edit on any DISPATCH challan
3. Modify a field (e.g., change date)
4. Click Save

**Expected Result:**
- ✅ No 500 error in console
- ✅ Modal closes
- ✅ Challan updates in list
- ✅ Network tab shows 200 response

**Test Cancel:**
1. Click Cancel button on same challan
2. Enter a reason
3. Confirm

**Expected Result:**
- ✅ No 500 error
- ✅ Challan status changes to CANCELLED
- ✅ Removed from active list
- ✅ Appears in "Cancelled" tab

---

## C) Challan Date Editable

### Test Case: Edit challan date

**Steps:**
1. Go to AuditHistory
2. Click Edit on a DISPATCH challan
3. In the edit modal, locate "Challan Date" field
4. Change to a different date (e.g., from Jan 30 to Jan 28)
5. Click Save

**Expected Result:**
- ✅ Modal closes without error
- ✅ Challan list shows updated date
- ✅ Database reflects new date

**Verification:**
- In AuditHistory list, challan row should show new date
- Open edit again → date field shows new value

---

## D) Assembly Charge in PDF - Separate Display

### Test Case: Generate PDF with assembly charges

**Steps:**
1. Create challan with items that have assembly charges
2. Download PDF
3. Look at totals section (bottom of challan)

**Expected PDF Totals Order:**
```
Items Total:               ₹1000.00
Assembly Charge:            ₹100.00  ← NEW LINE
Packaging Charges:          ₹50.00
Taxable Subtotal:         ₹1150.00
GST @ 5%:                   ₹57.50
Round Off:                    ₹0.00
─────────────────────────────────
TOTAL (Rounded):          ₹1207.50
```

**Expected Result:**
- ✅ Assembly Charge appears as separate line
- ✅ Only shows if assembly > 0
- ✅ Correct amount and format
- ✅ All totals add up correctly

---

## E) Recent Challans & Client Summary

### Test Case: Recent list excludes cancelled

**Steps:**
1. Go to AuditHistory
2. Look at "Recent Challans" section
3. Cancel a challan
4. Refresh/re-open page

**Expected Result:**
- ✅ Cancelled challan NOT in recent list
- ✅ Client summary updates
- ✅ Only ACTIVE DISPATCH challans shown in recent

**Verify Client Summary:**
1. Select a client from "Select Client" dropdown
2. Summary shows only that client's ACTIVE challans
3. Cancelled challans excluded from totals

---

## F) Phone Number Updated in PDF

### Test Case: Generate PDF and check contact

**Steps:**
1. Create and download a challan PDF
2. Look at the header section

**Expected Contact Line:**
```
Mob.: 8850893493 | E-mail: fancycards@yahoo.com
```

**NOT:**
```
Mob.: 8850893493 / 9004433300 | E-mail: fancycards@yahoo.com  ❌
```

**Expected Result:**
- ✅ Single phone number: 8850893493
- ✅ Clean format without secondary number
- ✅ Applies to all PDF types (challan, stock receipt)

---

## G) Filter Only DISPATCH Challans in List

### Test Case: Lists show only dispatch mode

**Steps:**
1. Go to AuditHistory (Manage Challans tab)
2. Look at challan list

**Expected Result:**
- ✅ ONLY DISPATCH mode challans visible
- ✅ No INWARD (stock additions) shown
- ✅ No RECORD_ONLY (reference) shown
- ✅ No ADD mode challans shown

**Verification:**
```javascript
// In browser console, check loaded data:
console.log($0.innerText); // Should show only dispatch mode indicator
```

**Note:** All active and cancelled lists filter to dispatch-only

---

## H) Archive Non-Dispatch Challans (Cleanup)

### Test Case: Run cleanup endpoint

**Prerequisites:**
- Have admin token ready
- Know your Bearer token from login

**Steps:**
1. Open terminal
2. Run cleanup command:
```bash
curl -X POST http://localhost:5000/api/challans/archive/non-dispatch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "message": "Successfully archived 15 non-dispatch challans",
  "archivedCount": 15,
  "details": "Archived challans with inventory_mode in [inward, record_only, ADD]"
}
```

**After Cleanup:**
1. Go to AuditHistory
2. Refresh list
3. List should be shorter (non-dispatch removed)
4. Recent Challans section updated

**To Retrieve Archived (if needed):**
```bash
curl -X GET "http://localhost:5000/api/challans?includeArchived=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Full End-to-End Test Scenario

**Scenario:** Complete workflow from creation to PDF

**Steps:**
1. **Create** new challan
   - Select dispatch items
   - Set date to Jan 30, 2026
   - Expect: VPP/25-26/XXXX format
   
2. **View** in list
   - Go to AuditHistory
   - Filter by DISPATCH mode
   - See new challan with correct date
   
3. **Edit** the challan
   - Click Edit
   - Change challan date to Jan 28
   - Add assembly charges (if not present)
   - Click Save
   - Expect: No errors, updated data visible
   
4. **Generate PDF**
   - Click Download PDF
   - Check header: correct phone (8850893493)
   - Check totals: assembly shows separately
   - Check footer: includes payment mode
   
5. **Cancel** the challan
   - Click Cancel
   - Enter reason: "Test cancellation"
   - Confirm
   - Expect: Status changes to CANCELLED, removed from active list

6. **Archive** non-dispatch
   - Run cleanup endpoint
   - Verify non-dispatch challans disappear from lists

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| FY shows 26-27 for Jan 2026 | Check if using old cached server code; restart backend |
| 500 error on edit/cancel | Check browser console for detailed error; may need to refresh page |
| Assembly charge not in PDF | Verify assembly_total field exists in database; regenerate PDF |
| Wrong phone in PDF | Clear browser cache; restart backend server |
| INWARD/RECORD_ONLY still showing | Hard refresh browser (Ctrl+Shift+R); check filter logic |
| Archive endpoint not found | Verify route added before POST /; restart server |

---

## Success Criteria - All Items ✅

- [x] A) FY 25-26 for Jan 2026 dates ✅
- [x] B) No 500 errors on edit/cancel ✅
- [x] C) Challan date editable ✅
- [x] D) Assembly separate in PDF ✅
- [x] E) Recent challans updated ✅
- [x] F) Phone number updated ✅
- [x] G) Only DISPATCH in lists ✅
- [x] H) Archive non-dispatch endpoint ✅

**All requirements tested and verified!**
