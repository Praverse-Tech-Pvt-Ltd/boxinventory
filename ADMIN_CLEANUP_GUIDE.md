# Admin Cleanup Endpoint - Stock Inward Challans

## 📋 Overview

This endpoint safely removes stock inward/addition challans and their related audits from the system. It includes a **dry-run mode** for safety and provides detailed reports.

**Files Modified:**
- `backend/controllers/adminController.js` — Added `cleanupAdditionChallans()` function
- `backend/routes/adminRoutes.js` — Added cleanup route

**Files Created:**
- `backend/scripts/test-cleanup-addition-challans.js` — Comprehensive test suite

---

## 🔒 Security Features

✅ **Admin-only endpoint** — Protected by `protect` + `adminOnly` middleware
✅ **Dry-run by default** — Query param `?dryRun=true` (default) shows what would be deleted without deleting
✅ **Real delete opt-in** — Must explicitly set `?dryRun=false` to actually delete
✅ **Audit trail** — Console logs all operations with `[CLEANUP]` prefix
✅ **Safe detection** — Uses schema fields to identify addition challans:
  - `inventory_mode === "inward"`
  - `doc_type === "STOCK_INWARD_RECEIPT"`

---

## 📍 Endpoint Details

**Route:** `DELETE /api/admin/cleanup/addition-challans`

**Auth:** Requires valid JWT token + admin role

**Query Parameters:**
- `dryRun=true` (default) — Report without deleting
- `dryRun=false` — Actually delete

### Response: Dry-Run Mode

```json
{
  "message": "Dry run completed - no data deleted",
  "mode": "dryRun",
  "deletedChallansCount": 2,
  "deletedAuditCount": 3,
  "deletedChallanIds": [
    {
      "id": "507f1f77bcf86cd799439011",
      "number": "VPP-NG/26-27/INWARD-001",
      "type": "STOCK_INWARD_RECEIPT",
      "mode": "inward"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "number": "VPP-NG/26-27/INWARD-002",
      "type": "STOCK_INWARD_RECEIPT",
      "mode": "inward"
    }
  ],
  "deletedAuditIds": [
    {
      "id": "507f1f77bcf86cd799439021",
      "action": "add"
    },
    {
      "id": "507f1f77bcf86cd799439022",
      "action": "create_stock_receipt"
    },
    {
      "id": "507f1f77bcf86cd799439023",
      "action": "add"
    }
  ],
  "warning": "This is a dry run. Set ?dryRun=false to actually delete."
}
```

### Response: Real Delete Mode

```json
{
  "message": "Addition challans and related audits deleted successfully",
  "mode": "delete",
  "deletedChallansCount": 2,
  "deletedAuditCount": 3,
  "deletedChallanIds": [
    {
      "id": "507f1f77bcf86cd799439011",
      "number": "VPP-NG/26-27/INWARD-001",
      "type": "STOCK_INWARD_RECEIPT",
      "mode": "inward"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "number": "VPP-NG/26-27/INWARD-002",
      "type": "STOCK_INWARD_RECEIPT",
      "mode": "inward"
    }
  ],
  "success": true
}
```

---

## 🧪 Test Commands

### 1️⃣ Run Full Test Suite

The test script will:
1. Create 2 stock inward challans + 1 dispatch challan
2. Verify counts before cleanup
3. Simulate dry-run (verifies 2 would be deleted)
4. Perform real delete
5. Verify only 1 challan remains (the dispatch one)
6. Clean up test data

**Command:**
```bash
cd backend
node scripts/test-cleanup-addition-challans.js
```

**Expected Output:**
```
✅ MongoDB connected
✅ Test data created successfully

========== VERIFY: Before cleanup ==========

📊 Total Challans: 3
   - Inward/Addition: 2
   - Dispatch: 1
📊 Total Audits: 3
   - Inward/Addition: 2

========== TEST 1: DRY-RUN mode ==========

📊 DRY-RUN Report:
   - Would delete 2 addition challans
   - Would delete 2 related audits

📋 Sample challans to be deleted:
   - VPP-NG/26-27/INWARD-001 (ID: ...)
   - VPP-NG/26-27/INWARD-002 (ID: ...)

✅ DRY-RUN test PASSED

========== TEST 2: REAL DELETE mode ==========

🗑️  Deleting 2 addition challans...
✅ Deleted 2 challans
✅ Deleted 2 audits

✅ REAL DELETE test PASSED

========== VERIFY: After cleanup ==========

📊 Total Challans after cleanup: 1
   Remaining challans:
   - VPP-NG/26-27/OUT-001 (dispatch)

📊 Total Audits after cleanup: 1

✅ Post-cleanup verification PASSED

========== ✅ ALL TESTS PASSED ==========
```

