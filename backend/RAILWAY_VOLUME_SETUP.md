# Railway Volume Setup - Database Persistence

## Problem
SQLite database file (`backend/data/fwf.db`) gets reset on every Railway deployment/restart because file system is ephemeral.

## Solution: Add Volume in Railway Dashboard

### Steps:
1. Go to Railway dashboard → Your project
2. Click on the backend service
3. Go to **"Settings"** tab
4. Scroll down to **"Volumes"** section
5. Click **"+ New Volume"**
6. Configure:
   - **Mount Path:** `/app/backend/data`
   - **Name:** `fwf-database` (or any name you want)
7. Click **"Add"**
8. Railway will redeploy automatically

### Verify:
After deployment, check logs:
```
✅ Database file: /app/backend/data/fwf.db
✅ Database exists: true
```

### Alternative: Use PostgreSQL/MySQL
For production, consider migrating to a proper database service:
- Railway provides free PostgreSQL instances
- More reliable than file-based SQLite
- Better concurrency handling

## Testing Database Persistence

Test endpoint (development only):
```
GET https://fwf-production.up.railway.app/api/debug/user/FWF-000001
```

This will show:
- Password hash preview
- Database path
- Whether DB file exists
- Hash format verification

## Volume Benefits:
- ✅ Database survives deployments
- ✅ Password changes persist
- ✅ No data loss on restart
- ✅ Automatic backups (Railway feature)
