# Three-Mode Inventory System Test Plan

## Test Scenarios

### Setup
1. Create or identify a box product (e.g., "CustomBox-001") with colors and quantities:
   - Color: "Neon" = 5 units
   - Color: "Blue" = 10 units
   - Color: "Red" = 3 units

2. Identify or create audit records for these boxes

---

## Test Case 1: RECORD_ONLY Mode (No Inventory Changes)

**Objective:** Verify that creating a challan in RECORD_ONLY mode does NOT modify inventory

### Steps:
1. Navigate to Challan Generation form
2. Set **Inventory Mode** to "Record Only (No Inventory Change)"
3. Select audit record for CustomBox-001, Neon color, qty=4
4. Click "Generate Challan"

### Expected Results:
- ✅ Challan created successfully with status 201
- ✅ Inventory remains: Neon=5 (no change)
- ✅ Challan document has `inventory_mode: "record_only"`
- ✅ Console log shows: "[inventory-update] Mode: record_only: skipping all inventory updates"
- ✅ No inventory validation errors thrown

### Validation:
Check MongoDB:
```javascript
db.boxes.findOne({code: "CustomBox-001"})
// quantityByColor should still show "neon": 5 (normalized)
```

---

## Test Case 2: DISPATCH Mode (Subtract from Inventory)

**Objective:** Verify DISPATCH mode validates stock AND subtracts inventory

### Scenario 2A: Sufficient Stock
1. Set **Inventory Mode** to "Dispatch / Subtract from Inventory"
2. Select audit for CustomBox-001, Neon color, qty=3
3. Click "Generate Challan"

### Expected Results:
- ✅ Challan created successfully
- ✅ Inventory updated: Neon = 5 - 3 = 2
- ✅ Challan has `inventory_mode: "dispatch"`
- ✅ Console shows: "[inventory-check] Box: CustomBox-001, Color: neon, Available: 5, Requested: 3"
- ✅ Console shows: "[inventory-subtract] Box: CustomBox-001, Color: neon, Before: 5, After: 2"

### Scenario 2B: Insufficient Stock (Should Fail)
1. Set **Inventory Mode** to "Dispatch / Subtract from Inventory"
2. Select audit for CustomBox-001, Red color, qty=5 (but inventory only has 3)
3. Click "Generate Challan"

### Expected Results:
- ❌ Challan creation fails with 400 error
- ✅ Error message: `"Insufficient stock for box \"CustomBox-001\" color \"red\". Available: 3, Required: 5"`
- ✅ Inventory unchanged (validation failed before subtraction)
- ✅ Audit record NOT marked as used

---

## Test Case 3: Color Normalization (Case/Whitespace Handling)

**Objective:** Verify that "Neon", "neon", " neon " all match the same inventory

### Setup:
Ensure inventory has color stored as: `"neon": 5`

### Test 3A: Uppercase Color
1. Create manual challan row with Product=CustomBox-001, Color="Neon" (uppercase), Qty=2
2. Set **Inventory Mode** to "Dispatch"
3. Generate challan

### Expected Results:
- ✅ Color normalized to "neon" internally
- ✅ Matches existing inventory record
- ✅ Inventory updated: neon = 5 - 2 = 3
- ✅ No "Insufficient stock" error

### Test 3B: Whitespace-Padded Color
1. Create manual challan row with Color=" neon " (with spaces), Qty=1
2. Set **Inventory Mode** to "Dispatch"
3. Generate challan

### Expected Results:
- ✅ Spaces trimmed, color normalized to "neon"
- ✅ Matches same inventory record
- ✅ Inventory updated: neon = 3 - 1 = 2
- ✅ No mismatch error

---

## Test Case 4: INWARD Mode (Stock Inward Receipt)

**Objective:** Verify INWARD mode creates a stock receipt (ADD operation)

### Steps:
1. Set **Inventory Mode** to "Stock Inward / Add to Inventory"
2. Select audit or add manual item for CustomBox-001, Neon color, qty=10
3. Click "Generate Challan" (should redirect to stock receipt)

### Expected Results:
- ✅ Stock Inward Receipt created (not a challan)
- ✅ Inventory updated: Neon = 2 + 10 = 12
- ✅ Document type: "StockReceipt" (not "Challan")
- ✅ No validation required (ADD doesn't check availability)
- ✅ Button text shows "✅ Add to Inventory" not "📄 Generate Challan"

---

## Manual Testing Checklist

### Pre-Test
- [ ] Backend server running
- [ ] MongoDB connected with test box products
- [ ] Frontend app running on localhost

### During Testing
- [ ] Open Browser DevTools Console to verify logs
- [ ] Watch MongoDB documents for inventory changes
- [ ] Check network tab for API requests/responses

### Post-Test
- [ ] All three modes tested and passing
- [ ] Color normalization tested (uppercase, lowercase, spaces)
- [ ] Error cases handled gracefully (insufficient stock)
- [ ] Validation messages display correctly

---

## Quick Verification Commands (MongoDB)

```javascript
// Check box inventory after each test
db.boxes.findOne({code: "CustomBox-001"})

// Check challan created with correct mode
db.challans.findOne({number: "CH-2026-001"}, {inventory_mode: 1, items: 1})

// Verify audit records marked as used
db.boxaudits.findOne({used: true}, {used: 1, challan: 1})
```

---

## Expected Console Output Examples

### RECORD_ONLY Mode:
```
[createChallan] inventory_mode received: "record_only", normalized to: "record_only"
[inventory-update] Mode: record_only: skipping all inventory updates
[createChallan] Error: (none - success)
```

### DISPATCH Mode (Success):
```
[createChallan] inventory_mode received: "dispatch", normalized to: "dispatch"
[inventory-check] Box: CustomBox-001, Color: neon, Available: 5, Requested: 3
[inventory-subtract] Box: CustomBox-001, Color: neon, Before: 5, After: 2
```

### DISPATCH Mode (Failure):
```
[createChallan] inventory_mode received: "dispatch", normalized to: "dispatch"
[inventory-check] Box: CustomBox-001, Color: red, Available: 3, Requested: 5
[validation-FAILED] Box: CustomBox-001, Color: red, Available: 3, Required: 5
[createChallan] Error: Insufficient stock...
```

### INWARD Mode:
```
[createChallan] inventory_mode received: "inward", normalized to: "inward"
[inventory-update] Mode: inward: skipping all inventory updates (redirected to createStockInwardReceipt)
```

---

## Acceptance Criteria (All Must Pass)

- [x] Three inventory modes available in frontend dropdown
- [x] RECORD_ONLY: No inventory validation or changes
- [x] DISPATCH: Validates stock, subtracts if available, fails if insufficient
- [x] INWARD: Redirects to stock receipt creation
- [x] Color normalization: "Neon" vs "neon" vs " neon " all match same record
- [x] Error messages clear and actionable
- [x] Audit trail: Challan documents record the inventory_mode used
- [x] Backend logs show detailed inventory operations
- [x] Warning text appears in UI for DISPATCH mode: "⚠️ This will subtract stock from inventory"
- [x] Default mode: record_only (safest option)
