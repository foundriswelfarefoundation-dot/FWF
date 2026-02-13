import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { initSentry, setUserContext, captureError, addBreadcrumb } from './lib/sentry.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize Sentry BEFORE any other middleware
const { requestHandler, errorHandler } = initSentry(app);
app.use(requestHandler);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_secret';
const ORG_PREFIX = process.env.ORG_PREFIX || 'FWF';

// Static site root one level up from backend/
const siteRoot = path.resolve(__dirname, '..');

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173', 'https://fwf-alpha.vercel.app'],
  credentials: true
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(siteRoot));

// --- DB setup with migrations ---
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'fwf.db');
const db = new Database(dbPath);

// Run migrations on startup
import { runMigrations } from './migrations/migrate.js';
try {
  runMigrations(dbPath);
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
}

// Point value: 1 point = ₹10
const POINT_VALUE = 10;
const DONATION_POINTS_PERCENT = 10;   // 10% of donation as points
const REFERRAL_POINTS_PERCENT = 50;   // 50% of referral payment as points
const QUIZ_TICKET_POINTS_PERCENT = 10; // 10% of ticket price as points
const QUIZ_TICKET_PRICE = 100;

function nextMemberId(){
  const row = db.prepare(`SELECT member_id FROM users WHERE role='member' ORDER BY id DESC LIMIT 1`).get();
  let n = 0;
  if(row && row.member_id){
    const m = row.member_id.match(/(\d{6})$/);
    if(m) n = parseInt(m[1],10);
  }
  const next = (n+1).toString().padStart(6,'0');
  return `${ORG_PREFIX}-${next}`;
}
function randPass(len=10){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  let p='';
  for(let i=0;i<len;i++) p += chars[Math.floor(Math.random()*chars.length)];
  return p;
}
function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function generateReferralCode(memberId){
  return memberId.replace(/-/g,'') + Math.random().toString(36).substring(2,6).toUpperCase();
}
function amountToPoints(amountInr){
  return amountInr / POINT_VALUE;
}

// Seed admin if not exists
const findAdmin = db.prepare(`SELECT * FROM users WHERE role='admin' LIMIT 1`).get();
if(!findAdmin){
  const hash = bcrypt.hashSync(process.env.ADMIN_PASS || 'Admin@12345', 10);
  const memberId = `${ORG_PREFIX}-ADMIN-001`;
  db.prepare(`INSERT INTO users(member_id,name,email,password_hash,role,membership_active) VALUES(?,?,?,?,?,1)`)
    .run(memberId, 'FWF Admin', process.env.ADMIN_USER || 'admin@fwf', hash, 'admin');
  console.log(`✅ Admin created -> user: ${process.env.ADMIN_USER || 'admin@fwf'} | pass: ${process.env.ADMIN_PASS || 'Admin@12345'}`);
}

// Seed test member if not exists (for dashboard testing)
const findTestMember = db.prepare(`SELECT * FROM users WHERE member_id=?`).get(`${ORG_PREFIX}-TEST-001`);
if(!findTestMember){
  const testPassword = 'Test@12345';
  const hash = bcrypt.hashSync(testPassword, 10);
  const memberId = `${ORG_PREFIX}-TEST-001`;
  const refCode = generateReferralCode(memberId);
  const testInfo = db.prepare(`INSERT INTO users(member_id,name,mobile,email,password_hash,role,membership_active,referral_code) VALUES(?,?,?,?,?,'member',1,?)`)
    .run(memberId, 'Test Member', '9999999999', 'test@fwf.org', hash, refCode);
  
  // Create wallet for test member with points
  db.prepare(`INSERT OR IGNORE INTO wallets(user_id, balance_inr, lifetime_earned_inr, points_balance, total_points_earned) VALUES(?,?,?,?,?)`)
    .run(testInfo.lastInsertRowid, 5000, 5000, 50, 50);
  
  console.log(`✅ Test member created -> ID: ${memberId} | pass: ${testPassword} | ref: ${refCode}`);
}

// Ensure existing members have referral codes
try {
  const membersWithoutRef = db.prepare(`SELECT id, member_id FROM users WHERE role='member' AND (referral_code IS NULL OR referral_code='')`).all();
  for (const m of membersWithoutRef) {
    const refCode = generateReferralCode(m.member_id);
    db.prepare(`UPDATE users SET referral_code=? WHERE id=?`).run(refCode, m.id);
  }
  if(membersWithoutRef.length > 0) console.log(`✅ Generated referral codes for ${membersWithoutRef.length} member(s)`);
} catch(e) { /* columns may not exist yet before migration */ }

// --- Auth middleware ---
function auth(requiredRole){
  return (req,res,next)=>{
    try{
      const token = req.cookies.token;
      if(!token) return res.status(401).json({error:'Unauthorized'});
      const data = jwt.verify(token, JWT_SECRET);
      req.user = data;
      if(requiredRole && data.role !== requiredRole) return res.status(403).json({error:'Forbidden'});
      next();
    }catch(e){
      return res.status(401).json({error:'Unauthorized'});
    }
  }
}

