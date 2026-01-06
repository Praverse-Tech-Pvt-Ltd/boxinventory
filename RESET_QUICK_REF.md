# Quick Reset Reference

## 🚀 One-Liner

```bash
cd backend && RESET_CONFIRM=YES npm run reset:data
```

## ✅ What This Does

- ✓ Deletes all boxes, challans, receipts, audit logs, batches
- ✓ Keeps only 2 admin accounts: `test@gmail.com` and `savlavaibhav99@gmail.com`
- ✓ Resets challan numbering to 0001
- ✓ Clears all non-admin users
- ✓ Prints detailed report

## ⚠️ Requirements

```bash
# File must exist
backend/.env

# Must contain
MONGO_URI=mongodb+srv://...
```

## 📋 Verification After Reset

Login as: `test@gmail.com` or `savlavaibhav99@gmail.com`

Check:
- Empty boxes list ✓
- Empty challan list ✓
- Empty audit logs ✓
- Next challan starts at 0001 ✓

## 🔄 Run Again Anytime

```bash
RESET_CONFIRM=YES npm run reset:data
```

No data loss outside the reset scope. Safe to repeat.

## 🛡️ Before Running

```bash
# Optional: Backup MongoDB first
mongodump --uri="your-mongodb-uri" --out=./backup_$(date +%Y%m%d)
```

## 📞 Issues?

- **"Refusing to reset"** → Add `RESET_CONFIRM=YES`
- **"Connection failed"** → Check `.env` and MongoDB URI
- **"Module not found"** → Run `npm install` in backend first

---

**See RESET_GUIDE.md for detailed documentation**
