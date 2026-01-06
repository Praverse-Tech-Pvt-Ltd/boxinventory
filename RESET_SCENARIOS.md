# Reset Scenarios & Instructions

## Scenario 1: First-Time Reset (Production Cleanup)

### Goal
Remove all test data and start fresh with 2 admin accounts only.

### Steps

1. **Navigate to backend:**
   ```bash
   cd backend
   ```

2. **Ensure dependencies installed:**
   ```bash
   npm install
   ```

3. **Create/verify `.env` file** with:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   JWT_SECRET=your_secret_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Backup MongoDB (recommended):**
   ```bash
   mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/database" --out=./backup_$(date +%Y%m%d_%H%M%S)
   ```

5. **Run the reset:**
   ```bash
   RESET_CONFIRM=YES npm run reset:data
   ```

6. **Verify results** - Check the printed report shows:
   ```
   Final State:
   Users: 2
   Boxes: 0
   Audit Logs: 0
   Challans: 0
   Stock Receipts: 0
   Client Batches: 0
   ```

7. **Test login** with:
   - Email: `test@gmail.com`
   - Password: `Admin@1234`

8. **Change default password** on first successful login

---

## Scenario 2: Windows PowerShell Execution

### For Windows Users

1. **Open PowerShell as Administrator**

2. **Navigate to project:**
   ```powershell
   cd "d:\PRAVERSE\boxinventory\backend"
   ```

3. **Set environment variable and run:**
   ```powershell
   $env:RESET_CONFIRM='YES'; npm run reset:data
   ```

4. **Alternative (one-liner):**
   ```powershell
   cmd /c "set RESET_CONFIRM=YES && npm run reset:data"
   ```

5. **Verify** the output shows success

---

## Scenario 3: Safe Reset with Backup/Restore

### Goal
Reset data but have full ability to restore if something goes wrong.

### Steps

1. **Create timestamped backup:**
   ```bash
   cd backend
   BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
   mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/db" --out=./$BACKUP_DIR
   echo "✅ Backup created in: $BACKUP_DIR"
   ```

2. **Run reset:**
   ```bash
   RESET_CONFIRM=YES npm run reset:data
   ```

3. **Test the system** thoroughly

4. **If you need to restore:**
   ```bash
   RESTORE_DIR="backup_20250106_143022"  # Use actual backup directory
   mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/db" ./$RESTORE_DIR
   ```

---

## Scenario 4: Recurring Resets (QA/Testing Environment)

### Goal
Automate reset for continuous testing environments.

### Option A: Manual Trigger

```bash
# Add to script or documentation
cd backend && RESET_CONFIRM=YES npm run reset:data
```

### Option B: Scheduled Reset (Daily at 2 AM)

**Using node-cron or system cron (Linux):**

```bash
# Add to crontab
0 2 * * * cd /path/to/boxinventory/backend && RESET_CONFIRM=YES npm run reset:data >> ./reset-logs/reset-$(date +\%Y\%m\%d).log 2>&1
```

**Create log directory:**
```bash
mkdir -p backend/reset-logs
```

### Option C: Reset via API Endpoint (Optional)

*This is not implemented by default for safety, but can be added if needed.*

---

## Scenario 5: Partial Reset (Keep Some Data)

### Goal
Reset only non-essential collections but keep user accounts and boxes.

### Steps

1. **Modify the script** - Edit `backend/scripts/resetProductionData.js`

2. **Comment out collections to keep:**
   ```javascript
   // In deleteTestData() function, comment out:
   
   // const boxResult = await Box.deleteMany({});  // KEEP BOXES
   // deletions.boxes = boxResult.deletedCount;
   
   // Uncomment only:
   const auditResult = await BoxAudit.deleteMany({});
   const challanResult = await Challan.deleteMany({});
   const receiptResult = await StockReceipt.deleteMany({});
   const batchResult = await ClientBatch.deleteMany({});
   ```

3. **Run the modified reset:**
   ```bash
   RESET_CONFIRM=YES npm run reset:data
   ```

---

## Scenario 6: Creating Additional Admin Accounts

### Goal
Add more admins after reset (if needed).

### Method 1: Database Direct (MongoDB Compass)

1. Connect to MongoDB
2. Go to `users` collection
3. Insert document:
   ```json
   {
     "name": "New Admin",
     "email": "newadmin@company.com",
     "password": "$2a$10$...", // Hashed password
     "role": "admin",
     "createdAt": new Date(),
     "updatedAt": new Date()
   }
   ```

### Method 2: Via UI Registration (If enabled)

1. Run reset normally
2. Register new account via UI
3. Manually update role to "admin" in MongoDB:
   ```javascript
   db.users.updateOne(
     { email: "newadmin@company.com" },
     { $set: { role: "admin" } }
   )
   ```

