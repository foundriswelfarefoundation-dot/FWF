# Error Monitoring with Sentry

FWF uses [Sentry](https://sentry.io) for production error tracking across all platforms: backend Express server, frontend pages, and serverless functions.

## Quick Setup

### 1. Create Sentry Account
1. Go to [sentry.io](https://sentry.io) and sign up (free tier available)
2. Create a new project for each platform:
   - **Node.js** project for backend Express server
   - **JavaScript** project for frontend
   - **Node.js** project for serverless functions (or reuse backend project)

### 2. Get Your DSN
After creating projects, copy the **DSN** (Data Source Name) from project settings.  
Format: `https://abc123@o123.ingest.sentry.io/456`

### 3. Configure Environment Variables

#### Backend (`backend/.env`)
```bash
SENTRY_DSN=https://your_backend_dsn@o123.ingest.sentry.io/456
NODE_ENV=production  # or development
```

#### Serverless + Frontend (root `.env`)
```bash
SENTRY_DSN=https://your_frontend_dsn@o123.ingest.sentry.io/789
VERCEL_ENV=production  # auto-set by Vercel
```

#### Frontend Pages
Edit [assets/js/sentry.js](../assets/js/sentry.js#L8):
```javascript
const SENTRY_DSN = 'https://your_browser_dsn@o123.ingest.sentry.io/789';
```

### 4. Install Dependencies

```bash
# Backend
cd backend
npm install

# Serverless + Frontend
npm install
```

## Platform Integration

### Backend Express Server
Error monitoring is **automatically enabled** via middleware in [backend/server.js](../backend/server.js).

**Features:**
- Automatic error capturing
- Request context (URL, method, user)
- Performance monitoring (10% sample rate)
- User context from JWT tokens
- Sensitive data filtering (passwords, tokens, cookies)

**Manual error capture:**
```javascript
import { captureError, addBreadcrumb, setUserContext } from './lib/sentry.js';

// Capture error with context
try {
  riskyOperation();
} catch (err) {
  captureError(err, { operation: 'payment-processing', userId: req.user.uid });
  throw err;
}

// Add breadcrumb for debugging
addBreadcrumb('database', 'User registered', { memberId: newUser.member_id });

// Set user context (done automatically in auth middleware)
setUserContext(req.user);
```

### Frontend (Browser)
Include Sentry script in **all HTML pages** (add before other scripts):
```html
<script src="/assets/js/sentry.js"></script>
<script src="/assets/js/fwf.js"></script>
```

**Features:**
- Global error handler
- Unhandled promise rejection tracking
- Session replay (10% sample rate, 100% on errors)
- Performance monitoring
- User context from `window.AUTH`

**Manual error capture:**
```javascript
// Capture custom errors
try {
  parseFormData();
} catch (err) {
  window.FWF_Error.capture(err, { form: 'join-form' });
}

// Add debugging breadcrumb
window.FWF_Error.addBreadcrumb('Form submitted', { formId: 'contact' });

// Set user (done automatically if using AUTH)
window.FWF_Error.setUser({ uid: 123, email: 'user@example.com' });
```

### Serverless Functions
Wrap your handler with `withSentry()` helper:

```javascript
import { withSentry } from "../lib/sentry.js";

export default withSentry(async function handler(req, res) {
  // Your code here - errors are automatically captured
  await processForm(req.body);
  return res.json({ ok: true });
});
```

**Benefits:**
- Automatic error capturing and reporting
- Handles uncaught errors gracefully
- Flushes errors before function terminates
- Filters sensitive data (passwords, payment proofs, KYC docs)

**Manual capture (if needed):**
```javascript
import { withSentry, captureError } from "../lib/sentry.js";

export default withSentry(async function handler(req, res) {
  try {
    await sendEmail(data);
  } catch (err) {
    captureError(err, { emailType: 'welcome', recipient: data.email });
    // Handle gracefully
    return res.json({ ok: false, error: 'Email failed' });
  }
});
```

## What Gets Captured

### ✅ Captured Automatically:
- Uncaught exceptions
- Unhandled promise rejections
- HTTP request errors (Express)
- Database query errors
- Email sending failures
- Form validation errors (frontend)
- Network errors (frontend)

### 🔒 Filtered (Privacy):
- Passwords
- JWT tokens
- Cookies
- Authorization headers
- Payment proof images (base64)
- KYC documents
- Mobile numbers (in serverless)

### 📊 Additional Context:
- Request URL and method
- User ID, role, member ID (if logged in)
- Browser info (frontend)
- Environment (development/production)
- Stack traces
- Breadcrumbs (debugging trail)

## Monitoring Best Practices

### 1. **Check Errors Daily**
- Set up email/Slack alerts in Sentry dashboard
- Review unresolved issues weekly
- Prioritize high-frequency errors

### 2. **Add Breadcrumbs**
For complex operations, add breadcrumbs to trace user flow:
```javascript
addBreadcrumb('registration', 'Step 1: Form validation passed');
addBreadcrumb('registration', 'Step 2: Payment verified');
addBreadcrumb('registration', 'Step 3: Member created in MongoDB');
// Error occurs here - breadcrumbs show exact failure point
```

### 3. **Set User Context**
Always identify users in error reports (done automatically with auth):
```javascript
setUserContext({
  id: user.uid,
  email: user.email,
  username: user.memberId,
  role: user.role,
});
```

### 4. **Performance Monitoring**
Current sample rates:
- Backend: 10% of transactions
- Frontend: 10% of pageviews
- Serverless: 10% of invocations

**Adjust in production** if needed (higher = more cost):
```javascript
// In sentry.js
tracesSampleRate: 0.1, // 10%
```

### 5. **Session Replay** (Frontend Only)
Captures user interactions leading to errors:
- 10% of normal sessions
- 100% of sessions with errors
- All text/inputs/media are masked for privacy

**Disable if needed:**
```javascript
// In assets/js/sentry.js
integrations: [
  new window.Sentry.BrowserTracing(),
  // Remove Replay integration
],
```

## Cost Management

Sentry free tier limits:
- **5,000 errors/month**
- **10,000 performance transactions/month**
- **50 session replays/month**

**Reduce usage:**
1. Lower sample rates:
   ```javascript
   tracesSampleRate: 0.05, // 5% instead of 10%
   ```

2. Ignore non-critical errors:
   ```javascript
   ignoreErrors: [
     'ResizeObserver loop limit exceeded',
     'Network request failed', // if too noisy
   ],
   ```

3. Use separate projects (track quota independently):
   - Development project (local testing)
   - Production project (live errors)

## Troubleshooting

### Errors not appearing in Sentry?
1. **Check DSN is set:**
   ```bash
   # Backend
   echo $SENTRY_DSN
   
   # Frontend
   # View browser console - should see "✓ Sentry frontend monitoring enabled"
   ```

2. **Check network tab** (browser): Errors sent to `sentry.io/api/...`

3. **Test manually:**
   ```javascript
   // Backend
   throw new Error('Test error');
   
   // Frontend
   window.FWF_Error.capture(new Error('Test error'));
   ```

### Too many errors?
- Filter noisy errors in Sentry dashboard
- Add to `ignoreErrors` array
- Fix underlying issues (don't just hide errors!)

### Sensitive data leaking?
- Check `beforeSend` filters in:
  - [backend/lib/sentry.js](../backend/lib/sentry.js)
  - [lib/sentry.js](../lib/sentry.js) (serverless)
  - [assets/js/sentry.js](../assets/js/sentry.js) (frontend)
- Add additional fields to filter

### Performance impact?
- Use lower sample rates (5% or less)
- Disable session replay if not needed
- Monitor Sentry's own performance metrics

## Example Workflows

### Debugging a Production Error
1. **Receive Sentry alert** (email/Slack)
2. **Open error in dashboard** - view stack trace
3. **Check breadcrumbs** - see what user did before error
4. **View user context** - identify affected users
5. **Reproduce locally** using error details
6. **Fix and deploy**
7. **Mark as resolved** in Sentry

### Adding Error Tracking to New Feature
1. **Wrap risky code** in try/catch
2. **Add breadcrumbs** at key steps
3. **Capture errors** with context
4. **Test locally** - trigger error, check Sentry
5. **Deploy and monitor** Sentry dashboard

## Resources

- [Sentry Docs](https://docs.sentry.io/)
- [Node.js SDK](https://docs.sentry.io/platforms/node/)
- [JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
- [Best Practices](https://docs.sentry.io/product/best-practices/)

## Support

For Sentry setup issues, contact: support@fwf.org
