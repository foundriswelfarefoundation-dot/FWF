/**
 * SQLite to MongoDB Migration Script
 * 
 * This script migrates all data from SQLite (backend/data/fwf.db) to MongoDB Atlas.
 * Run this BEFORE switching the backend to use MongoDB.
 * 
 * Usage:
 *   node backend/migrations/migrate-to-mongodb.js
 * 
 * Steps:
 * 1. Reads all data from SQLite
 * 2. Transforms schema for MongoDB
 * 3. Inserts into MongoDB collections
 * 4. Verifies migration success
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongoDB, disconnectMongoDB } from '../lib/mongodb.js';
import User from '../models/User.js';
import Referral from '../models/Referral.js';
import Donation from '../models/Donation.js';
import QuizTicket from '../models/QuizTicket.js';
import PointsLedger from '../models/PointsLedger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/fwf.db');

console.log('🚀 Starting SQLite → MongoDB migration...\n');

// Open SQLite connection
const db = new Database(dbPath, { readonly: true });

async function migrateUsers() {
  console.log('📦 Migrating users...');
  
  const users = db.prepare(`
    SELECT u.*, w.balance_inr, w.lifetime_earned_inr, w.lifetime_applied_inr,
           w.points_balance, w.points_from_donations, w.points_from_referrals, 
           w.points_from_quiz, w.total_points_earned, w.updated_at as wallet_updated_at,
           mp.project_id, mp.project_name, mp.project_cost, mp.target60_inr, 
           mp.cash_credited_inr, mp.wallet_applied_inr, mp.eligible_flag, mp.eligible_on
    FROM users u
    LEFT JOIN wallets w ON u.id = w.user_id
    LEFT JOIN member_projects mp ON u.id = mp.user_id
  `).all();

  const userIdMap = new Map(); // SQLite ID → MongoDB ObjectId

  for (const user of users) {
    const userData = {
      member_id: user.member_id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      password_hash: user.password_hash,
      role: user.role,
      membership_active: Boolean(user.membership_active),
      first_login_done: Boolean(user.first_login_done),
      referral_code: user.referral_code,
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at ? new Date(user.created_at) : new Date(),
      
      // Embedded wallet
      wallet: {
        balance_inr: user.balance_inr || 0,
        lifetime_earned_inr: user.lifetime_earned_inr || 0,
        lifetime_applied_inr: user.lifetime_applied_inr || 0,
        points_balance: user.points_balance || 0,
        points_from_donations: user.points_from_donations || 0,
        points_from_referrals: user.points_from_referrals || 0,
        points_from_quiz: user.points_from_quiz || 0,
        total_points_earned: user.total_points_earned || 0,
        updated_at: user.wallet_updated_at ? new Date(user.wallet_updated_at) : new Date()
      }
    };

    // Embedded member project (if exists)
    if (user.project_id) {
      userData.member_project = {
        project_id: user.project_id,
        project_name: user.project_name,
        project_cost: user.project_cost,
        target60_inr: user.target60_inr,
        cash_credited_inr: user.cash_credited_inr || 0,
        wallet_applied_inr: user.wallet_applied_inr || 0,
        eligible_flag: Boolean(user.eligible_flag),
        eligible_on: user.eligible_on ? new Date(user.eligible_on) : null
      };
    }

    try {
      const mongoUser = await User.create(userData);
      userIdMap.set(user.id, mongoUser._id);
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n❌ Failed to migrate user ${user.member_id}:`, err.message);
    }
  }

  console.log(`\n✅ Migrated ${userIdMap.size} users\n`);
  return userIdMap;
}

async function updateReferredBy(userIdMap) {
  console.log('🔗 Updating referred_by relationships...');
  
  const referrals = db.prepare('SELECT id, referred_by FROM users WHERE referred_by IS NOT NULL').all();
  
  let updated = 0;
  for (const ref of referrals) {
    const userId = userIdMap.get(ref.id);
    const referrerId = userIdMap.get(ref.referred_by);
    
    if (userId && referrerId) {
      await User.findByIdAndUpdate(userId, { referred_by: referrerId });
      updated++;
      process.stdout.write('.');
    }
  }
  
  console.log(`\n✅ Updated ${updated} referral relationships\n`);
}

async function migrateReferrals(userIdMap) {
  console.log('📦 Migrating referrals...');
  
  const referrals = db.prepare('SELECT * FROM referrals').all();
  
  const referralDocs = referrals
    .filter(r => userIdMap.has(r.referrer_id) && userIdMap.has(r.referred_user_id))
    .map(r => ({
      referrer_id: userIdMap.get(r.referrer_id),
      referred_user_id: userIdMap.get(r.referred_user_id),
      payment_amount: r.payment_amount || 0,
      referral_points: r.referral_points || 0,
      status: r.status || 'pending',
      created_at: r.created_at ? new Date(r.created_at) : new Date(),
      activated_at: r.activated_at ? new Date(r.activated_at) : null
    }));

  if (referralDocs.length > 0) {
    await Referral.insertMany(referralDocs);
  }
  
  console.log(`✅ Migrated ${referralDocs.length} referrals\n`);
}

async function migrateDonations(userIdMap) {
  console.log('📦 Migrating donations...');
  
  const donations = db.prepare('SELECT * FROM donations').all();
  
  const donationDocs = donations
    .filter(d => userIdMap.has(d.member_id))
    .map(d => ({
      member_id: userIdMap.get(d.member_id),
      amount: d.amount,
      points_earned: d.points_earned || 0,
      donor_name: d.donor_name,
      donor_contact: d.donor_contact,
      source: d.source || 'direct',
      created_at: d.created_at ? new Date(d.created_at) : new Date()
    }));

  if (donationDocs.length > 0) {
    await Donation.insertMany(donationDocs);
  }
  
  console.log(`✅ Migrated ${donationDocs.length} donations\n`);
}

async function migrateQuizTickets(userIdMap) {
  console.log('📦 Migrating quiz tickets...');
  
  const tickets = db.prepare('SELECT * FROM quiz_tickets').all();
  
  const ticketDocs = tickets
    .filter(t => userIdMap.has(t.seller_id))
    .map(t => ({
      seller_id: userIdMap.get(t.seller_id),
      buyer_name: t.buyer_name,
      buyer_contact: t.buyer_contact,
      ticket_price: t.ticket_price || 100,
      points_earned: t.points_earned || 0,
      sold_at: t.sold_at ? new Date(t.sold_at) : new Date()
    }));

  if (ticketDocs.length > 0) {
    await QuizTicket.insertMany(ticketDocs);
  }
  
  console.log(`✅ Migrated ${ticketDocs.length} quiz tickets\n`);
}

async function migratePointsLedger(userIdMap) {
  console.log('📦 Migrating points ledger...');
  
  const ledger = db.prepare('SELECT * FROM points_ledger').all();
  
  const ledgerDocs = ledger
    .filter(l => userIdMap.has(l.user_id))
    .map(l => ({
      user_id: userIdMap.get(l.user_id),
      points: l.points,
      type: l.type,
      description: l.description,
      reference_id: l.reference_id,
      created_at: l.created_at ? new Date(l.created_at) : new Date()
    }));

  if (ledgerDocs.length > 0) {
    await PointsLedger.insertMany(ledgerDocs);
  }
  
  console.log(`✅ Migrated ${ledgerDocs.length} ledger entries\n`);
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');
  
  const counts = {
    users: await User.countDocuments(),
    referrals: await Referral.countDocuments(),
    donations: await Donation.countDocuments(),
    quizTickets: await QuizTicket.countDocuments(),
    pointsLedger: await PointsLedger.countDocuments()
  };

  console.log('📊 MongoDB Collection Counts:');
  console.log(`   Users: ${counts.users}`);
  console.log(`   Referrals: ${counts.referrals}`);
  console.log(`   Donations: ${counts.donations}`);
  console.log(`   Quiz Tickets: ${counts.quizTickets}`);
  console.log(`   Points Ledger: ${counts.pointsLedger}\n`);

  // Test login with test member
  const testMember = await User.findOne({ member_id: 'FWF-TEST-001' });
  if (testMember) {
    console.log('✅ Test member found:', {
      member_id: testMember.member_id,
      name: testMember.name,
      wallet_balance: testMember.wallet.balance_inr,
      points: testMember.wallet.points_balance
    });
  } else {
    console.log('⚠️  Test member not found');
  }
}

// Main migration function
async function runMigration() {
  try {
    await connectMongoDB();
    
    console.log('⚠️  WARNING: This will DELETE all existing data in MongoDB collections!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Clear existing data
    console.log('🗑️  Clearing existing MongoDB data...');
    await User.deleteMany({});
    await Referral.deleteMany({});
    await Donation.deleteMany({});
    await QuizTicket.deleteMany({});
    await PointsLedger.deleteMany({});
    console.log('✅ Collections cleared\n');
    
    // Migrate data
    const userIdMap = await migrateUsers();
    await updateReferredBy(userIdMap);
    await migrateReferrals(userIdMap);
    await migrateDonations(userIdMap);
    await migrateQuizTickets(userIdMap);
    await migratePointsLedger(userIdMap);
    
    // Verify
    await verifyMigration();
    
    console.log('\n🎉 Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Test MongoDB backend locally');
    console.log('2. Update Railway environment variables');
    console.log('3. Deploy updated backend to Railway\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
    await disconnectMongoDB();
  }
}

runMigration();
