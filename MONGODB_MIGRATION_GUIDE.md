# SQLite → MongoDB Migration Guide

## 📋 Overview

This guide walks through migrating FWF backend from SQLite to MongoDB Atlas completely.

### Why MongoDB?
- ✅ Cloud-native, no file persistence issues
- ✅ Automatic backups (Atlas)
- ✅ Better scalability
- ✅ Platform-independent
- ✅ No Railway volume setup needed
- ✅ Same database service as Vercel functions

---

## 🛠️ Pre-Migration Setup

### 1. MongoDB Atlas Connection String

You already have MongoDB Atlas set up. Get your connection string:

1. Go to MongoDB Atlas → Clusters → Connect
2. Choose "Connect your application"
3. Copy connection string (Node.js driver)
4. Replace `<password>` with actual password
5. Add to `.env` files:

```bash
# backend/.env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/fwf-production?retryWrites=true&w=majority

# root .env (already exists, verify it's correct)
MONGODB_URI=mongodb+srv://...
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

This will install `mongoose@^8.4.0` (already added to package.json).

---

## 🚀 Migration Steps

### Step 1: Backup Current SQLite Database

```bash
# From project root
cp backend/data/fwf.db backend/data/fwf.db.backup-$(date +%Y%m%d_%H%M%S)
```

### Step 2: Run Migration Script

```bash
cd backend
npm run migrate:mongodb
```

**What it does:**
- Connects to MongoDB Atlas
- Clears existing collections (if any)
- Migrates all users (with embedded wallets & projects)
- Migrates referrals, donations, quiz tickets, points ledger
- Maps SQLite integer IDs → MongoDB ObjectIds
- Verifies migration success
- Shows summary of migrated records

**Expected output:**
```
🚀 Starting SQLite → MongoDB migration...
⚠️  WARNING: This will DELETE all existing data in MongoDB collections!
   Press Ctrl+C to cancel, or wait 5 seconds to continue...

🗑️  Clearing existing MongoDB data...
✅ Collections cleared

📦 Migrating users...
....................
✅ Migrated 20 users

🔗 Updating referred_by relationships...
....
✅ Updated 4 referral relationships

📦 Migrating referrals...
✅ Migrated 6 referrals

📦 Migrating donations...
✅ Migrated 12 donations

📦 Migrating quiz tickets...
✅ Migrated 3 quiz tickets

📦 Migrating points ledger...
✅ Migrated 25 ledger entries

🔍 Verifying migration...

📊 MongoDB Collection Counts:
   Users: 20
   Referrals: 6
   Donations: 12
   Quiz Tickets: 3
   Points Ledger: 25

✅ Test member found: {
  member_id: 'FWF-TEST-001',
  name: 'Test Member',
  wallet_balance: 5000,
  points: 50
}

🎉 Migration completed successfully!
```

### Step 3: Switch Backend to MongoDB

Currently `server.js` uses SQLite. To switch to MongoDB:

**Option A: Create New Branch (Recommended)**
```bash
git checkout -b mongodb-migration
```

**Option B: Test Locally First**

Create `backend/server-mongodb.js` (I'll provide this file) and test:
```bash
node server-mongodb.js
```

Test endpoints:
- Login: http://localhost:3000/api/auth/login
- Member dashboard: http://localhost:3000/api/member/me
- Admin overview: http://localhost:3000/api/admin/overview

### Step 4: Deploy to Railway

1. **Set Environment Variable:**
   ```
   Railway dashboard → Backend service → Variables
   Add: MONGODB_URI = mongodb+srv://...
   ```

2. **Push code:**
   ```bash
   git add .
   git commit -m "feat: migrate backend from SQLite to MongoDB"
   git push origin main  # or mongodb-migration branch
   ```

3. **Railway auto-deploys** (2-3 min)

4. **Verify deployment:**
   - Check Railway logs for "✅ MongoDB connected"
   - Test login API
   - Test dashboard

---

## 🧪 Testing Checklist

### Before Migration
- [ ] Backup SQLite database
- [ ] Verify MONGODB_URI in .env
- [ ] Test MongoDB connection: `node backend/lib/mongodb.js`

### After Migration
- [ ] Verify record counts match
- [ ] Test member login (FWF-TEST-001 / Test@12345)
- [ ] Test admin login
- [ ] Test wallet operations
- [ ] Test referral tracking
- [ ] Test donation recording
- [ ] Test forgot password flow
- [ ] Test member dashboard data loading

### Production Verification
- [ ] Railway deployment successful
- [ ] No errors in Railway logs
- [ ] Frontend login works
- [ ] Dashboard loads correctly
- [ ] Password reset works
- [ ] Sessions persist across refreshes

---

## 📊 Schema Comparison

### SQLite Structure
```
users (table)
wallets (separate table, FK to users)
member_projects (separate table, FK to users)
referrals (table)
donations (table)
quiz_tickets (table)
points_ledger (table)
```

### MongoDB Structure
```
users (collection)
  ├─ wallet (embedded subdocument)
  └─ member_project (embedded subdocument)
