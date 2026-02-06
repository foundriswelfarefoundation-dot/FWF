import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Production-safe database migration runner for SQLite
 * 
 * Usage:
 *   node migrate.js            → Run pending migrations
 *   node migrate.js --status   → Show migration status
 *   node migrate.js --rollback → Rollback last migration (if available)
 */

export function runMigrations(dbPath) {
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = db.prepare('SELECT version FROM _migrations').all().map(r => r.version);
  const pending = files.filter(f => !applied.includes(f));

  if (pending.length === 0) {
    console.log('✓ Database is up to date. No pending migrations.');
    return { success: true, appliedCount: 0 };
  }

  console.log(`📦 Found ${pending.length} pending migration(s):`);
  
  let appliedCount = 0;
  const insertMigration = db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)');

  for (const file of pending) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const name = sql.match(/-- Description: (.+)/)?.[1] || file;

    console.log(`  → Applying ${file}: ${name}`);
    
    try {
      db.transaction(() => {
        db.exec(sql);
        insertMigration.run(file, name);
      })();
      console.log(`    ✓ Applied successfully`);
      appliedCount++;
    } catch (err) {
      console.error(`    ✗ Migration failed: ${err.message}`);
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }

  console.log(`\n✓ Successfully applied ${appliedCount} migration(s)`);
  return { success: true, appliedCount };
}

export function showStatus(dbPath) {
  const db = new Database(dbPath);
  
  // Check if migrations table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'
  `).get();

  if (!tableExists) {
    console.log('⚠ No migrations have been run yet.');
    return;
  }

  const applied = db.prepare(`
    SELECT version, name, applied_at 
    FROM _migrations 
    ORDER BY id ASC
  `).all();

  const migrationsDir = __dirname;
  const allFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log('\n📊 Migration Status:\n');
  console.log('Applied Migrations:');
  applied.forEach(m => {
    console.log(`  ✓ ${m.version} - ${m.name} (${m.applied_at})`);
  });

  const appliedVersions = applied.map(m => m.version);
  const pending = allFiles.filter(f => !appliedVersions.includes(f));

  if (pending.length > 0) {
    console.log('\nPending Migrations:');
    pending.forEach(f => {
      const filePath = path.join(migrationsDir, f);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const name = sql.match(/-- Description: (.+)/)?.[1] || f;
      console.log(`  ○ ${f} - ${name}`);
    });
  } else {
    console.log('\n✓ No pending migrations.');
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = path.join(__dirname, '..', 'data', 'fwf.db');
  
  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === '--status') {
      showStatus(dbPath);
    } else if (command === '--rollback') {
      console.log('⚠ Rollback support coming soon. For now, restore from backup.');
    } else {
      runMigrations(dbPath);
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}
