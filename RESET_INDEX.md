# 📚 BoxInventory Production Reset System - Documentation Index

## 🎯 Start Here

Choose your role to find the right guide:

### 👤 **I'm a Manager/Business User**
→ Read: **RESET_QUICK_REF.md** (2 minutes)
- One-liner command
- What gets deleted
- What stays
- Estimated time

### 👨‍💻 **I'm a Developer/DevOps**
→ Read: **RESET_GUIDE.md** (15 minutes)
- Complete step-by-step instructions
- Safety mechanisms explained
- Troubleshooting guide
- Verification checklist
- Rollback procedures

### 🔧 **I'm a System Administrator**
→ Read: **RESET_SCENARIOS.md** (20 minutes)
- 10 real-world scenarios
- Backup/restore procedures
- Automation options
- Windows PowerShell examples
- Verification scripts

### 🏗️ **I'm an Architect/Tech Lead**
→ Read: **IMPLEMENTATION_RESET.md** (30 minutes)
- Technical deep-dive
- Architecture overview
- Performance characteristics
- Error handling strategy
- Security considerations

### 📋 **I'm about to run it NOW**
→ Use: **RESET_CHECKLIST.md**
- Print-friendly checklist
- Pre-execution verification
- Post-execution sign-off
- Audit trail

---

## 📖 Complete Documentation

### Foundational Documents

| Document | Purpose | Read Time | Best For |
|----------|---------|-----------|----------|
| **RESET_STATUS.md** | Overview & status | 5 min | Everyone (context) |
| **RESET_QUICK_REF.md** | Quick start | 2 min | Operators |
| **RESET_GUIDE.md** | Complete manual | 15 min | Technical team |

### Advanced Documentation

| Document | Purpose | Read Time | Best For |
|----------|---------|-----------|----------|
| **RESET_SCENARIOS.md** | 10 real scenarios | 20 min | Developers |
| **IMPLEMENTATION_RESET.md** | Technical details | 30 min | Architects |
| **RESET_CHECKLIST.md** | Pre-execution | 5 min | Operators |

### Technical Files

| File | Type | Purpose |
|------|------|---------|
| `backend/scripts/resetProductionData.js` | Node.js Script | Main reset logic (250 lines) |
| `backend/package.json` | Config | Added npm script `reset:data` |
| `test-reset-setup.sh` | Bash Script | Pre-flight check (Linux/macOS) |
| `test-reset-setup.bat` | Batch File | Pre-flight check (Windows) |

---

## 🚀 Quick Start (5 minutes)

### Prerequisites

```bash
# Check Node.js installed
node --version

# Check npm installed
npm --version

# Navigate to backend
cd backend

# Install dependencies (if not done)
npm install
```

### Execution

```bash
# Set safety flag and run
RESET_CONFIRM=YES npm run reset:data
```

### Verification

Check output shows:
- ✅ "Database connected"
- ✅ "RESET COMPLETED SUCCESSFULLY"
- ✅ Users: 2
- ✅ Boxes: 0
- ✅ Challans: 0

---

## 📋 What Gets Reset

### Deleted Collections
```
✗ All Boxes (product inventory)
✗ All Challans (GST + Non-GST)
✗ All Stock Receipts
✗ All Box Audits (activity logs)
✗ All Client Batches
✗ All non-admin Users
✗ All Counters & Sequences
```

### Preserved Items
```
✓ Database Schema (100% intact)
✓ All Indexes (unchanged)
✓ 2 Admin Accounts:
  - test@gmail.com
  - savlavaibhav99@gmail.com
```

---

## 🔐 Safety Features

✅ **Mandatory Confirmation**
- Requires: `RESET_CONFIRM=YES`
- Prevents accidental deletion

✅ **Admin Protection**
- 2 accounts auto-preserved
- Auto-created if missing

✅ **Repeatable**
- Can run multiple times
- No partial failures

✅ **Detailed Logging**
- Before/after counts
- Step-by-step progress
- Clear error messages

---

## 📊 Expected Output

```
🔄 Starting Production Data Reset...
========================================

✅ Database connected

📊 Initial Database State:
  Users: 152
  Boxes: 320
  Audit Logs: 2450
  Challans: 540
  Stock Receipts: 180
  Client Batches: 95

🗑️  Deleting test data...
  • Deleted 320 boxes
  • Deleted 2450 audit logs
  ...

👥 Managing user accounts...
  • Deleted 150 non-admin users
  • Admin account exists: test@gmail.com
  ...

🔢 Resetting counters and sequences...
  • Reset challan counter for FY 26-27
  ...

📋 RESET COMPLETION REPORT
========================================

Final State:
  Users: 2
  Boxes: 0
  Audit Logs: 0
  Challans: 0
  Stock Receipts: 0
  Client Batches: 0

✅ RESET COMPLETED SUCCESSFULLY!
```

