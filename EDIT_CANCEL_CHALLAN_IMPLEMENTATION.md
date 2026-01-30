# Edit & Cancel Challan Implementation - Complete Guide

## Overview

This document describes the complete implementation of **Edit Challan** and **Cancel Challan** admin-only workflows in the Audit History → All Challans tab.

**Status:** ✅ FULLY IMPLEMENTED (Phase 6 Complete)

---

## Architecture

### Backend Implementation

#### 1. Data Model Updates

**File:** `backend/models/challanModel.js`

Added fields to track challan lifecycle:
```javascript
status: { type: String, enum: ["ACTIVE", "CANCELLED"], default: "ACTIVE" },
cancelledAt: Date,
cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
cancelReason: String,
reversalApplied: Boolean,  // true if inventory was reversed during cancel
updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
items_subtotal: Number,  // Helpful for total calculations
```

**File:** `backend/models/boxAuditModel.js`

Extended action enum to track modifications:
```javascript
action: {
  type: String,
  enum: [
    "create", "add", "subtract", "dispatch",
    "create_stock_receipt", "edit",
    "challan_edited", "challan_cancelled"  // NEW
  ]
}
```

#### 2. Controller Functions

**File:** `backend/controllers/challanController.js`

##### `editChallan(req, res)` - Line 982+

**Purpose:** Update whitelisted challan fields and recompute totals.

**Allowed Fields:**
- `clientName`
- `paymentMode`
- `remarks`
- `termsAndConditions`
- `hsnCode`
- `packagingTotal` (overall packaging charges)
- `discountPercent`
- `challanDate`

**NOT Allowed:** Any field that affects inventory (line items, box codes, colors, quantities, rates)

**Key Logic:**
1. Validates user is admin (via adminOnly middleware)
2. Rejects if challan status is CANCELLED
3. Validates each field is in whitelist
4. Recomputes derived totals:
   - `itemsSubtotal` = sum of (rate × quantity) for all items
   - `discountAmount` = itemsSubtotal × (discountPercent / 100)
   - `taxableAmount` = itemsSubtotal + packagingTotal - discountAmount
   - `gstAmount` = taxableAmount × 0.05 (for GST challans)
   - `grandTotal` = taxableAmount + gstAmount
5. Stores `updatedBy` (user._id) and `updatedAt` (auto timestamp)
6. Logs audit event: `challan_edited` with user email
7. Returns updated challan with new totals

**Error Codes:**
- `400`: Challan already cancelled
- `400`: Field not whitelisted
- `403`: Not admin user
- `404`: Challan not found
- `500`: Server error

##### `cancelChallan(req, res)` - Line 1096+

**Purpose:** Mark challan as cancelled and optionally reverse inventory.

**Mandatory Input:**
```javascript
{
  reason: "string (required) - why challan was cancelled"
}
```

**Key Logic:**
1. Validates user is admin
2. Validates cancellation reason is provided
3. **Idempotency Check:** If status=="CANCELLED", returns success immediately (no error, safe to retry)
4. **Inventory Reversal** (only if `inventory_mode="dispatch"`):
   - For each item in challan:
     - Find Box by `item._id` (or `item.box`)
     - Add back `quantity` to `Box.totalQuantity` using MongoDB `$inc`
     - Add back to `Box.quantityByColor[color]` if color specified
   - Uses atomic MongoDB operations for consistency
5. Marks challan: `status="CANCELLED"`, `cancelledAt`, `cancelledBy`, `cancelReason`, `reversalApplied=true`
6. Logs audit event: `challan_cancelled` with reason
7. Returns updated challan with cancelled status

**Special Behavior:**
- **DISPATCH mode:** Inventory is reversed (qty added back to boxes)
- **RECORD_ONLY/INWARD mode:** No inventory change, just status update
- **Idempotent:** Calling twice returns success both times (safe for retries)

**Error Codes:**
- `400`: Missing cancellation reason
- `400`: Inventory reversal failed (prevents partial cancel)
- `403`: Not admin user
- `404`: Challan not found
- `500`: Server error

#### 3. Routes

