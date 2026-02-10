-- Migration: 002_wallet_points_referrals
-- Description: Add wallet points, referrals, quiz tickets, and welcome letter tracking
-- Date: 2026-02-10

-- Add points columns to wallets (1 point = ₹10)
ALTER TABLE wallets ADD COLUMN points_balance REAL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN points_from_donations REAL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN points_from_referrals REAL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN points_from_quiz REAL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN total_points_earned REAL DEFAULT 0;

-- Track first login for welcome letter
ALTER TABLE users ADD COLUMN first_login_done INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referred_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;

-- Referral tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referred_user_id INTEGER NOT NULL,
  payment_amount REAL DEFAULT 0,
  referral_points REAL DEFAULT 0,
  status TEXT CHECK(status IN ('pending','active','expired')) DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  activated_at TEXT,
  FOREIGN KEY(referrer_id) REFERENCES users(id),
  FOREIGN KEY(referred_user_id) REFERENCES users(id)
);

-- Donation tracking for points calculation
CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  points_earned REAL DEFAULT 0,
  donor_name TEXT,
  donor_contact TEXT,
  source TEXT DEFAULT 'direct',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(member_id) REFERENCES users(id)
);

-- Quiz ticket sales tracking
CREATE TABLE IF NOT EXISTS quiz_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  buyer_name TEXT,
  buyer_contact TEXT,
  ticket_price REAL DEFAULT 100,
  points_earned REAL DEFAULT 0,
  sold_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(seller_id) REFERENCES users(id)
);

-- Points transaction ledger (audit trail)
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  points REAL NOT NULL,
  type TEXT CHECK(type IN ('donation','referral','quiz','redeem','adjustment')) NOT NULL,
  description TEXT,
  reference_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Generate referral codes for existing members
-- (will be updated by the server on next login)