---

## 🛠️ Troubleshooting Quick Links

| Issue | Solution | Doc |
|-------|----------|-----|
| "Refusing to reset" | Use `RESET_CONFIRM=YES` | RESET_GUIDE.md |
| Connection failed | Check `.env` MongoDB URI | RESET_GUIDE.md |
| Module not found | Run `npm install` | RESET_GUIDE.md |
| Need to restore | Use mongorestore | RESET_SCENARIOS.md |
| Windows execution | Use PowerShell syntax | RESET_SCENARIOS.md |

---

## 📁 File Structure

```
boxinventory/
│
├── 📄 README.md (original)
├── 📄 RESET_STATUS.md ..................... ← Start here
├── 📄 RESET_QUICK_REF.md .................. ← For quick execution
├── 📄 RESET_GUIDE.md ...................... ← Detailed manual
├── 📄 RESET_SCENARIOS.md .................. ← Advanced scenarios
├── 📄 IMPLEMENTATION_RESET.md ............. ← Technical deep-dive
├── 📄 RESET_CHECKLIST.md .................. ← Print-friendly checklist
├── 📄 THIS_FILE (RESET_INDEX.md)
│
├── 🔨 test-reset-setup.sh ................. ← Linux pre-flight check
├── 🔨 test-reset-setup.bat ................ ← Windows pre-flight check
│
└── backend/
    ├── package.json (UPDATED)
    │   └── Added: "reset:data": "node scripts/resetProductionData.js"
    │
    ├── .env (MUST EXIST)
    │   └── MONGO_URI=mongodb+srv://...
    │
    └── scripts/
        └── ✨ resetProductionData.js (NEW - 250 lines)
            ├── Connects to MongoDB
            ├── Deletes 6 collections
            ├── Preserves 2 admins
            ├── Resets counters
            └── Prints detailed report
```

---

## 👤 Role-Based Navigation

### Manager / Non-Technical

1. Read: **RESET_QUICK_REF.md**
2. Decide: Ready to reset?
3. Delegate: Ask DevOps/Tech Lead
4. Verify: Check final report

### Developer

1. Read: **RESET_GUIDE.md**
2. Test: Run with `RESET_CONFIRM=YES`
3. Verify: Check all 6 collections are 0
4. Document: Log reset timestamp

### DevOps / System Admin

1. Read: **RESET_SCENARIOS.md**
2. Backup: `mongodump --uri=...`
3. Execute: `RESET_CONFIRM=YES npm run reset:data`
4. Verify: Run checklist
5. Rollback Plan: Know restore procedure

### Architect / Tech Lead

1. Read: **IMPLEMENTATION_RESET.md**
2. Review: Code in `resetProductionData.js`
3. Approve: Add to deployment procedure
4. Document: In runbooks/wiki
5. Train: Team on usage

---

## 🔄 Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    RESET WORKFLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. READ Documentation                                       │
│     ↓                                                        │
│     └─→ RESET_QUICK_REF.md (2 min) or RESET_GUIDE.md        │
│                                                              │
│  2. PRE-FLIGHT CHECKS                                        │
│     ↓                                                        │
│     └─→ MongoDB connected                                    │
│     └─→ .env configured                                      │
│     └─→ npm dependencies installed                           │
│                                                              │
│  3. BACKUP (OPTIONAL)                                        │
│     ↓                                                        │
│     └─→ mongodump --uri=... --out=./backup_<date>           │
│                                                              │
│  4. EXECUTE RESET                                            │
│     ↓                                                        │
│     └─→ RESET_CONFIRM=YES npm run reset:data                │
│                                                              │
│  5. VERIFY RESULTS                                           │
│     ↓                                                        │
│     ├─→ Check console output                                │
│     ├─→ Test admin logins                                   │
│     ├─→ Verify empty collections                            │
│     └─→ Test new challan numbering                          │
│                                                              │
│  6. DOCUMENT & FOLLOW-UP                                     │
│     ↓                                                        │
│     ├─→ Save console output                                 │
│     ├─→ Update team records                                 │
│     ├─→ Delete backup (if successful)                       │
│     └─→ Notify stakeholders                                 │
│                                                              │
│  ✅ DONE!                                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 Common Errors