**File:** `backend/routes/challanRoutes.js`

```javascript
router.put("/:id", editChallan);           // PUT /api/challans/:id
router.post("/:id/cancel", cancelChallan); // POST /api/challans/:id/cancel
```

Both routes protected by:
- `protect` middleware (JWT validation)
- `adminOnly` middleware (role check)

---

### Frontend Implementation

#### 1. Service Functions

**File:** `client/src/services/challanService.js`

Added two new export functions:

```javascript
export const editChallan = async (id, editData) => {
  const res = await axiosInstance.put(`/api/challans/${id}`, editData);
  return res.data;
};

export const cancelChallan = async (id, reason) => {
  const res = await axiosInstance.post(`/api/challans/${id}/cancel`, { reason });
  return res.data;
};
```

#### 2. Component State

**File:** `client/src/pages/admin/AuditHistory.jsx`

Added new state variables:
```javascript
const [showEditModal, setShowEditModal] = useState(false);
const [showCancelModal, setShowCancelModal] = useState(false);
const [selectedChallan, setSelectedChallan] = useState(null);
const [editFormData, setEditFormData] = useState({});
const [cancelReason, setCancelReason] = useState("");
const [challanStatusFilter, setChallanStatusFilter] = useState("all");
const [isEditingChallan, setIsEditingChallan] = useState(false);
const [isCancellingChallan, setIsCancellingChallan] = useState(false);
```

#### 3. Handler Functions

**Edit Modal Handlers:**
- `handleOpenEditModal(challan)` - Opens edit modal with current challan data
- `handleCloseEditModal()` - Closes and resets edit modal
- `handleEditFormChange(field, value)` - Updates form field
- `handleSaveEditChallan()` - Validates and calls editChallan API

**Cancel Modal Handlers:**
- `handleOpenCancelModal(challan)` - Opens cancel confirmation modal
- `handleCloseCancelModal()` - Closes and resets cancel modal
- `handleConfirmCancelChallan()` - Validates reason and calls cancelChallan API

#### 4. Filtered Challans

Added useMemo hook to filter by status:
```javascript
const filteredChallans = useMemo(() => {
  if (challanStatusFilter === "active") {
    return challans.filter((c) => c.status !== "CANCELLED");
  } else if (challanStatusFilter === "cancelled") {
    return challans.filter((c) => c.status === "CANCELLED");
  }
  return challans;
}, [challans, challanStatusFilter]);
```

#### 5. All Challans Table Updates

**Additions:**
- **Status Filter Dropdown:** All / Active Only / Cancelled Only
- **Status Badge Column:** Shows "ACTIVE" (green) or "CANCELLED" (red)
- **Action Buttons:** PDF (📄), Edit (✏️), Cancel (❌)
- **Disabled States:** All buttons disabled for cancelled challans
- **Row Styling:** Reduced opacity for cancelled rows

**Uses `filteredChallans` instead of `challans` to respect filter**

#### 6. Modal Components

**Edit Challan Modal** - Shows form with whitelisted fields:
- Client Name (text input)
- Payment Mode (select: Cash, Cheque, Online, Credit)
- Remarks (textarea)
- HSN Code (text input)
- Packaging Total (number input, ₹)
- Discount % (number input)
- Terms and Conditions (textarea)
- Challan Date (date input)

**Cancel Challan Modal** - Shows confirmation with reason:
- Challan number display
- Warning about inventory reversal (if dispatch mode)
- Cancellation Reason (mandatory textarea)
- Confirm/Cancel buttons

Both modals use Framer Motion for smooth animations.

---

## Data Flow

### Edit Challan Flow

```
1. User clicks ✏️ Edit button in table
   ↓
2. handleOpenEditModal(challan) opens modal with current values
   ↓
3. User modifies whitelisted fields (clientName, discount, etc.)
   ↓
4. User clicks "Save Changes"
   ↓
5. handleSaveEditChallan() validates and calls editChallan API
   ↓
6. Backend:
   - Validates admin role
   - Validates fields are whitelisted
   - Recomputes all totals (itemsSubtotal, discount, taxable, gst, grand)
   - Stores updatedBy and updatedAt
   - Logs challan_edited audit event
   ↓
7. Frontend receives updated challan
   ↓
8. Updates challans list in state
   ↓
9. Closes modal, shows success toast
   ↓
10. Table re-renders with new values
    PDF will show updated values on next download
```

