# GitHub Copilot Instructions

## Project Overview
FWF (Foundation for Women's Future) is a skills-to-livelihood platform with a **dual-architecture** design:
- **Frontend**: Static HTML/CSS/JS site deployed to Vercel
- **Backend**: Express.js server with SQLite database for member/admin management
- **Serverless API**: Vercel serverless functions for contact/subscription forms (MongoDB + nodemailer)

## Architecture & Key Patterns

### Dual Backend System
The project has **two separate backends** serving different purposes:

#### 1. **`/backend/` - Express Server** (SQLite + JWT auth)
- **Purpose**: Member registration, login, wallet management, admin dashboard
- **Tech**: Express.js + JWT in httpOnly cookies + better-sqlite3
- **Database**: `backend/data/fwf.db` (SQLite, auto-created, gitignored)
- **Port**: 3000 (local development)
- **Run**: `cd backend && npm start`
- **Auth middleware**: `auth(requiredRole)` in server.js - returns 401/403 on failure
- **Member IDs**: Auto-generate as `${ORG_PREFIX}-000001` via `nextMemberId()`

#### 2. **`/api/` - Vercel Serverless Functions** (MongoDB + email)
- **Purpose**: Contact forms, subscriptions, member join forms, terms/privacy acceptance
- **Tech**: Vercel Functions + Mongoose + Nodemailer
- **Database**: MongoDB Atlas (models in `/models/`)
- **Email**: nodemailer via `getTransporter()` in `/lib/mailer.js`
- **Deployment**: Auto-deployed by Vercel on Git push
- **Pattern**: Each file exports `async function handler(req, res)` as default

### Critical Integration Point: Dual Registration Flow
When a member joins via `/api/join.js`:
1. **Saves to MongoDB** (Member model) - stores payment proof (base64), KYC docs
2. **Registers in SQLite** (via `fetch` to `/api/pay/simulate-join`) - creates auth credentials
3. **Sends emails** - credentials to member, notification to admin
4. **Fallback**: If SQLite registration fails, generates ID from MongoDB ObjectId

**Why?** MongoDB handles form data + file uploads; SQLite handles auth + wallet operations. This separation allows frontend (Vercel) and backend (Express) to be deployed independently.

### Serverless Performance Pattern: Global Caching
Both MongoDB and nodemailer use **global caching** to survive across serverless function invocations:
- `global._mongoose` caches MongoDB connection (see [lib/db.js](lib/db.js#L9-L10))
- `global._mailer` caches nodemailer transporter (see [lib/mailer.js](lib/mailer.js#L3-L4))
- Pattern: Check `cached.conn/transporter` before creating new instance
- **Critical**: Always use `connectDB()` and `getTransporter()` - never create directly

### Authentication Flow
- **JWT tokens** stored in httpOnly cookies for security (XSS protection)
- **Login endpoints**:
  - Members: `POST /api/auth/login` → sets cookie → redirect to `member-dashboard.html`
  - Admins: `POST /api/admin/login` → sets cookie → redirect to `admin-dashboard.html`
- **Client helper**: `window.AUTH.api(url, opts)` in `auth.js` - auto-includes credentials
- **Protected routes**: Use `auth('member')` or `auth('admin')` middleware
- **User data**: Available in `req.user` (uid, role, memberId, name)

### Database Schema (SQLite)
```sql
users: id, member_id (UNIQUE), name, mobile (UNIQUE), email (UNIQUE), password_hash, 
       role ('member'|'admin'), membership_active (0|1), created_at

wallets: user_id (FK), balance_inr, lifetime_earned_inr, lifetime_applied_inr, updated_at

member_projects: user_id (FK), project_id, project_name, project_cost, target60_inr,
                 cash_credited_inr, wallet_applied_inr, eligible_flag, eligible_on
```

**Wallet logic**: Members can't cash out; wallet only adjusts project funding targets.

### Bilingual Support (English + Hindi)
- **Switch**: `<html data-lang="en|hi">` attribute controls language
- **Translations**: Object `T.en` and `T.hi` in `index.html` script
- **i18n attributes**: `data-i18n`, `data-i18n-html`, `data-i18n-placeholder`
- **Typography fix**: Hindi uses Noto Sans Devanagari/Mukta with adjusted line-height to prevent matra clipping
- **Example**: `html[data-lang="hi"] .h1 { font-size:58px; line-height:1.18; padding-top:.18em }`

## Developer Workflows

### Local Development Setup
```bash
# 1. Install dependencies
npm install                  # root (serverless functions)
cd backend && npm install   # backend (Express server)

# 2. Environment setup
# Root .env (for /api/ functions)
MONGODB_URI=mongodb+srv://...
MAIL_FROM="FWF <support@fwf.org>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@email.com
SMTP_PASS=app_password
BACKEND_URL=http://localhost:3000

# backend/.env (for Express server)
JWT_SECRET=your_secret_here_min_32_chars
ADMIN_USER=admin@fwf
ADMIN_PASS=Admin@12345
ORG_PREFIX=FWF
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# 3. Run backend server
cd backend
npm start  # → http://localhost:3000
```

**Admin seeding**: On first run, admin account auto-created with credentials from `.env`.

### Deployment
- **Vercel** (frontend + serverless): Auto-deploys from Git
  - Root `package.json` dependencies: mongoose, nodemailer, @sentry/browser, @sentry/node
  - `vercel.json` handles clean URLs: `/join` → `/join.html`
- **Backend Express**: Deploy separately (Railway, Render, VPS)
  - Update `BACKEND_URL` in root `.env` to production backend URL
- **Why separate?** Vercel serverless has 10s timeout; long-running auth/wallet ops need dedicated server

### Database Migrations (Production)
SQLite schema changes use **migration files** instead of delete/recreate:

```bash
# Create migration file
cd backend/migrations
# Create XXX_description.sql (e.g., 002_add_kyc_fields.sql)

# Test locally (ALWAYS backup first!)
cp data/fwf.db data/fwf.db.backup
node migrations/migrate.js        # Run pending migrations
node migrations/migrate.js --status  # Check status

# Production deployment
# 1. Backup database on server
cp data/fwf.db data/fwf.db.$(date +%Y%m%d_%H%M%S)
# 2. Pull latest code (contains migration file)
git pull
# 3. Run migrations
node migrations/migrate.js
# 4. Restart server
pm2 restart fwf-backend
```

**Migration tracking**: `_migrations` table stores applied migrations. Never modify existing .sql files after deployment.  
**Docs**: [backend/migrations/README.md](backend/migrations/README.md)

### Error Monitoring (Sentry)
FWF uses Sentry for production error tracking across all platforms:

**Setup**:
1. Create account at [sentry.io](https://sentry.io) (free tier: 5k errors/month)
2. Create projects: Node.js (backend), JavaScript (frontend), Node.js (serverless)
3. Add DSNs to `.env`:
   ```bash
   # backend/.env
   SENTRY_DSN=https://abc@o123.ingest.sentry.io/456
   
   # root .env (serverless)
   SENTRY_DSN=https://xyz@o123.ingest.sentry.io/789
   
   # assets/js/sentry.js (frontend - edit file directly)
   const SENTRY_DSN = 'https://def@o123.ingest.sentry.io/123';
   ```

**Integration**:
- **Backend**: Auto-enabled via middleware in `server.js`
- **Frontend**: Include `<script src="/assets/js/sentry.js"></script>` in HTML
- **Serverless**: Wrap handlers with `withSentry()`:
  ```javascript
  import { withSentry } from "../lib/sentry.js";
  export default withSentry(async function handler(req, res) { ... });
  ```

**Manual error capture**:
```javascript
// Backend
import { captureError, addBreadcrumb } from './lib/sentry.js';
captureError(err, { context: 'payment-processing' });
addBreadcrumb('database', 'User registered', { memberId });

// Frontend
window.FWF_Error.capture(err, { form: 'join-form' });
window.FWF_Error.addBreadcrumb('Form submitted', { formId: 'contact' });
```

**Privacy**: Passwords, tokens, cookies, payment proofs, and KYC docs are auto-filtered.  
**Docs**: [docs/ERROR_MONITORING.md](docs/ERROR_MONITORING.md)

### Git Workflows
Convenience scripts:
- `git-push.bat` / `git-push.ps1` / `git-push.sh` - Quick commit/push helpers (Windows/PowerShell/Unix)

## Code Conventions

### File Organization
```
/ (root)              → Static HTML pages (index.html, join.html, donation.html, etc.)
/assets/css/          → Stylesheets (fwf.css = shared component styles)
/assets/images/       → Logo, backgrounds (bg-madhubani.png for hero)
/assets/js/           → Shared scripts (fwf.js)
/backend/             → Express server (separate package.json)
  /data/              → SQLite database (gitignored)
/api/                 → Vercel serverless functions (contact.js, join.js, subscribe.js, privacy.js, terms.js)
/models/              → Mongoose schemas (Contact.js, Member.js, Subscription.js)
/lib/                 → Shared utilities (db.js = MongoDB, mailer.js = nodemailer)
auth.js               → Client-side auth helper (window.AUTH.api)
style.css             → Global page styles
script.js             → Global page scripts
vercel.json           → Deployment config (rewrites, clean URLs)
```

### API Conventions
**Express routes** (`/backend/server.js`):
- `/api/auth/login` (POST) - Member login
- `/api/admin/login` (POST) - Admin login
- `/api/auth/logout` (POST) - Clear cookie
- `/api/member/me` (GET) - Member data (protected)
- `/api/member/apply-wallet` (POST) - Apply wallet to project (protected)
- `/api/admin/overview` (GET) - Admin stats (protected)
- `/api/pay/simulate-join` (POST) - Register member (internal, called by `/api/join.js`)

**Serverless functions** (`/api/*.js`):
- `POST /api/contact` - Contact form → MongoDB + email
- `POST /api/join` - Join form → MongoDB + SQLite (dual registration)
- `POST /api/subscribe` - Newsletter subscription → MongoDB
- `POST /api/privacy` - Privacy policy acceptance → MongoDB
- `POST /api/terms` - Terms acceptance → MongoDB

**Response patterns**:
- Success: `{ok: true, ...data}`
- Error: `{ok: false, error: "message"}` (or `{error: "message"}`)
- All POST bodies expect JSON (`express.json()` middleware)

### Styling Patterns
**CSS custom properties** (`:root`):
- Colors: `--ink` (dark text), `--muted`, `--soft`, `--card`, `--brd`, `--success`
- Gradients: `--gA` to `--gF` (blue, purple, green, cyan, amber, red)
- Effects: `--darkness`, `--torch-*` (spotlight), `--cta-size`, `--cta-hot-x/y` (custom cursor)
- Layout: `--radius`, `--shadow`, `--hero-min`, `--hero-vh`

**Torch effect** (hero section):
- Mouse move activates spotlight via `--mx`, `--my` CSS variables
- Dims after 3s idle (`heroActive`, `idleTimer`)
- Suppressed when custom hand cursor shows

**Hand cursor** (restricted targets):
- Only on: `.brand`, `.btn-join`, `.btn-donate`, `.btn.journey`, `.actionsGrid .primaryBtn`
- Positioned via `--cta-hot-x`, `--cta-hot-y` (pointer hotspot)
- `body.is-hand` class sets `cursor: none` globally

### Mobile-First Breakpoints
```css
@media (max-width:1100px) { /* tablets */ }
@media (max-width:780px)  { /* mobile */ }
@media (max-width:560px)  { /* small mobile */ }
```

## Environment Variables

### Backend (`backend/.env`)
```bash
JWT_SECRET=long_random_string_min_32_chars   # JWT signing key
ADMIN_USER=admin@fwf                         # Admin login email
ADMIN_PASS=Admin@12345                       # Admin login password
ORG_PREFIX=FWF                               # Member ID prefix
PORT=3000                                    # Server port
ALLOWED_ORIGINS=http://localhost:3000,...    # CORS origins
```

### Serverless (root `.env`)
```bash
MONGODB_URI=mongodb+srv://...                # MongoDB Atlas URI
MAIL_FROM="FWF <support@fwf.org>"            # Email sender
SMTP_HOST=smtp.gmail.com                     # SMTP server
SMTP_PORT=465                                # SMTP port
SMTP_SECURE=true                             # Use SSL
SMTP_USER=your@email.com                     # SMTP username
SMTP_PASS=app_password                       # SMTP password
BACKEND_URL=http://localhost:3000            # Express server URL (production in deploy)
```

## Key Files Reference

| File | Purpose |
|------|---------|
| [backend/server.js](backend/server.js) | Express server, all auth routes, SQLite schema, auto-admin seeding |
| [auth.js](auth.js) | Client-side auth helper: `window.AUTH.api(url, opts)` |
| [index.html](index.html) | Landing page with bilingual support, torch effect, i18n |
| [vercel.json](vercel.json) | Vercel config: clean URLs, rewrites |
| [lib/db.js](lib/db.js) | MongoDB connection (cached in `global._mongoose`) |
| [lib/mailer.js](lib/mailer.js) | Nodemailer transporter (cached in `global._mailer`) |
| [api/join.js](api/join.js) | Dual registration: MongoDB + SQLite via fetch |
| [models/Member.js](models/Member.js) | Mongoose schema for member join data |
| [assets/css/fwf.css](assets/css/fwf.css) | Shared component styles (topbar, nav, buttons) |

## Common Tasks

### Add New Member API Endpoint (Express)
1. Add route in `backend/server.js` after existing `/api/member/*` routes
2. Use `auth('member')` middleware: `app.post('/api/member/new', auth('member'), (req,res)=>{})`
3. Access user: `req.user.uid`, `req.user.memberId`, `req.user.name`, `req.user.role`
4. Return JSON: `res.json({ok: true, data})` or `res.status(400).json({error: "msg"})`

### Add Serverless Function
1. Create `/api/new-function.js` with: `export default async function handler(req, res) {}`
2. Import utilities: `import { connectDB } from "../lib/db.js";`
3. Add Mongoose model in `/models/` if storing data
4. Wrap with Sentry: `import { withSentry } from "../lib/sentry.js"; export default withSentry(async function...)`
5. Commit/push → Vercel auto-deploys

### Modify SQLite Schema (Production-Safe)
1. Create migration file: `backend/migrations/00X_description.sql`
2. Write SQL (use `ALTER TABLE`, `CREATE INDEX`, etc.)
3. Test locally:
   ```bash
   cp backend/data/fwf.db backend/data/fwf.db.backup
   node backend/migrations/migrate.js
   ```
4. Production: Backup DB, pull code, run `node migrations/migrate.js`, restart server
5. **Never** modify existing migration files after deployment

### Add Bilingual Content
1. Add `data-i18n="key.name"` attribute to HTML element
2. Define translations in `T.en` and `T.hi` objects in `<script>` section
3. For HTML content: use `data-i18n-html="key.name"`
4. For placeholders: use `data-i18n-placeholder="key.name"`
5. `setI18n(lang)` function handles replacement on language switch

### Debug Deployment Issues
- Use [debug.html](debug.html) to verify file paths and clean URLs work correctly
- Check that Vercel rewrites in `vercel.json` are applied
- Test direct `.html` links vs clean URLs (`/privacy` vs `/privacy.html`)
