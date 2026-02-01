# GitHub Copilot Instructions

## Project Overview
FWF (Foundation for Women's Future) is a skills-to-livelihood platform with a dual-architecture:
- **Frontend**: Static HTML/CSS/JS site deployed to Vercel
- **Backend**: Express.js server with SQLite database for member/admin management
- **Serverless API**: Vercel serverless functions for contact/subscription forms (MongoDB + nodemailer)

## Architecture & Key Patterns

### Dual Backend System
The project has **two separate backends** serving different purposes:

1. **`/backend/` - Express Server** (SQLite + JWT auth)
   - Member registration, login, wallet management
   - Admin dashboard and user management  
   - Auth via JWT in httpOnly cookies
   - Database: SQLite via better-sqlite3 in `backend/data/fwf.db`
   - Run: `cd backend && npm start` (port 3000)

2. **`/api/` - Vercel Serverless Functions** (MongoDB + email)
   - Contact forms, subscriptions, terms/privacy acceptance
   - Uses Mongoose models from `/models/`
   - Email via nodemailer (configured in `/lib/mailer.js`)
   - Auto-deployed by Vercel

### Authentication Flow
- JWT tokens stored in httpOnly cookies for security
- Auth middleware in `backend/server.js`: `auth(requiredRole)` 
- Member login: `/api/auth/login` → redirects to `member-dashboard.html`
- Admin login: `/api/admin/login` → redirects to `admin-dashboard.html`
- Client auth helper: `window.AUTH.api(url, opts)` in `auth.js`

### Database Schema (SQLite)
```javascript
users: member_id, name, mobile, email, password_hash, role (member|admin), membership_active
wallets: user_id, balance_inr, lifetime_earned_inr, lifetime_applied_inr
member_projects: user_id, project_name, project_cost, target60_inr, eligible_flag
```

Member IDs auto-generate as `${ORG_PREFIX}-000001` (see `nextMemberId()` in server.js)

### Bilingual Support
- Site supports English + Hindi via `data-lang` attribute on `<html>` tag
- Hindi typography uses Noto Sans Devanagari/Mukta fonts with adjusted line-height
- CSS conditionals: `html[data-lang="hi"] .h1 { font-size:58px; line-height:1.18 }`

## Developer Workflows

### Local Development
```bash
# Backend server (SQLite + auth)
cd backend
npm install
npm start  # http://localhost:3000

# Environment setup
cp .env.example .env
# Edit JWT_SECRET, ADMIN_USER, ADMIN_PASS, ORG_PREFIX
```

### Deployment
- **Vercel**: Auto-deploys from Git (frontend + serverless functions)
- Static site root serves from project root
- Backend Express server deployed separately (not on Vercel)
- `vercel.json` handles URL rewrites for clean URLs

### Git Workflows
Convenience scripts in root:
- `git-push.bat` / `git-push.ps1` / `git-push.sh` - Quick commit/push helpers

## Code Conventions

### File Organization
```
/ (root)           → Static HTML pages (index.html, join.html, etc.)
/assets/           → Images, CSS, JS organized by type
/backend/          → Express server (separate package.json)
  /data/           → SQLite database (gitignored)
/api/              → Vercel serverless functions
/models/           → Mongoose schemas for MongoDB (used by /api/ functions)
/lib/              → Shared utilities (db.js, mailer.js)
```

### API Conventions
- Express routes: `/api/auth/*`, `/api/member/*`, `/api/admin/*`
- Serverless: `/api/contact.js`, `/api/join.js`, `/api/subscribe.js`
- All POST bodies expect JSON (`express.json()` middleware)
- Error responses: `{error: "message"}`
- Success: `{ok: true, ...data}`

### Styling Patterns
- CSS custom properties in `:root` for theming (`--ink`, `--gA`-`--gF` gradients)
- Hand cursor effect via `--cta-size`, `--cta-hot-x/y` for custom cursors
- "Torch effect" spotlight via `--darkness`, `--torch-*` properties
- Mobile-first with explicit breakpoints

## Environment Variables

### Backend (.env in /backend/)
```
JWT_SECRET=         # Secret for JWT signing
ADMIN_USER=         # Admin email (default: admin@fwf)
ADMIN_PASS=         # Admin password (default: Admin@12345)
ORG_PREFIX=         # Member ID prefix (default: FWF)
PORT=3000
```

### Serverless (.env in root)
```
MONGODB_URI=        # MongoDB Atlas connection
MAIL_FROM=          # Email sender
SMTP_HOST/PORT/USER/PASS  # Email credentials
```

## Key Files

- [backend/server.js](../backend/server.js) - Express server, auth, all backend routes
- [auth.js](../auth.js) - Client-side auth helper (`window.AUTH.api`)
- [index.html](../index.html) - Main landing page with bilingual support
- [vercel.json](../vercel.json) - Vercel config (rewrites, clean URLs)
- [lib/db.js](../lib/db.js) - MongoDB connection helper for serverless
- [lib/mailer.js](../lib/mailer.js) - Nodemailer transporter setup

## Common Tasks

### Add New Member API Endpoint
1. Add route in `backend/server.js` after existing `/api/member/*` routes
2. Use `auth('member')` middleware for protected routes
3. Access user data via `req.user` (uid, role, memberId, name)

### Add Serverless Function
1. Create `/api/new-function.js` with default export handler
2. Add Mongoose model in `/models/` if needed
3. Import db/mailer from `/lib/`
4. Vercel auto-deploys on push

### Modify Database Schema
1. Add SQL in `db.exec()` section of `backend/server.js` (lines 33-62)
2. Delete `backend/data/fwf.db` to reset in dev
3. Server recreates schema on startup