### Cancel Challan Flow

```
1. User clicks ❌ Cancel button in table
   ↓
2. handleOpenCancelModal(challan) opens confirmation modal
   ↓
3. User enters cancellation reason (mandatory)
   ↓
4. User clicks "Confirm Cancel"
   ↓
5. handleConfirmCancelChallan() calls cancelChallan API
   ↓
6. Backend:
   - Validates admin role
   - Validates reason provided
   - Idempotency check: if already CANCELLED, return success
   - If inventory_mode="dispatch":
     - For each item: Box.totalQuantity += quantity (using $inc)
     - For each item: Box.quantityByColor[color] += quantity
   - Marks status="CANCELLED", stores cancelledAt/By/Reason
   - Sets reversalApplied=true
   - Logs challan_cancelled audit event
   ↓
7. Frontend receives updated challan with status="CANCELLED"
   ↓
8. Updates challans list in state
   ↓
9. Closes modal, shows success toast
   ↓
10. Table re-renders:
    - Row shows "CANCELLED" badge (red)
    - All action buttons disabled
    - Row opacity reduced
    - Filter shows updated count
```

---

## Testing Guide

### Prerequisites
- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:5173`
- Admin user logged in
- At least 2-3 existing challans in system

### Test Case 1: Edit Challan - Basic Fields

**Steps:**
1. Navigate to Admin → Audit History
2. Click "All Challans" tab
3. Find any "ACTIVE" challan
4. Click ✏️ Edit button
5. Change "Client Name" to "Test Client 123"
6. Change "Payment Mode" to "Online"
7. Click "Save Changes"

**Expected Result:**
- ✅ Modal closes
- ✅ Success toast: "Challan updated successfully"
- ✅ Table reflects new Client Name
- ✅ Backend logs "challan_edited" audit event

### Test Case 2: Edit Challan - Discount & Packaging

**Steps:**
1. Open edit modal for a challan
2. Set "Packaging Total" to 100.00
3. Set "Discount %" to 10
4. Note the current "Total Amount" before saving
5. Click "Save Changes"

**Expected Result:**
- ✅ Modal closes
- ✅ Total Amount recalculated correctly:
  - New Total = (itemsSubtotal + 100) - discount - (itemsSubtotal + 100) × 10%
  - Plus GST if applicable
- ✅ Verify by downloading PDF - new values visible

### Test Case 3: Edit Challan - Disabled After Cancel

**Steps:**
1. Open edit modal for a challan
2. Close modal (click Cancel or X)
3. Click ❌ Cancel button on same challan
4. Enter reason: "Test cancellation"
5. Click "Confirm Cancel"
6. Wait for success toast

**Expected Result:**
- ✅ Challan status changes to "CANCELLED"
- ✅ Row shows red "CANCELLED" badge
- ✅ Try to click ✏️ Edit button again
- ✅ Button is disabled (opacity-50, cursor-not-allowed)
- ✅ Edit modal does not open

### Test Case 4: Cancel Challan - Dispatch Mode Inventory

**Prerequisites:** A challan with `inventory_mode="dispatch"` that added items from boxes

**Steps:**
1. Note a Box's current quantity (e.g., "Box A: 50 units")
2. Find a dispatch challan that removed 10 units of "Box A"
3. Click ❌ Cancel button
4. Enter reason: "Inventory reversal test"
5. Click "Confirm Cancel"
6. Navigate to Inventory tab
7. Check "Box A" quantity

**Expected Result:**
- ✅ Challan marked "CANCELLED"
- ✅ Box A quantity increased by 10 (50 → 60)
- ✅ Backend logged "challan_cancelled" with reason
- ✅ reversalApplied=true in challan record

### Test Case 5: Cancel Challan - Idempotency

**Steps:**
1. Find a cancelled challan (status="CANCELLED")
2. Open its cancel modal again (click ❌)
3. Enter reason: "Second cancel attempt"
4. Click "Confirm Cancel"

**Expected Result:**
- ✅ Success toast: "Challan cancelled successfully"
- ✅ No error message
- ✅ Challan status remains "CANCELLED"
- ✅ No duplicate "challan_cancelled" audit event (check BoxAudit)

### Test Case 6: Cancel Challan - Record Only Mode

**Prerequisites:** A challan with `inventory_mode="record_only"` or `inventory_mode="inward"`

**Steps:**
1. Note Box quantities before cancel
2. Find a record-only challan
3. Click ❌ Cancel button
4. Enter reason: "Record-only cancel test"
5. Click "Confirm Cancel"
6. Navigate to Inventory tab
7. Verify Box quantities unchanged

**Expected Result:**
- ✅ Challan marked "CANCELLED"
- ✅ Box quantities UNCHANGED (no inventory reversal)
- ✅ Backend logs "challan_cancelled" with reason
- ✅ reversalApplied=false (or not set) in challan record

### Test Case 7: Status Filter

**Steps:**
1. Go to All Challans tab
2. Note total count (e.g., "Total: 10 challans")
3. Click dropdown: "Active Only"
4. Count visible rows
5. Click dropdown: "Cancelled Only"
6. Count visible rows
7. Click dropdown: "All Challans"

**Expected Result:**
- ✅ "Active Only" shows count = total - cancelled
- ✅ "Cancelled Only" shows only cancelled rows
- ✅ "All Challans" shows all rows
- ✅ Total count updates in header
- ✅ Non-matching rows disappear

### Test Case 8: API Authorization

**Steps:**
1. Open browser DevTools Network tab
2. Edit a challan, watch request to `PUT /api/challans/:id`
3. Verify request includes Authorization header with JWT
4. Cancel a challan, watch request to `POST /api/challans/:id/cancel`
5. Verify request includes Authorization header

**Expected Result:**
- ✅ Both requests include `Authorization: Bearer <token>`
- ✅ Backend validates token and admin role
- ✅ Non-admin users get `403 Forbidden` error

### Test Case 9: Form Validation

**Steps:**
1. Open cancel modal
2. Try to click "Confirm Cancel" WITHOUT entering reason
3. Observe button state

**Expected Result:**
- ✅ Button is disabled (appears grayed out)
- ✅ Error text: "Cancellation reason is required"
- ✅ Click enabled only after entering reason

### Test Case 10: PDF Reflects Edit

**Steps:**
1. Download PDF of a challan (before edit)
2. Edit challan: change client name, discount, packaging
3. Download PDF again
4. Compare PDFs

**Expected Result:**
- ✅ New PDF shows updated client name
- ✅ New PDF shows updated totals
- ✅ New PDF shows updated discount and packaging charges

---

## Audit Trail

### Audit Events Logged

All edits and cancellations are logged in `BoxAudit` collection:

**For Edit:**
```javascript
{
  box: null,
  user: user._id,
  action: "challan_edited",
  quantity: 0,
  color: null,
  challan: challan._id,
  doc_type: null,
  timestamp: Date.now(),
  used: `Edited by ${user.email}: updated clientName, discount, etc.`
}
```

**For Cancel:**
```javascript
{
  box: null,
  user: user._id,
  action: "challan_cancelled",
  quantity: 0,
  color: null,
  challan: challan._id,
  doc_type: null,
  timestamp: Date.now(),
  used: `Cancelled with reason: ${reason}`
}
```

---

## API Reference

### Edit Challan

**Endpoint:** `PUT /api/challans/:id`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "clientName": "Updated Client Name",
  "paymentMode": "Online",
  "remarks": "Updated remarks",
  "termsAndConditions": "Updated T&C",
  "hsnCode": "1234567890",
  "packagingTotal": 150.00,
  "discountPercent": 15.5,
  "challanDate": "2025-01-30T00:00:00.000Z"
}
```