// --- Routes ---

// Health check / Status endpoint
app.get('/', (req,res)=>{
  res.json({
    ok: true,
    service: 'FWF Backend API',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['/api/auth/login', '/api/admin/login', '/api/auth/logout'],
      member: ['/api/member/me', '/api/member/apply-wallet'],
      admin: ['/api/admin/overview'],
      payment: ['/api/pay/simulate-join'],
      debug: ['/api/debug/users (development only)']
    }
  });
});

// Debug endpoint - check if test member exists (remove in production)
app.get('/api/debug/users', (req,res)=>{
  try {
    const users = db.prepare(`SELECT member_id, name, email, mobile, role, membership_active, created_at FROM users ORDER BY id DESC LIMIT 10`).all();
    const testMember = db.prepare(`SELECT u.member_id, u.name, u.email, u.role, w.balance_inr FROM users u LEFT JOIN wallets w ON u.id = w.user_id WHERE u.member_id=?`).get(`${ORG_PREFIX}-TEST-001`);
    res.json({ 
      ok: true, 
      totalUsers: users.length,
      users,
      testMember: testMember || 'Not found - seeding may have failed'
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// simulate join payment (replace with gateway webhook later)
app.post('/api/pay/simulate-join', (req,res)=>{
  const { name, mobile, email } = req.body;
  if(!name || !mobile) return res.status(400).json({error:'name & mobile required'});
  const exists = db.prepare(`SELECT id FROM users WHERE mobile=? OR email=?`).get(mobile, email||null);
  if(exists) return res.status(400).json({error:'mobile/email already registered'});

  const memberId = nextMemberId();
  const plain = randPass();
  const hash = bcrypt.hashSync(plain, 10);

  const info = db.prepare(`INSERT INTO users(member_id,name,mobile,email,password_hash,role,membership_active) VALUES(?,?,?,?,?,'member',1)`)
               .run(memberId, name, mobile, email||null, hash);
  db.prepare(`INSERT OR IGNORE INTO wallets(user_id) VALUES(?)`).run(info.lastInsertRowid);

  res.json({ ok:true, memberId, password: plain });
});

// Admin: reset a member's password (protected, admin only)
app.post('/api/admin/reset-password', auth('admin'), (req,res)=>{
  const { memberId, newPassword } = req.body;
  if(!memberId || !newPassword) return res.status(400).json({error:'memberId & newPassword required'});
  const u = db.prepare(`SELECT id FROM users WHERE member_id=?`).get(memberId);
  if(!u) return res.status(404).json({error:'Member not found'});
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`UPDATE users SET password_hash=? WHERE id=?`).run(hash, u.id);
  res.json({ ok:true, message:`Password reset for ${memberId}` });
});

app.post('/api/auth/login', (req,res)=>{
  const { memberId, password } = req.body;
  if(!memberId || !password) return res.status(400).json({error:'Member ID and password are required'});
  // Try member_id first, then fallback to email (supports admin login from member page)
  let u = db.prepare(`SELECT * FROM users WHERE member_id=?`).get(memberId);
  if(!u) u = db.prepare(`SELECT * FROM users WHERE email=?`).get(memberId);
  if(!u){
    console.log(`Login failed: member_id/email "${memberId}" not found`);
    return res.status(400).json({error:'Invalid Member ID or password'});
  }
  if(!bcrypt.compareSync(password, u.password_hash)){
    console.log(`Login failed: wrong password for "${memberId}"`);
    return res.status(400).json({error:'Invalid Member ID or password'});
  }
  const token = signToken({ uid: u.id, role: u.role, memberId: u.member_id, name: u.name });
  res.cookie('token', token, { httpOnly:true, sameSite:'none', secure: true });
  addBreadcrumb('auth', 'Member logged in', { memberId: u.member_id });
  res.json({ ok:true, role: u.role });
});

app.post('/api/admin/login', (req,res)=>{
  const { username, password } = req.body;
  const u = db.prepare(`SELECT * FROM users WHERE email=? AND role='admin'`).get(username);
  if(!u) return res.status(400).json({error:'Invalid credentials'});
  if(!bcrypt.compareSync(password, u.password_hash)) return res.status(400).json({error:'Invalid credentials'});
  const token = signToken({ uid: u.id, role: u.role, memberId: u.member_id, name: u.name });
  res.cookie('token', token, { httpOnly:true, sameSite:'none', secure: true });
  res.json({ ok:true });
});

app.post('/api/auth/logout', (req,res)=>{
  res.clearCookie('token', { httpOnly:true, sameSite:'none', secure: true });
  res.json({ ok:true });
});

app.get('/api/member/me', auth('member'), (req,res)=>{
  const u = db.prepare(`SELECT id, member_id, name, mobile, email, created_at, first_login_done, referral_code, avatar_url, bio FROM users WHERE id=?`).get(req.user.uid);
  const w = db.prepare(`SELECT balance_inr, lifetime_earned_inr, lifetime_applied_inr, points_balance, points_from_donations, points_from_referrals, points_from_quiz, total_points_earned FROM wallets WHERE user_id=?`).get(req.user.uid) 
    || {balance_inr:0,lifetime_earned_inr:0,lifetime_applied_inr:0,points_balance:0,points_from_donations:0,points_from_referrals:0,points_from_quiz:0,total_points_earned:0};
  const p = db.prepare(`SELECT project_name, project_cost, target60_inr, cash_credited_inr, wallet_applied_inr, eligible_flag FROM member_projects WHERE user_id=?`).get(req.user.uid) || null;
  
  // Referral stats
  const referralStats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(referral_points) as totalPoints FROM referrals WHERE referrer_id=?`).get(req.user.uid) || {total:0,active:0,totalPoints:0};
  
  // Recent donations collected
  const recentDonations = db.prepare(`SELECT amount, points_earned, donor_name, created_at FROM donations WHERE member_id=? ORDER BY id DESC LIMIT 5`).all(req.user.uid);
  
  // Quiz ticket stats
  const quizStats = db.prepare(`SELECT COUNT(*) as sold, SUM(points_earned) as totalPoints FROM quiz_tickets WHERE seller_id=?`).get(req.user.uid) || {sold:0,totalPoints:0};
  
  // Recent points transactions
  const recentPoints = db.prepare(`SELECT points, type, description, created_at FROM points_ledger WHERE user_id=? ORDER BY id DESC LIMIT 10`).all(req.user.uid);
  
  // Point value info
  const pointInfo = { pointValue: POINT_VALUE, donationPercent: DONATION_POINTS_PERCENT, referralPercent: REFERRAL_POINTS_PERCENT, quizPercent: QUIZ_TICKET_POINTS_PERCENT, ticketPrice: QUIZ_TICKET_PRICE };

  res.json({ user:u, wallet:w, project:p, referralStats, recentDonations, quizStats, recentPoints, pointInfo });
});

// Mark first login as done (dismiss welcome letter)
app.post('/api/member/welcome-done', auth('member'), (req,res)=>{
  db.prepare(`UPDATE users SET first_login_done=1 WHERE id=?`).run(req.user.uid);
  res.json({ ok:true });
});

// Update profile
app.post('/api/member/update-profile', auth('member'), (req,res)=>{
  const { name, bio, avatar_url } = req.body;
  const sets = [];
  const vals = [];
  if(name) { sets.push('name=?'); vals.push(name); }
  if(bio !== undefined) { sets.push('bio=?'); vals.push(bio); }
  if(avatar_url !== undefined) { sets.push('avatar_url=?'); vals.push(avatar_url); }
  if(sets.length === 0) return res.status(400).json({error:'Nothing to update'});
  vals.push(req.user.uid);
  db.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...vals);
  res.json({ ok:true });
});

// Record a donation collected by member → 10% as points
app.post('/api/member/record-donation', auth('member'), (req,res)=>{
  const { amount, donorName, donorContact } = req.body;
  const amt = parseFloat(amount);
  if(!amt || amt <= 0) return res.status(400).json({error:'Valid amount required'});
  
  const pointsRupees = amt * (DONATION_POINTS_PERCENT / 100);
  const points = amountToPoints(pointsRupees);
  
  db.transaction(()=>{
    db.prepare(`INSERT INTO donations(member_id, amount, points_earned, donor_name, donor_contact) VALUES(?,?,?,?,?)`)
      .run(req.user.uid, amt, points, donorName||null, donorContact||null);
    db.prepare(`UPDATE wallets SET points_balance = points_balance + ?, points_from_donations = points_from_donations + ?, total_points_earned = total_points_earned + ?, updated_at = datetime('now') WHERE user_id=?`)
      .run(points, points, points, req.user.uid);
    db.prepare(`INSERT INTO points_ledger(user_id, points, type, description) VALUES(?,?,'donation',?)`)
      .run(req.user.uid, points, `₹${amt} donation collected from ${donorName||'anonymous'} → ${points} points`);
  })();
  
  res.json({ ok:true, points, message:`₹${amt} donation recorded. You earned ${points} points!` });
});

// Sell quiz ticket → 10% as points
app.post('/api/member/sell-ticket', auth('member'), (req,res)=>{
  const { buyerName, buyerContact, ticketPrice } = req.body;
  const price = parseFloat(ticketPrice) || QUIZ_TICKET_PRICE;
  
  const pointsRupees = price * (QUIZ_TICKET_POINTS_PERCENT / 100);
  const points = amountToPoints(pointsRupees);
  
  db.transaction(()=>{
    db.prepare(`INSERT INTO quiz_tickets(seller_id, buyer_name, buyer_contact, ticket_price, points_earned) VALUES(?,?,?,?,?)`)
      .run(req.user.uid, buyerName||null, buyerContact||null, price, points);
    db.prepare(`UPDATE wallets SET points_balance = points_balance + ?, points_from_quiz = points_from_quiz + ?, total_points_earned = total_points_earned + ?, updated_at = datetime('now') WHERE user_id=?`)
      .run(points, points, points, req.user.uid);
    db.prepare(`INSERT INTO points_ledger(user_id, points, type, description) VALUES(?,?,'quiz',?)`)
      .run(req.user.uid, points, `Quiz ticket sold to ${buyerName||'buyer'} (₹${price}) → ${points} points`);
  })();
  
  res.json({ ok:true, points, message:`Ticket sold! You earned ${points} points.` });
});

// Get referral info
app.get('/api/member/referrals', auth('member'), (req,res)=>{
  const u = db.prepare(`SELECT referral_code FROM users WHERE id=?`).get(req.user.uid);
  const referrals = db.prepare(`SELECT r.*, u.name as referred_name, u.member_id as referred_member_id FROM referrals r JOIN users u ON r.referred_user_id = u.id WHERE r.referrer_id=? ORDER BY r.id DESC`).all(req.user.uid);
  res.json({ ok:true, referralCode: u.referral_code, referrals });
});

// Register via referral (used by join flow)
app.post('/api/member/register-referral', (req,res)=>{
  const { referralCode, newUserId } = req.body;
  if(!referralCode || !newUserId) return res.status(400).json({error:'referralCode & newUserId required'});
  
  const referrer = db.prepare(`SELECT id FROM users WHERE referral_code=?`).get(referralCode);
  if(!referrer) return res.status(404).json({error:'Invalid referral code'});
  
  // Create pending referral
  db.prepare(`INSERT INTO referrals(referrer_id, referred_user_id, status) VALUES(?,?,'pending')`)
    .run(referrer.id, newUserId);
  db.prepare(`UPDATE users SET referred_by=? WHERE id=?`).run(referrer.id, newUserId);
  
  res.json({ ok:true });
});

// Activate referral (called when referred member's payment is confirmed)
app.post('/api/member/activate-referral', auth('admin'), (req,res)=>{
  const { referredMemberId, paymentAmount } = req.body;
  const referred = db.prepare(`SELECT id, referred_by FROM users WHERE member_id=?`).get(referredMemberId);
  if(!referred || !referred.referred_by) return res.status(400).json({error:'No referral found'});
  
  const amt = parseFloat(paymentAmount) || 500;
  const pointsRupees = amt * (REFERRAL_POINTS_PERCENT / 100);
  const points = amountToPoints(pointsRupees);
  
  db.transaction(()=>{
    db.prepare(`UPDATE referrals SET status='active', payment_amount=?, referral_points=?, activated_at=datetime('now') WHERE referrer_id=? AND referred_user_id=? AND status='pending'`)
      .run(amt, points, referred.referred_by, referred.id);
    db.prepare(`UPDATE wallets SET points_balance = points_balance + ?, points_from_referrals = points_from_referrals + ?, total_points_earned = total_points_earned + ?, updated_at = datetime('now') WHERE user_id=?`)
      .run(points, points, points, referred.referred_by);
    db.prepare(`INSERT INTO points_ledger(user_id, points, type, description) VALUES(?,?,'referral',?)`)
      .run(referred.referred_by, points, `Referral activated: ${referredMemberId} paid ₹${amt} → ${points} points`);
    db.prepare(`UPDATE users SET membership_active=1 WHERE id=?`).run(referred.id);
  })();
  
  res.json({ ok:true, points });
});

// Points ledger history
app.get('/api/member/points-history', auth('member'), (req,res)=>{
  const ledger = db.prepare(`SELECT points, type, description, created_at FROM points_ledger WHERE user_id=? ORDER BY id DESC LIMIT 50`).all(req.user.uid);
  res.json({ ok:true, ledger });
});

app.post('/api/member/apply-wallet', auth('member'), (req,res)=>{
  const { amount } = req.body;
  const w = db.prepare(`SELECT balance_inr FROM wallets WHERE user_id=?`).get(req.user.uid);
  if(!w || w.balance_inr <= 0) return res.status(400).json({error:'No wallet balance'});
  const amt = Math.min(parseFloat(amount||0), w.balance_inr);
  if(amt <= 0) return res.status(400).json({error:'Invalid amount'});
  db.prepare(`UPDATE wallets SET balance_inr = balance_inr - ?, lifetime_applied_inr = lifetime_applied_inr + ?, updated_at = datetime('now') WHERE user_id=?`).run(amt, amt, req.user.uid);
  db.prepare(`INSERT INTO member_projects(user_id, project_name, project_cost, target60_inr) 
              SELECT ?, 'Not Selected', NULL, 0 WHERE NOT EXISTS(SELECT 1 FROM member_projects WHERE user_id=?)`).run(req.user.uid, req.user.uid);
  db.prepare(`UPDATE member_projects SET wallet_applied_inr = wallet_applied_inr + ? WHERE user_id=?`).run(amt, req.user.uid);
  res.json({ ok:true });
});

app.get('/api/admin/overview', auth('admin'), (req,res)=>{
  const totals = {
    members: db.prepare(`SELECT COUNT(*) as c FROM users WHERE role='member'`).get().c,
    active_members: db.prepare(`SELECT COUNT(*) as c FROM users WHERE role='member' AND membership_active=1`).get().c,
    total_points: db.prepare(`SELECT COALESCE(SUM(total_points_earned),0) as c FROM wallets`).get().c,
    total_donations_count: db.prepare(`SELECT COUNT(*) as c FROM donations`).get().c,
    total_donations_amount: db.prepare(`SELECT COALESCE(SUM(amount),0) as c FROM donations`).get().c,
    total_referrals: db.prepare(`SELECT COUNT(*) as c FROM referrals`).get().c,
    active_referrals: db.prepare(`SELECT COUNT(*) as c FROM referrals WHERE status='active'`).get().c,
    total_tickets_sold: db.prepare(`SELECT COUNT(*) as c FROM quiz_tickets`).get().c,
    csr_partners: 0,
    support_tickets: 0,
    pending_fees: 0,
    total_fee_collected: 0
  };
  try {
    totals.pending_fees = db.prepare(`SELECT COUNT(*) as c FROM membership_fees WHERE status='pending'`).get().c;
    totals.total_fee_collected = db.prepare(`SELECT COALESCE(SUM(amount),0) as c FROM membership_fees WHERE status='verified'`).get().c;
  } catch(e){}
  try {
    totals.csr_partners = db.prepare(`SELECT COUNT(*) as c FROM csr_partners`).get().c;
    totals.support_tickets = db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status='open'`).get().c;
  } catch(e){}
  const latest = db.prepare(`SELECT member_id,name,mobile,email,membership_active,created_at FROM users WHERE role='member' ORDER BY id DESC LIMIT 10`).all();
  res.json({ totals, latest });
});

// Admin: get all members with details
app.get('/api/admin/members', auth('admin'), (req,res)=>{
  const members = db.prepare(`
    SELECT u.id, u.member_id, u.name, u.mobile, u.email, u.membership_active, u.referral_code, u.created_at,
           w.balance_inr, w.points_balance, w.total_points_earned, w.points_from_donations, w.points_from_referrals, w.points_from_quiz
    FROM users u LEFT JOIN wallets w ON u.id = w.user_id
    WHERE u.role='member' ORDER BY u.id DESC
  `).all();
  res.json({ ok:true, members });
});

// Admin: get single member detail
app.get('/api/admin/member/:memberId', auth('admin'), (req,res)=>{
  const u = db.prepare(`SELECT * FROM users WHERE member_id=? AND role='member'`).get(req.params.memberId);
  if(!u) return res.status(404).json({error:'Member not found'});
  const w = db.prepare(`SELECT * FROM wallets WHERE user_id=?`).get(u.id) || {};
  const donations = db.prepare(`SELECT * FROM donations WHERE member_id=? ORDER BY id DESC LIMIT 20`).all(u.id);
  const referrals = db.prepare(`SELECT r.*, ref.name as referred_name, ref.member_id as referred_member_id FROM referrals r JOIN users ref ON r.referred_user_id = ref.id WHERE r.referrer_id=? ORDER BY r.id DESC`).all(u.id);
  const tickets = db.prepare(`SELECT * FROM quiz_tickets WHERE seller_id=? ORDER BY id DESC LIMIT 20`).all(u.id);
  const points = db.prepare(`SELECT * FROM points_ledger WHERE user_id=? ORDER BY id DESC LIMIT 30`).all(u.id);
  const project = db.prepare(`SELECT * FROM member_projects WHERE user_id=?`).get(u.id) || null;
  res.json({ ok:true, user:u, wallet:w, donations, referrals, tickets, points, project });
});

// Admin: toggle member active status
app.post('/api/admin/toggle-member', auth('admin'), (req,res)=>{
  const { memberId } = req.body;
  if(!memberId) return res.status(400).json({error:'memberId required'});
  const u = db.prepare(`SELECT id, membership_active FROM users WHERE member_id=?`).get(memberId);
  if(!u) return res.status(404).json({error:'Member not found'});
  const newStatus = u.membership_active ? 0 : 1;
  db.prepare(`UPDATE users SET membership_active=? WHERE id=?`).run(newStatus, u.id);
  res.json({ ok:true, membership_active: newStatus });
});

// Admin: search members
app.get('/api/admin/search-members', auth('admin'), (req,res)=>{
  const q = req.query.q || '';
  if(!q || q.length < 2) return res.json({ ok:true, members:[] });
  const like = `%${q}%`;
  const members = db.prepare(`
    SELECT u.id, u.member_id, u.name, u.mobile, u.email, u.membership_active, u.created_at,
           w.points_balance
    FROM users u LEFT JOIN wallets w ON u.id = w.user_id
    WHERE u.role='member' AND (u.name LIKE ? OR u.member_id LIKE ? OR u.mobile LIKE ? OR u.email LIKE ?)
    ORDER BY u.id DESC LIMIT 20
  `).all(like, like, like, like);
  res.json({ ok:true, members });
});

// Admin: get all donations
app.get('/api/admin/donations', auth('admin'), (req,res)=>{
  const donations = db.prepare(`
    SELECT d.*, u.name as member_name, u.member_id 
    FROM donations d JOIN users u ON d.member_id = u.id
    ORDER BY d.id DESC LIMIT 50
  `).all();
  res.json({ ok:true, donations });
});

// Admin: get all referrals  
app.get('/api/admin/referrals', auth('admin'), (req,res)=>{
  const referrals = db.prepare(`
    SELECT r.*, 
           referrer.name as referrer_name, referrer.member_id as referrer_member_id,
           referred.name as referred_name, referred.member_id as referred_member_id
    FROM referrals r
    JOIN users referrer ON r.referrer_id = referrer.id
    JOIN users referred ON r.referred_user_id = referred.id
    ORDER BY r.id DESC LIMIT 50
  `).all();
  res.json({ ok:true, referrals });
});

// Admin: get all quiz tickets
app.get('/api/admin/tickets', auth('admin'), (req,res)=>{
  const tickets = db.prepare(`
    SELECT q.*, u.name as seller_name, u.member_id as seller_member_id
    FROM quiz_tickets q JOIN users u ON q.seller_id = u.id
    ORDER BY q.id DESC LIMIT 50
  `).all();
  res.json({ ok:true, tickets });
});

// ===== SUPPORT TICKETS SYSTEM =====
// Create support_tickets table if not exists
db.exec(`CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  user_email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT CHECK(category IN ('general','technical','payment','membership','other')) DEFAULT 'general',
  priority TEXT CHECK(priority IN ('low','medium','high','urgent')) DEFAULT 'medium',
  status TEXT CHECK(status IN ('open','in-progress','resolved','closed')) DEFAULT 'open',
  admin_reply TEXT,
  replied_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// Generate ticket ID
function nextTicketId(){
  const row = db.prepare(`SELECT ticket_id FROM support_tickets ORDER BY id DESC LIMIT 1`).get();
  let n = 0;
  if(row && row.ticket_id){
    const m = row.ticket_id.match(/(\d+)$/);
    if(m) n = parseInt(m[1],10);
  }
  return `FWF-TKT-${(n+1).toString().padStart(4,'0')}`;
}

// Member: submit support ticket
app.post('/api/member/support-ticket', auth('member'), (req,res)=>{
  const { subject, message, category } = req.body;
  if(!subject || !message) return res.status(400).json({error:'Subject and message required'});
  const u = db.prepare(`SELECT name, email FROM users WHERE id=?`).get(req.user.uid);
  const ticketId = nextTicketId();
  db.prepare(`INSERT INTO support_tickets(ticket_id, user_id, user_name, user_email, subject, message, category) VALUES(?,?,?,?,?,?,?)`)
    .run(ticketId, req.user.uid, u.name, u.email, subject, message, category || 'general');
  res.json({ ok:true, ticketId, message:'Support ticket submitted!' });
});

// Member: get my tickets
app.get('/api/member/support-tickets', auth('member'), (req,res)=>{
  const tickets = db.prepare(`SELECT * FROM support_tickets WHERE user_id=? ORDER BY id DESC`).all(req.user.uid);
  res.json({ ok:true, tickets });
});

// Admin: get all support tickets
app.get('/api/admin/support-tickets', auth('admin'), (req,res)=>{
  const tickets = db.prepare(`SELECT * FROM support_tickets ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'in-progress' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END, id DESC`).all();
  const stats = {
    total: db.prepare(`SELECT COUNT(*) as c FROM support_tickets`).get().c,
    open: db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status='open'`).get().c,
    inProgress: db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status='in-progress'`).get().c,
    resolved: db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status='resolved'`).get().c,
    closed: db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status='closed'`).get().c
  };
  res.json({ ok:true, tickets, stats });
});

// Admin: reply to / update support ticket
app.post('/api/admin/support-ticket/:ticketId', auth('admin'), (req,res)=>{
  const { status, adminReply } = req.body;
  const t = db.prepare(`SELECT * FROM support_tickets WHERE ticket_id=?`).get(req.params.ticketId);
  if(!t) return res.status(404).json({error:'Ticket not found'});
  const sets = ['updated_at=datetime(\'now\')'];
  const vals = [];
  if(status){ sets.push('status=?'); vals.push(status); }
  if(adminReply){ sets.push('admin_reply=?'); vals.push(adminReply); sets.push('replied_at=datetime(\'now\')'); }
  vals.push(req.params.ticketId);
  db.prepare(`UPDATE support_tickets SET ${sets.join(',')} WHERE ticket_id=?`).run(...vals);
  res.json({ ok:true, message:'Ticket updated' });
});

// ===== CSR PARTNERS SYSTEM =====
db.exec(`CREATE TABLE IF NOT EXISTS csr_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  industry TEXT,
  partnership_type TEXT CHECK(partnership_type IN ('funding','skill-training','infrastructure','employment','other')) DEFAULT 'funding',
  status TEXT CHECK(status IN ('lead','contacted','negotiating','active','inactive')) DEFAULT 'lead',
  commitment_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

function nextPartnerId(){
  const row = db.prepare(`SELECT partner_id FROM csr_partners ORDER BY id DESC LIMIT 1`).get();
  let n = 0;
  if(row && row.partner_id){
    const m = row.partner_id.match(/(\d+)$/);
    if(m) n = parseInt(m[1],10);
  }
  return `CSR-${(n+1).toString().padStart(4,'0')}`;
}

// Admin: get all CSR partners
app.get('/api/admin/csr-partners', auth('admin'), (req,res)=>{
  const partners = db.prepare(`SELECT * FROM csr_partners ORDER BY id DESC`).all();
  const stats = {
    total: db.prepare(`SELECT COUNT(*) as c FROM csr_partners`).get().c,
    active: db.prepare(`SELECT COUNT(*) as c FROM csr_partners WHERE status='active'`).get().c,
    leads: db.prepare(`SELECT COUNT(*) as c FROM csr_partners WHERE status='lead'`).get().c,
    totalCommitment: db.prepare(`SELECT COALESCE(SUM(commitment_amount),0) as c FROM csr_partners`).get().c,
    totalPaid: db.prepare(`SELECT COALESCE(SUM(paid_amount),0) as c FROM csr_partners`).get().c
  };
  res.json({ ok:true, partners, stats });
});

// Admin: add CSR partner
app.post('/api/admin/csr-partner', auth('admin'), (req,res)=>{
  const { companyName, contactPerson, email, phone, industry, partnershipType, commitmentAmount, notes } = req.body;
  if(!companyName) return res.status(400).json({error:'Company name required'});
  const partnerId = nextPartnerId();
  db.prepare(`INSERT INTO csr_partners(partner_id, company_name, contact_person, email, phone, industry, partnership_type, commitment_amount, notes)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(partnerId, companyName, contactPerson||null, email||null, phone||null, industry||null, partnershipType||'funding', parseFloat(commitmentAmount)||0, notes||null);
  res.json({ ok:true, partnerId, message:'CSR Partner added!' });
});

// Admin: update CSR partner
app.post('/api/admin/csr-partner/:partnerId', auth('admin'), (req,res)=>{
  const { status, paidAmount, notes, commitmentAmount, contactPerson, email, phone } = req.body;
  const p = db.prepare(`SELECT * FROM csr_partners WHERE partner_id=?`).get(req.params.partnerId);
  if(!p) return res.status(404).json({error:'Partner not found'});
  const sets = ['updated_at=datetime(\'now\')'];
  const vals = [];
  if(status){ sets.push('status=?'); vals.push(status); }
  if(paidAmount !== undefined){ sets.push('paid_amount=?'); vals.push(parseFloat(paidAmount)||0); }
  if(notes !== undefined){ sets.push('notes=?'); vals.push(notes); }
  if(commitmentAmount !== undefined){ sets.push('commitment_amount=?'); vals.push(parseFloat(commitmentAmount)||0); }
  if(contactPerson !== undefined){ sets.push('contact_person=?'); vals.push(contactPerson); }
  if(email !== undefined){ sets.push('email=?'); vals.push(email); }
  if(phone !== undefined){ sets.push('phone=?'); vals.push(phone); }
  vals.push(req.params.partnerId);
  db.prepare(`UPDATE csr_partners SET ${sets.join(',')} WHERE partner_id=?`).run(...vals);
  res.json({ ok:true, message:'Partner updated' });
});

// Admin: delete CSR partner
app.delete('/api/admin/csr-partner/:partnerId', auth('admin'), (req,res)=>{
  db.prepare(`DELETE FROM csr_partners WHERE partner_id=?`).run(req.params.partnerId);
  res.json({ ok:true, message:'Partner deleted' });
});

// ===== MEMBERSHIP FEE TRANSACTIONS =====
db.exec(`CREATE TABLE IF NOT EXISTS membership_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id TEXT UNIQUE NOT NULL,
  member_id TEXT NOT NULL,
  user_id INTEGER,
  member_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  fee_type TEXT CHECK(fee_type IN ('joining','renewal','upgrade','other')) DEFAULT 'joining',
  payment_mode TEXT CHECK(payment_mode IN ('upi','bank_transfer','cash','cheque','online','other')) DEFAULT 'online',
  payment_ref TEXT,
  status TEXT CHECK(status IN ('pending','verified','rejected','refunded')) DEFAULT 'pending',
  verified_by TEXT,
  verified_at TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

function nextTxnId(){
  const row = db.prepare(`SELECT txn_id FROM membership_fees ORDER BY id DESC LIMIT 1`).get();
  let n = 0;
  if(row && row.txn_id){
    const m = row.txn_id.match(/(\d+)$/);
    if(m) n = parseInt(m[1],10);
  }
  return `FWF-TXN-${(n+1).toString().padStart(5,'0')}`;
}

// Admin: get all membership fee transactions
app.get('/api/admin/membership-fees', auth('admin'), (req,res)=>{
  const fees = db.prepare(`SELECT * FROM membership_fees ORDER BY id DESC`).all();
  const stats = {
    total: db.prepare(`SELECT COUNT(*) as c FROM membership_fees`).get().c,
    pending: db.prepare(`SELECT COUNT(*) as c FROM membership_fees WHERE status='pending'`).get().c,
    verified: db.prepare(`SELECT COUNT(*) as c FROM membership_fees WHERE status='verified'`).get().c,
    rejected: db.prepare(`SELECT COUNT(*) as c FROM membership_fees WHERE status='rejected'`).get().c,
    totalAmount: db.prepare(`SELECT COALESCE(SUM(amount),0) as c FROM membership_fees WHERE status='verified'`).get().c,
    pendingAmount: db.prepare(`SELECT COALESCE(SUM(amount),0) as c FROM membership_fees WHERE status='pending'`).get().c
  };
  res.json({ ok:true, fees, stats });
});

// Admin: add a membership fee record manually
app.post('/api/admin/membership-fee', auth('admin'), (req,res)=>{
  const { memberId, amount, feeType, paymentMode, paymentRef, status, notes } = req.body;
  if(!memberId || !amount) return res.status(400).json({error:'Member ID and amount required'});
  
  const u = db.prepare(`SELECT id, name FROM users WHERE member_id=?`).get(memberId);
  if(!u) return res.status(404).json({error:'Member not found'});
  
  const txnId = nextTxnId();
  const finalStatus = status || 'pending';
  
  db.prepare(`INSERT INTO membership_fees(txn_id, member_id, user_id, member_name, amount, fee_type, payment_mode, payment_ref, status, notes)
    VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(txnId, memberId, u.id, u.name, parseFloat(amount), feeType||'joining', paymentMode||'online', paymentRef||null, finalStatus, notes||null);
  
  // If verified immediately, activate membership
  if(finalStatus === 'verified'){
    db.prepare(`UPDATE membership_fees SET verified_by=?, verified_at=datetime('now') WHERE txn_id=?`).run(req.user.name||'Admin', txnId);
    db.prepare(`UPDATE users SET membership_active=1 WHERE id=?`).run(u.id);
  }
  
  res.json({ ok:true, txnId, message:'Fee record added!' });
});

// Admin: update fee status (verify/reject/refund)
app.post('/api/admin/membership-fee/:txnId', auth('admin'), (req,res)=>{
  const { status, notes, paymentRef } = req.body;
  const f = db.prepare(`SELECT * FROM membership_fees WHERE txn_id=?`).get(req.params.txnId);
  if(!f) return res.status(404).json({error:'Transaction not found'});
  
  const sets = ['updated_at=datetime(\'now\')'];
  const vals = [];
  if(status){ 
    sets.push('status=?'); vals.push(status);
    if(status === 'verified'){
      sets.push('verified_by=?'); vals.push(req.user.name||'Admin');
      sets.push('verified_at=datetime(\'now\')');
      // Activate member
      if(f.user_id) db.prepare(`UPDATE users SET membership_active=1 WHERE id=?`).run(f.user_id);
    }
    if(status === 'rejected' || status === 'refunded'){
      // Optionally deactivate
      if(f.user_id && f.fee_type === 'joining'){
        db.prepare(`UPDATE users SET membership_active=0 WHERE id=?`).run(f.user_id);
      }
    }
  }
  if(notes !== undefined){ sets.push('notes=?'); vals.push(notes); }
  if(paymentRef !== undefined){ sets.push('payment_ref=?'); vals.push(paymentRef); }
  vals.push(req.params.txnId);
  db.prepare(`UPDATE membership_fees SET ${sets.join(',')} WHERE txn_id=?`).run(...vals);
  res.json({ ok:true, message:'Transaction updated' });
});

// Admin: get fee summary for a specific member
app.get('/api/admin/membership-fees/:memberId', auth('admin'), (req,res)=>{
  const fees = db.prepare(`SELECT * FROM membership_fees WHERE member_id=? ORDER BY id DESC`).all(req.params.memberId);
  res.json({ ok:true, fees });
});

// Sentry error handler MUST be before other error handlers and after all routes
app.use(errorHandler);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  captureError(err, {
    url: req.url,
    method: req.method,
    user: req.user,
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, ()=>{
  console.log(`FWF backend running on http://localhost:${PORT}`);
  console.log(`Site served from: ${siteRoot}`);
});
