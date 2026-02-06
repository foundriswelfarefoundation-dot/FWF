# Database Migrations

Production-safe SQLite schema migration system for FWF backend.

## Quick Start

```bash
# Run pending migrations
node migrate.js

# Check migration status
node migrate.js --status
```

## Creating New Migrations

1. **Create a new migration file** with format: `XXX_description.sql`
   - `XXX` = sequential number (001, 002, 003...)
   - Use descriptive names: `002_add_kyc_fields.sql`

2. **Migration file template**:
```sql
-- Migration: 002_add_kyc_fields
-- Description: Add KYC verification fields to users table
-- Date: 2025-02-06

ALTER TABLE users ADD COLUMN kyc_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN kyc_document_url TEXT;
```

3. **Test locally** before deploying:
```bash
# Backup first!
cp data/fwf.db data/fwf.db.backup

# Run migration
node migrate.js

# If issues, restore backup
cp data/fwf.db.backup data/fwf.db
```

## Production Deployment

### Before Deploying:
1. **Always backup database**:
```bash
# On production server
cp data/fwf.db data/fwf.db.$(date +%Y%m%d_%H%M%S)
```

2. **Test migration locally** on copy of production data

3. **Review migration SQL** - ensure it's idempotent (can run multiple times safely)

### Deployment Steps:
```bash
# 1. SSH into production server
ssh user@your-server.com

# 2. Navigate to backend directory
cd /path/to/fwf/backend

# 3. Pull latest code (contains new migration file)
git pull

# 4. Run migrations
node migrations/migrate.js

# 5. Restart server
pm2 restart fwf-backend  # or your process manager
```

## Migration Best Practices

### ✅ DO:
- Always include rollback instructions in migration comments
- Use `IF NOT EXISTS` for CREATE TABLE
- Use `ALTER TABLE` for incremental changes
- Test on production data copy first
- Keep migrations small and focused
- Version control all migrations

### ❌ DON'T:
- Never modify existing migration files after they're applied
- Don't delete migration files from version control
- Avoid destructive operations without backups
- Don't combine unrelated schema changes

## Migration Tracking

Migrations are tracked in the `_migrations` table:
```sql
CREATE TABLE _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT UNIQUE NOT NULL,      -- filename (e.g., "001_initial_schema.sql")
  name TEXT NOT NULL,                -- description from file
  applied_at TEXT DEFAULT (datetime('now'))
);
```

## Rollback Strategy

Currently, **rollback is manual**. To rollback:

1. **Restore from backup**:
```bash
cp data/fwf.db.backup data/fwf.db
```

2. **Or write reverse migration**:
```sql
-- Migration: 003_rollback_kyc_fields
-- Description: Remove KYC fields added in migration 002
-- Date: 2025-02-07

ALTER TABLE users DROP COLUMN kyc_verified;
ALTER TABLE users DROP COLUMN kyc_document_url;
```

## Common Migration Patterns

### Adding a Column:
```sql
ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0;
```

### Adding an Index:
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Creating a New Table:
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### Data Migration:
```sql
-- Update existing records
UPDATE users SET membership_active = 1 WHERE role = 'member';
```

## Troubleshooting

### Migration Fails Mid-Run
- Database is left in inconsistent state
- Restore from backup: `cp data/fwf.db.backup data/fwf.db`
- Fix migration SQL and retry

### Migration Already Applied Error
- File was renamed but version matches existing record
- Check `_migrations` table: `SELECT * FROM _migrations;`
- Manually remove record if needed: `DELETE FROM _migrations WHERE version = 'XXX_name.sql';`

### Foreign Key Constraint Errors
- Ensure foreign keys are enabled: `PRAGMA foreign_keys = ON;`
- Check data consistency before running migration

## Environment Variables

None required. Migration system uses the same `data/fwf.db` path as main server.

## Backup Automation (Production)

Add to cron for automatic backups:
```bash
# Backup database daily at 2am
0 2 * * * cp /path/to/fwf/backend/data/fwf.db /backups/fwf.db.$(date +\%Y\%m\%d)

# Keep only last 30 days
0 3 * * * find /backups -name "fwf.db.*" -mtime +30 -delete
```