**Response (Success - 200):**
```javascript
{
  "_id": "...",
  "challanNumber": "VPP/26-27/0001",
  "status": "ACTIVE",
  "clientName": "Updated Client Name",
  "paymentMode": "Online",
  "itemsSubtotal": 1000,
  "discountAmount": 150,
  "taxableAmount": 950,
  "gstAmount": 47.50,
  "grandTotal": 997.50,
  "updatedBy": "user_id",
  "updatedAt": "2025-01-30T10:30:00Z",
  // ... other fields
}
```

**Response (Error):**
- `400 Bad Request`: Challan already cancelled / field not whitelisted
- `403 Forbidden`: User is not admin
- `404 Not Found`: Challan not found
- `500 Server Error`: Database error

### Cancel Challan

**Endpoint:** `POST /api/challans/:id/cancel`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "reason": "Reason for cancellation"
}
```

**Response (Success - 200):**
```javascript
{
  "_id": "...",
  "challanNumber": "VPP/26-27/0001",
  "status": "CANCELLED",
  "cancelledAt": "2025-01-30T10:35:00Z",
  "cancelledBy": "user_id",
  "cancelReason": "Reason for cancellation",
  "reversalApplied": true,  // if dispatch mode
  // ... other fields
}
```

**Response (Error):**
- `400 Bad Request`: Missing reason / Inventory reversal failed
- `403 Forbidden`: User is not admin
- `404 Not Found`: Challan not found
- `500 Server Error`: Database error

---

## Troubleshooting

### Edit Modal Not Opening
- **Check:** Admin user logged in?
- **Check:** Challan status is "ACTIVE" (not "CANCELLED")?
- **Check:** Browser console for errors
- **Check:** Network tab for 403 Forbidden (auth issue)

### Total Amount Not Updating After Edit
- **Check:** Verify new values sent to backend (Network tab)
- **Check:** Backend logs for errors during recomputation
- **Check:** Calculate manually: (itemsSubtotal + packaging) - discount - discount amount
- **Check:** GST added if challan_tax_type="GST"

### Inventory Not Reversed on Cancel
- **Check:** Challan `inventory_mode="dispatch"` (not "record_only")?
- **Check:** Box IDs in challan items match Box collection
- **Check:** MongoDB $inc operation executed (check logs)
- **Check:** Backend error response in Network tab

### Idempotency Not Working
- **Check:** First cancel call succeeded (status changed to CANCELLED)?
- **Check:** Second cancel call should return success toast (not error)
- **Check:** Ensure backend checks `status=="CANCELLED"` before reversal

---

## Summary

✅ **Edit Challan**
- Whitelisted fields only (no inventory changes)
- Auto-recomputes all totals
- Admin-only with audit logging
- Disabled for cancelled challans

✅ **Cancel Challan**
- Mandatory reason field
- Reverses inventory for dispatch mode
- Idempotent (safe to retry)
- Admin-only with audit logging
- Marks as CANCELLED (no deletion)

✅ **UI Integration**
- All Challans tab with action buttons
- Edit and Cancel modals
- Status filter dropdown
- Status badges (ACTIVE/CANCELLED)
- Disabled states for cancelled rows

✅ **Data Safety**
- Whitelisted fields prevent inventory tampering
- Audit trail for all edits/cancellations
- Idempotent operations for retry safety
- Atomic MongoDB operations for consistency

---

## Files Modified

1. **Backend:**
   - `backend/models/challanModel.js` - Added status fields
   - `backend/models/boxAuditModel.js` - Extended action enum
   - `backend/controllers/challanController.js` - Added editChallan, cancelChallan
   - `backend/routes/challanRoutes.js` - Added PUT and POST routes

2. **Frontend:**
   - `client/src/services/challanService.js` - Added editChallan, cancelChallan
   - `client/src/pages/admin/AuditHistory.jsx` - Modal UI, handlers, filter

---

## Next Steps (Optional)

- [ ] Add watermark "CANCELLED" to PDF of cancelled challans
- [ ] Send email notification on challan edit/cancel
- [ ] Add bulk edit/cancel operations
- [ ] Add edit history timeline for each challan
- [ ] Add "Undo Cancel" option (re-open cancelled challans)
- [ ] Add edit versioning with before/after comparison