### Error 1: "Refusing to reset data"
```
❌ SAFETY CHECK FAILED
Refusing to reset data. Set RESET_CONFIRM=YES
```
**Fix:** Add environment variable
```bash
RESET_CONFIRM=YES npm run reset:data
```

### Error 2: "MONGO_URI not found"
```
❌ Error: MONGO_URI not configured
```
**Fix:** Ensure `.env` has MongoDB URI
```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
```

### Error 3: "Connection timeout"
```
❌ MongoError: connect ECONNREFUSED
```
**Fix:** Check MongoDB cluster is running and URI is correct
```bash
mongosh "your-connection-string"
```

---

## ✅ Post-Reset Verification

### 1. Database State
```bash
# Check counts (should show 2 users, 0 everything else)
mongosh "your-uri" -eval "
  db.users.countDocuments();
  db.boxes.countDocuments();
  db.challans.countDocuments();
"
```

### 2. Admin Logins
- [ ] `test@gmail.com` / `Admin@1234` → Success
- [ ] `savlavaibhav99@gmail.com` / `Admin@1234` → Success

### 3. Functionality
- [ ] Create box → Works
- [ ] Create challan (check number = 0001) → Works
- [ ] View empty lists → Works
- [ ] No errors in browser console → ✓

---

## 📞 Support

### Quick Questions
See: **RESET_QUICK_REF.md** or **RESET_GUIDE.md** Troubleshooting

### Specific Scenarios
See: **RESET_SCENARIOS.md** (10 real examples)

### Technical Issues
See: **IMPLEMENTATION_RESET.md** or script code comments

### Running Into Problems
1. Check error message in console
2. Search relevant doc above
3. Review MongoDB logs
4. Try rollback: `mongorestore --uri=... ./backup_*/`

---

## 🎓 Learning Resources

### Understanding the System
1. **RESET_GUIDE.md** → "How It Works" section
2. **IMPLEMENTATION_RESET.md** → "Step-by-Step" section
3. **resetProductionData.js** → Code comments

### Building Similar Tools
1. **IMPLEMENTATION_RESET.md** → "Technical Details"
2. **resetProductionData.js** → Study the code structure
3. **Models** in `backend/models/` → Schema definitions

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Execution Time | 10-30 seconds |
| Network Calls | ~10-15 MongoDB ops |
| Data Deleted | ~3,000+ records typical |
| Database Impact | Minimal (bulk deletes) |
| Reversible | Yes (with backup) |

---

## 🔐 Security Checklist

Before running in production:
- [ ] Have recent MongoDB backup
- [ ] Know MongoDB connection string
- [ ] Have `.env` file with valid URI
- [ ] Team aware of admin credentials
- [ ] Approval from tech lead
- [ ] Know MongoDB password (for restore)
- [ ] Disable auto-start during reset (if needed)

---

## 📈 Next Steps

1. **Read:** Start with your role-based guide above
2. **Practice:** Run in staging first (if available)
3. **Backup:** Create MongoDB backup
4. **Execute:** Run with `RESET_CONFIRM=YES`
5. **Verify:** Check all conditions pass
6. **Document:** Record timestamp and results
7. **Archive:** Save this documentation

---

## 📜 Version Info

| Item | Value |
|------|-------|
| System | BoxInventory Production Reset |
| Version | 1.0 |
| Created | January 6, 2026 |
| Status | ✅ Production Ready |
| Supported | MongoDB 4.0+ |
| Node.js | 14.0+ |

---

## 🎯 Quick Links (TL;DR)

```
Want to run it NOW?
→ Run: RESET_CONFIRM=YES npm run reset:data

Need basic info?
→ Read: RESET_QUICK_REF.md (2 min)

Need detailed steps?
→ Read: RESET_GUIDE.md (15 min)

Need scenarios?
→ Read: RESET_SCENARIOS.md (20 min)

Need technical details?
→ Read: IMPLEMENTATION_RESET.md (30 min)

About to execute?
→ Use: RESET_CHECKLIST.md (printable)

Something wrong?
→ See: RESET_GUIDE.md → Troubleshooting
```

---

## 🏁 Conclusion

The BoxInventory production reset system is **fully implemented, documented, and ready for use**.

- ✅ 250-line Node.js script
- ✅ npm command integration
- ✅ 6 comprehensive guides
- ✅ Pre-flight verification scripts
- ✅ Detailed troubleshooting
- ✅ Print-friendly checklist

**Start with:** `RESET_QUICK_REF.md`  
**Execute with:** `RESET_CONFIRM=YES npm run reset:data`  
**Verify with:** `RESET_CHECKLIST.md`

---

**Questions? Check the relevant guide above for your role and skill level.**

Good luck! 🚀