---

## Scenario 7: Testing Without Reset (Dry-Run)

### Goal
Check if reset script will work without actually deleting data.

### Steps

1. **Remove the RESET_CONFIRM check temporarily** (for testing only):
   Edit `backend/scripts/resetProductionData.js`:
   ```javascript
   // Comment out for DRY RUN ONLY:
   // if (process.env.RESET_CONFIRM !== 'YES') { ... }
   ```

2. **Add console output instead of deletes:**
   ```javascript
   async function deleteTestData() {
     console.log('DRY RUN: Would delete:');
     console.log('  - Boxes:', await Box.countDocuments());
     console.log('  - Audits:', await BoxAudit.countDocuments());
     // Don't actually delete
     return {};
   }
   ```

3. **Run the test:**
   ```bash
   npm run reset:data
   ```

4. **Review output**, then restore original file

---

## Scenario 8: Troubleshooting Failed Reset

### Issue: "Refusing to reset data"

```bash
# ❌ Wrong
npm run reset:data

# ✅ Correct
RESET_CONFIRM=YES npm run reset:data
```

### Issue: "Connection refused"

**Checklist:**
- [ ] MongoDB cluster is running
- [ ] `.env` has correct `MONGO_URI`
- [ ] Network allows your IP
- [ ] Connection string has correct password

**Test connection:**
```bash
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/db"
```

### Issue: "Module not found"

```bash
# Install dependencies
npm install

# Try again
RESET_CONFIRM=YES npm run reset:data
```

### Issue: Only partial data was deleted

**Safety feature prevents partial deletes.** If you see errors:

1. Check error messages in console
2. Fix the issue (e.g., MongoDB connection)
3. Run reset again - it will complete the full cleanup

---

## Scenario 9: Post-Reset Verification Script

### Automated Verification

Create `verify-reset.js`:

```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

import User from './models/User.js';
import Box from './models/boxModel.js';
import Challan from './models/challanModel.js';

async function verify() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const users = await User.find();
    const boxes = await Box.countDocuments();
    const challans = await Challan.countDocuments();
    
    console.log('\n✅ Verification Results:');
    console.log(`Users (should be 2): ${users.length}`);
    console.log('Emails:', users.map(u => u.email).join(', '));
    console.log(`Boxes (should be 0): ${boxes}`);
    console.log(`Challans (should be 0): ${challans}`);
    
    const allGood = users.length === 2 && boxes === 0 && challans === 0;
    console.log('\nStatus:', allGood ? '✅ PASSED' : '❌ FAILED');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verify();
```

**Run verification:**
```bash
node verify-reset.js
```

---

## Scenario 10: Rollback Procedure

### If Something Goes Wrong

1. **Stop the application:**
   ```bash
   npm stop
   ```

2. **Identify backup:**
   ```bash
   ls -la backup_*/
   ```

3. **Restore from backup:**
   ```bash
   mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/db" ./backup_20250106_143022/
   ```

4. **Restart application:**
   ```bash
   npm start
   ```

5. **Verify data restored:**
   - Check user list
   - Check box inventory
   - Check challans

---

## Quick Reference Commands

```bash
# Reset (with safety check)
RESET_CONFIRM=YES npm run reset:data

# Backup only
mongodump --uri="$MONGO_URI" --out=./backup_$(date +%Y%m%d_%H%M%S)

# Restore only
mongorestore --uri="$MONGO_URI" ./backup_20250106_143022

# Verify counts
mongo "your-uri" --eval "db.users.count(); db.boxes.count(); db.challans.count();"

# View all admin users
mongosh "your-uri" --eval "db.users.find({role: 'admin'}).pretty()"
```

---

## Windows PowerShell Specific

### Environment Variable Setup (Persistent)

```powershell
# For current session only
$env:RESET_CONFIRM='YES'

# To make it permanent (requires restart)
[Environment]::SetEnvironmentVariable('RESET_CONFIRM', 'YES', 'User')
```

### Backup in PowerShell

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup_$timestamp"
mongodump --uri="your-uri" --out=$backupDir
Write-Host "✅ Backed up to: $backupDir"
```

### Restore in PowerShell

```powershell
$backupDir = "backup_20250106_143022"
mongorestore --uri="your-uri" $backupDir
Write-Host "✅ Restored from: $backupDir"
```

---

## Support & Issues

**See RESET_GUIDE.md for comprehensive troubleshooting**

Common issues:
- ❌ "Refusing to reset data" → Use `RESET_CONFIRM=YES`
- ❌ "Connection failed" → Check `.env` MongoDB URI
- ❌ "Module not found" → Run `npm install`

---

**Last Updated:** January 6, 2026  
**Status:** Ready for Production
