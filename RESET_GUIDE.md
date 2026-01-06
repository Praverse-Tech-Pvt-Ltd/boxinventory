# Production Data Reset Guide

## Overview

The `resetProductionData.js` script safely removes all test/old data from the system while preserving two critical admin accounts. This makes the system "commercial fresh" and ready for new data entry.

## What Gets Deleted

✅ **Deleted Collections:**
- All **Boxes** (inventory items)
- All **Box Audits** (activity logs)
- All **Challans** (GST and Non-GST)
- All **Stock Receipts**
- All **Client Batches**
- All non-admin **Users**

## What Gets Preserved

✅ **Preserved Admin Accounts:**
1. `test@gmail.com` (Admin)
2. `savlavaibhav99@gmail.com` (Admin)

✅ **Database Schema:**
- All tables/collections remain intact
- Field structures unchanged
- Indexes preserved

## Safety Features

### Mandatory Environment Variable

The script requires an explicit confirmation flag to prevent accidental resets:

```bash
RESET_CONFIRM=YES npm run reset:data
```

**Without `RESET_CONFIRM=YES`, the script will refuse to run.**

### Counters Reset

- Challan numbering resets to sequence 1
- Next GST challan: `VPP/YY-YY/0001`
- Next Non-GST challan: `VPP-NG/YY-YY/0001`
- Stock receipt numbering resets to `001`

### Default Passwords (First Time Only)

If an admin account doesn't exist, it will be created with:
- **Default password:** `Admin@1234`
- **Recommendation:** Change on first login

## How to Run

### Prerequisites

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Ensure `.env` file exists with `MONGO_URI` configured:
   ```env
   MONGO_URI=mongodb+srv://your-connection-string
   ```

### Execute Reset

```bash
# With confirmation flag
RESET_CONFIRM=YES npm run reset:data
```

### Output Example

```
🔄 Starting Production Data Reset...
========================================

✅ Database connected

📊 Initial Database State:

Initial State:
  ┌─────────────────────┬──────┐
  │ Collection          │ Count│
  ├─────────────────────┼──────┤
  │ Users               │  150 │
  │ Boxes               │  320 │
  │ Audit Logs          │ 2450 │
  │ Challans            │  540 │
  │ Stock Receipts      │  180 │
  │ Client Batches      │   95 │
  └─────────────────────┴──────┘

🗑️  Deleting test data...
  • Deleted 320 boxes
  • Deleted 2450 audit logs
  • Deleted 540 challans
  • Deleted 180 stock receipts
  • Deleted 95 client batches

👥 Managing user accounts...
  • Deleted 148 non-admin users
  • Admin account exists: test@gmail.com
  • Created new admin: savlavaibhav99@gmail.com
    📝 Default password: Admin@1234 (please change on first login)

🔢 Resetting counters and sequences...
  • Reset challan counter for FY 26-27
    - GST sequence: 1
    - Non-GST sequence: 1
  • Cleared generic counters

📋 RESET COMPLETION REPORT
========================================

Final State:
  ┌─────────────────────┬──────┐
  │ Collection          │ Count│
  ├─────────────────────┼──────┤
  │ Users               │    2 │
  │ Boxes               │    0 │
  │ Audit Logs          │    0 │
  │ Challans            │    0 │
  │ Stock Receipts      │    0 │
  │ Client Batches      │    0 │
  └─────────────────────┴──────┘

👤 Remaining Admin Accounts:
  1. test@gmail.com (ID: 507f1f77bcf86cd799439011)
  2. savlavaibhav99@gmail.com (ID: 507f1f77bcf86cd799439012)

✅ RESET COMPLETED SUCCESSFULLY!

📝 Notes:
  - New challan numbering starts from 0001
  - All test data has been removed
  - Only 2 admin accounts remain
  - System is ready for fresh data entry
```

## Verification Checklist

After running the reset, verify:

- [ ] Both admin accounts can still log in
- [ ] No challan data exists (empty list in UI)
- [ ] No box inventory data (empty inventory)
- [ ] No audit logs
- [ ] New challan created starts numbering from 0001
- [ ] No other user accounts exist

## Running It Again

The script is **fully repeatable**. You can run it multiple times safely:

```bash
RESET_CONFIRM=YES npm run reset:data
```

Each run will:
1. Delete all old data
2. Preserve/recreate admin accounts
3. Reset counters to start values
4. Print a complete reset report

## Rollback Strategy

**Important:** There is no built-in rollback. If you need to preserve data:

1. **Before running reset**, take a MongoDB backup:
   ```bash
   mongodump --uri="your-connection-string" --out=./backup_$(date +%Y%m%d_%H%M%S)
   ```

2. To restore from backup:
   ```bash
   mongorestore --uri="your-connection-string" ./backup_directory/
   ```

## Troubleshooting

### Error: "Refusing to reset data"

**Cause:** Missing `RESET_CONFIRM=YES`

**Fix:** Run with the confirmation flag:
```bash
RESET_CONFIRM=YES npm run reset:data
```

### Error: "MONGO_URI" not found

**Cause:** Missing or incorrect `.env` configuration

**Fix:** Ensure `.env` file exists in `backend/` directory with:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### Error: Database connection failed

**Cause:** Invalid MongoDB connection string or MongoDB service down

**Fix:**
1. Verify MongoDB cluster is running
2. Check connection string is correct
3. Verify network access rules allow your IP
4. Test connection: `mongosh "your-connection-string"`

### One admin account was deleted unexpectedly

**Fix:** The script will automatically recreate it with the default password on next run:
```bash
RESET_CONFIRM=YES npm run reset:data
```

## Related Commands

```bash
# Check database status
npm start

# Run in development mode
npm run dev

# View MongoDB collections
# (requires mongo CLI tools installed)
mongosh "your-connection-string"
```

## Security Notes

⚠️ **Important:**

1. Only run this on **production or staging** with explicit intent
2. Always have a **recent backup** before running
3. **Never** share or hardcode `RESET_CONFIRM=YES` in CI/CD pipelines without additional safeguards
4. Change the default password (`Admin@1234`) immediately on first admin login
5. Consider adding additional authentication layers (IP whitelist, approval workflow) for production resets

## Support

If you encounter issues:

1. Check the error message in the console
2. Verify your MongoDB connection
3. Ensure `.env` configuration is correct
4. Review this guide's Troubleshooting section
5. Check MongoDB logs for additional details