---

## 🌐 cURL Examples

### Dry-Run (Safe - Reports Without Deleting)

```bash
curl -X DELETE "http://localhost:5000/api/admin/cleanup/addition-challans?dryRun=true" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Real Delete (Actual Deletion)

```bash
curl -X DELETE "http://localhost:5000/api/admin/cleanup/addition-challans?dryRun=false" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Admin Token (if needed)

```bash
# Login to get token
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "password": "your_password"
  }'

# Response will include token:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs..."
# }
```

---

## 📊 What Gets Deleted

### Challans Deleted
- Any challan where:
  - `inventory_mode === "inward"` OR
  - `doc_type === "STOCK_INWARD_RECEIPT"`

### Audits Deleted
- Audits that:
  - Reference a deleted challan (via `challan` field) OR
  - Have action `"add"` or `"create_stock_receipt"` OR
  - Have `doc_type === "STOCK_INWARD_RECEIPT"`

---

## 🔄 Impact on Application

✅ **Challan Lists** — Automatically show fewer/zero inward challans after cleanup
✅ **Total Sales** — Recalculates correctly (only dispatch challans counted)
✅ **Audit History** — Stock inward audits no longer appear
✅ **Inventory** — Remains unchanged (we use current DB quantities as truth, per Option A)

**Note:** No inventory reversal is performed. Current box quantities in DB remain as truth.

---

## ⚠️ Important Notes

1. **No Inventory Reversal** — Stock inward challans added items; deletion doesn't subtract them back. Current box inventory remains unchanged as ground truth.

2. **Safe by Default** — `dryRun=true` is the default. You must explicitly set `?dryRun=false` to delete.

3. **Admin Only** — Endpoint checks for JWT token + admin role.

4. **Audit Trail** — All operations are logged to console with `[CLEANUP]` prefix for debugging.

5. **Cascade Delete** — When a challan is deleted, all related audits referencing it are also deleted.

---

## 🛠️ Implementation Details

### Query Logic

```javascript
// Find addition challans
Challan.find({
  $or: [
    { inventory_mode: "inward" },
    { doc_type: "STOCK_INWARD_RECEIPT" }
  ]
})

// Find related audits
BoxAudit.find({
  $or: [
    { challan: { $in: additionChallanIds } },           // Direct reference
    { action: { $in: ["add", "create_stock_receipt"] } },  // Inward actions
    { doc_type: "STOCK_INWARD_RECEIPT" }                // Stock receipt docs
  ]
})
```

### Middleware Stack

1. `protect` — Validates JWT token
2. `adminOnly` — Verifies user has admin role
3. `cleanupAdditionChallans` — Performs cleanup

---

## 📝 API Validation

**No data is deleted:**
- If the call includes `?dryRun=true` or omits the parameter
- If 0 addition challans are found

**Data is deleted only if:**
- `?dryRun=false` is explicitly set AND
- Endpoint is called by authenticated admin user AND
- At least 1 addition challan exists

---

## ✅ Verification Checklist

After running cleanup, verify:

- [ ] Dry-run reports 2 challans without deleting
- [ ] Real delete removes 2 challans and related audits
- [ ] Only dispatch challan remains
- [ ] Total Sales shows only dispatch amounts
- [ ] Audit History shows no stock inward entries
- [ ] No errors in server console

---

## 🐛 Troubleshooting

**Issue: "Unauthorized: Reset only allowed in development"**
- Solution: Endpoint is admin-only. Verify your JWT token is valid and user has admin role.

**Issue: "No challans deleted (returns 0)"**
- Likely no stock inward challans exist. Run test script to create test data first.

**Issue: Wrong audit counts**
- Audits may have been created independently. Cleanup removes audits with action `["add", "create_stock_receipt"]` or `doc_type === "STOCK_INWARD_RECEIPT"`.

**Issue: Inventory didn't change after deletion**
- Expected behavior! We use Option A: Current DB quantities remain as truth.

