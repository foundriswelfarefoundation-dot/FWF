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
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
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

// Seed admin if not exists
const findAdmin = db.prepare(`SELECT * FROM users WHERE role='admin' LIMIT 1`).get();
if(!findAdmin){
  const hash = bcrypt.hashSync(process.env.ADMIN_PASS || 'Admin@12345', 10);
  const memberId = `${ORG_PREFIX}-ADMIN-001`;
  db.prepare(`INSERT INTO users(member_id,name,email,password_hash,role,membership_active) VALUES(?,?,?,?,?,1)`)
    .run(memberId, 'FWF Admin', process.env.ADMIN_USER || 'admin@fwf', hash, 'admin');
  console.log(`Admin created -> user: ${process.env.ADMIN_USER || 'admin@fwf'} | pass: ${process.env.ADMIN_PASS || 'Admin@12345'}`);
}

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

app.post('/api/auth/login', (req,res)=>{
  const { memberId, password } = req.body;
  const u = db.prepare(`SELECT * FROM users WHERE member_id=?`).get(memberId);
  if(!u) return res.status(400).json({error:'Invalid credentials'});
  if(!bcrypt.compareSync(password, u.password_hash)) return res.status(400).json({error:'Invalid credentials'});
  const token = signToken({ uid: u.id, role: u.role, memberId: u.member_id, name: u.name });
  res.cookie('token', token, { httpOnly:true, sameSite:'lax' });
  res.json({ ok:true, role: u.role });
});

app.post('/api/admin/login', (req,res)=>{
  const { username, password } = req.body;
  const u = db.prepare(`SELECT * FROM users WHERE email=? AND role='admin'`).get(username);
  if(!u) return res.status(400).json({error:'Invalid credentials'});
  if(!bcrypt.compareSync(password, u.password_hash)) return res.status(400).json({error:'Invalid credentials'});
  const token = signToken({ uid: u.id, role: u.role, memberId: u.member_id, name: u.name });
  res.cookie('token', token, { httpOnly:true, sameSite:'lax' });
  res.json({ ok:true });
});

app.post('/api/auth/logout', (req,res)=>{
  res.clearCookie('token');
  res.json({ ok:true });
});

app.get('/api/member/me', auth('member'), (req,res)=>{
  const u = db.prepare(`SELECT id, member_id, name, mobile, email, created_at FROM users WHERE id=?`).get(req.user.uid);
  const w = db.prepare(`SELECT balance_inr, lifetime_earned_inr, lifetime_applied_inr FROM wallets WHERE user_id=?`).get(req.user.uid) || {balance_inr:0,lifetime_earned_inr:0,lifetime_applied_inr:0};
  const p = db.prepare(`SELECT project_name, project_cost, target60_inr, cash_credited_inr, wallet_applied_inr, eligible_flag FROM member_projects WHERE user_id=?`).get(req.user.uid) || null;
  res.json({ user:u, wallet:w, project:p });
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
    active_members: db.prepare(`SELECT COUNT(*) as c FROM users WHERE role='member' AND membership_active=1`).get().c
  };
  const latest = db.prepare(`SELECT member_id,name,mobile,created_at FROM users WHERE role='member' ORDER BY id DESC LIMIT 10`).all();
  res.json({ totals, latest });
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