referrals (collection, references users)
donations (collection, references users)
quizTickets (collection, references users)
pointsLedgers (collection, references users)
```

**Key Differences:**
- Wallet data embedded in user document (1-to-1 relationship)
- Member project embedded in user document
- Integer IDs → MongoDB ObjectIds
- Foreign keys → ObjectId references
- Timestamps: SQLite TEXT → MongoDB Date objects

---

## 🔄 Rollback Plan

If migration fails or issues arise:

### Rollback on Railway:
1. Railway dashboard → Deployments
2. Find previous deployment (before MongoDB migration)
3. Click "Redeploy"

### Local Rollback:
```bash
git checkout main  # or previous branch
cd backend
node server.js  # back to SQLite
```

### Restore SQLite Backup:
```bash
cp backend/data/fwf.db.backup-YYYYMMDD_HHMMSS backend/data/fwf.db
```

---

## 🐛 Troubleshooting

### Migration Script Fails

**Error: "MONGODB_URI not set"**
```bash
# Add to backend/.env
MONGODB_URI=mongodb+srv://...
```

**Error: "MongoServerError: Authentication failed"**
- Check username/password in connection string
- Verify database user has read/write permissions on Atlas
- Check IP whitelist (allow 0.0.0.0/0 for testing)

**Error: "No SQLite database found"**
```bash
# Database doesn't exist yet, seed first:
cd backend
npm start  # Creates fwf.db with test data
# Then run migration
npm run migrate:mongodb
```

### Backend Won't Start

**Error: "Cannot find module 'mongoose'"**
```bash
cd backend
npm install
```

**Error: "MongooseServerSelectionError"**
- Check MONGODB_URI is correct
- Verify internet connection
- Check Atlas IP whitelist

### Data Missing After Migration

**User count mismatch:**
- Check migration logs for errors
- Re-run migration script (it clears collections first)

**Passwords don't work:**
- Migration preserves bcrypt hashes exactly
- If still failing, check backend logs for validation errors

---

## 📝 Post-Migration Cleanup

After successful migration and production testing:

### 1. Remove SQLite Dependencies (Optional)
```bash
cd backend
npm uninstall better-sqlite3
```

### 2. Archive SQLite Migrations
```bash
mv backend/migrations/001_initial_schema.sql backend/migrations/archive/
mv backend/migrations/002_wallet_points_referrals.sql backend/migrations/archive/
```

### 3. Update Documentation
- Update README with MongoDB setup instructions  
- Remove Railway volume setup guide
- Update deployment docs

---

## 🎯 Next Steps

After migration is complete:

1. **Remove Railway Volume** (no longer needed)
   - Railway dashboard → Backend → Settings → Volumes → Delete

2. **Setup MongoDB Backups**
   - Atlas provides automatic backups (free tier: continuous)
   - Configure backup schedule in Atlas dashboard

3. **Monitor Performance**
   - MongoDB Atlas provides free monitoring
   - Setup alerts for connection pool, slow queries

4. **Consider Indexes**
   - Models already have basic indexes
   - Monitor slow queries and add indexes as needed

---

## 🔐 Security Notes

- MongoDB credentials in Railway environment variables (encrypted)
- Atlas provides encryption at rest
- SSL/TLS connections (automatic)  
- Database-level access control
- IP whitelist on Atlas (recommended for production)

---

## 📞 Support

If you encounter issues:

1. Check migration script logs
2. Verify MongoDB connection string
3. Test locally before deploying
4. Check Railway deployment logs
5. Ask for help with specific error messages

---

**Created:** February 14, 2026  
**Status:** Ready for migration  
**Estimated Time:** 30-45 minutes
