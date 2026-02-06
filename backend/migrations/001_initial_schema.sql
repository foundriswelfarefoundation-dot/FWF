-- Migration: 001_initial_schema
-- Description: Create initial database schema
-- Date: 2025-02-06

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT UNIQUE,
  name TEXT,
  mobile TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT CHECK(role IN ('member','admin')) NOT NULL DEFAULT 'member',
  membership_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id INTEGER UNIQUE,
  balance_inr REAL DEFAULT 0,
  lifetime_earned_inr REAL DEFAULT 0,
  lifetime_applied_inr REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS member_projects (
  user_id INTEGER UNIQUE,
  project_id INTEGER,
  project_name TEXT,
  project_cost REAL,
  target60_inr REAL,
  cash_credited_inr REAL DEFAULT 0,
  wallet_applied_inr REAL DEFAULT 0,
  eligible_flag INTEGER DEFAULT 0,
  eligible_on TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
