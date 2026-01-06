# Production Reset - Pre-Execution Checklist

**Date:** ____________  
**Executed By:** ____________  
**Backup Created:** ☐ Yes ☐ No  

---

## Pre-Reset Checks

- [ ] Read `RESET_QUICK_REF.md` (2 minutes)
- [ ] Read `RESET_GUIDE.md` → "How to Run" (5 minutes)
- [ ] MongoDB connection working
- [ ] `.env` file exists with `MONGO_URI`
- [ ] Have recent MongoDB backup (optional but recommended)
- [ ] Know the 2 admin emails:
  - [ ] `test@gmail.com`
  - [ ] `savlavaibhav99@gmail.com`
- [ ] Team notified of planned reset
- [ ] In correct directory: `backend/`
- [ ] npm dependencies installed: `npm install` run recently

---

## Backup (Optional but Recommended)

```bash
mongodump --uri="your-mongo-uri" --out=./backup_$(date +%Y%m%d_%H%M%S)
```

Backup Location: ________________  
Backup Date: ________________  

---

## Execute Reset

### Command

**Linux/macOS:**
```bash
cd backend
RESET_CONFIRM=YES npm run reset:data
```

**Windows PowerShell:**
```powershell
cd backend
$env:RESET_CONFIRM='YES'; npm run reset:data
```

### Execution

- [ ] Command started successfully
- [ ] Database connected (✅ message seen)
- [ ] Reset completed (✅ RESET COMPLETED SUCCESSFULLY)
- [ ] No errors in output
- [ ] Saved console output for records

**Console Output saved to:** ________________

---

## Post-Reset Verification

### Database Counts (From Console Output)

| Collection | Expected | Actual | ✅ |
|-----------|----------|--------|-----|
| Users | 2 | __ | ☐ |
| Boxes | 0 | __ | ☐ |
| Audit Logs | 0 | __ | ☐ |
| Challans | 0 | __ | ☐ |
| Stock Receipts | 0 | __ | ☐ |
| Client Batches | 0 | __ | ☐ |

### Admin Accounts (From Console Output)

```
Expected:
  1. test@gmail.com
  2. savlavaibhav99@gmail.com

Actual:
  1. ________________
  2. ________________
```

- [ ] Both emails match

---

## Functional Verification

### Login Tests

**Admin 1: test@gmail.com**
- [ ] Login successful
- [ ] Email correct
- [ ] Role: Admin
- [ ] Active status: Yes

**Admin 2: savlavaibhav99@gmail.com**
- [ ] Login successful
- [ ] Email correct
- [ ] Role: Admin
- [ ] Active status: Yes

### UI Navigation Tests

- [ ] Dashboard loads
- [ ] User list shows 2 admins only
- [ ] Boxes list is empty
- [ ] Challans list is empty
- [ ] Audit logs list is empty
- [ ] No errors in console

### Functional Tests

- [ ] Create new box works
- [ ] Create new challan works (check number starts at 0001)
- [ ] Add inventory works
- [ ] View audit logs works
- [ ] Download challan PDF works (if applicable)

---

## Password Management

- [ ] Default password is: `Admin@1234`
- [ ] Both admins instructed to change password on first login
- [ ] Password change completed by: ____________
- [ ] New password verified secure

---

## Rollback Plan (If Needed)

If issues found, restore from backup:

```bash
mongorestore --uri="your-mongo-uri" ./backup_20250106_143022
```

- [ ] Backup location documented: ________________
- [ ] Rollback tested (optional): ☐ Yes ☐ No
- [ ] Team knows rollback location

---

## Documentation

- [ ] Reset logged in team records
- [ ] Team notified of completion
- [ ] `RESET_GUIDE.md` shared with team
- [ ] `RESET_QUICK_REF.md` saved for future use
- [ ] Admin credential change confirmed

---

## Sign-Off

**Reset Completed:** ☐ Success ☐ Partial ☐ Failed  

**Executed By:** ____________________  
**Date & Time:** ____________________  
**Duration:** ____________________  

**Approved By:** ____________________  
**Date & Time:** ____________________  

---

## Notes

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

## Post-Reset Maintenance

Schedule for next reset: ________________

Key contacts for issues:
- Database Admin: ________________
- Backend Lead: ________________
- DevOps: ________________

---

**Keep this checklist for audit purposes!**
