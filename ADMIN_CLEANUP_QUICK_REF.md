# Quick Reference - Admin Cleanup Endpoint

## 📍 Endpoint
`DELETE /api/admin/cleanup/addition-challans?dryRun=true|false`

## 🔧 Quick Commands

### Dry-Run (Safe, No Changes)
```bash
curl -X DELETE "http://localhost:5000/api/admin/cleanup/addition-challans" \
  -H "Authorization: Bearer $TOKEN"
```

### Real Delete
```bash
curl -X DELETE "http://localhost:5000/api/admin/cleanup/addition-challans?dryRun=false" \
  -H "Authorization: Bearer $TOKEN"
```

### Test Full Suite
```bash
cd backend && node scripts/test-cleanup-addition-challans.js
```

## 📊 Response Fields

| Field | Description |
|-------|-------------|
| `message` | Human-readable summary |
| `mode` | "dryRun" or "delete" |
| `deletedChallansCount` | How many challans would/will be deleted |
| `deletedAuditCount` | How many audits would/will be deleted |
| `deletedChallanIds` | Sample list (first 20) of IDs and numbers |
| `success` | true if real delete completed |
| `warning` | Present in dryRun mode |

## 🎯 What Gets Deleted

**Challans:**
- `inventory_mode === "inward"` OR
- `doc_type === "STOCK_INWARD_RECEIPT"`

**Audits:**
- Reference a deleted challan OR
- Action = "add" or "create_stock_receipt" OR
- Doc type = "STOCK_INWARD_RECEIPT"

## ✅ Safety Features

✅ Dry-run by default
✅ Admin-only (JWT + role check)
✅ Console logging with [CLEANUP] prefix
✅ Comprehensive test suite included
✅ No inventory reversal (uses current DB as truth)

## 🚀 Test Workflow

```
1. Run test script → creates 2 inward + 1 dispatch challan
2. Dry-run call → verifies 2 would be deleted
3. Real delete call → deletes 2 challans + audits
4. Verify → only 1 challan remains (dispatch)
5. Cleanup → removes test data
```

Expected result: ✅ ALL TESTS PASSED

