/**
 * FWF Frontend Error Monitoring (Sentry)
 * Include this script in all HTML pages: <script src="/assets/js/sentry.js"></script>
 * Add BEFORE other scripts to catch early errors
 */

(function() {
  // Check if Sentry is configured
  const SENTRY_DSN = 'https://726b7bebade279ceea9521a7dc17f54b@o4510839408230400.ingest.de.sentry.io/4510839463870544';
  
  if (!SENTRY_DSN || SENTRY_DSN === 'YOUR_SENTRY_DSN_HERE') {
    console.warn('⚠️  Sentry not configured. Error monitoring disabled.');
    return;
  }

  // Load Sentry SDK
  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/7.100.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  script.onload = function() {
    if (!window.Sentry) {
      console.error('Failed to load Sentry SDK');
      return;
    }

    window.Sentry.init({
      dsn: SENTRY_DSN,
      environment: window.location.hostname === 'localhost' ? 'development' : 'production',
      
      // Performance monitoring
      integrations: [
        new window.Sentry.BrowserTracing(),
        new window.Sentry.Replay({
          maskAllText: true,
          maskAllInputs: true,
          blockAllMedia: true,
        }),
      ],
      
      // Capture 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,
      
      // Capture 10% of sessions for replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      
      // Filter sensitive data
      beforeSend(event, hint) {
        // Remove cookies and auth headers
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.cookie;
            delete event.request.headers.authorization;
          }
        }
        
        // Filter form data
        if (event.request?.data) {
          const data = event.request.data;
          if (typeof data === 'object') {
            delete data.password;
            delete data.token;
            delete data.mobile;
          }
        }
        
        return event;
      },
      
      // Ignore common non-critical errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
      ],
    });

    console.log('✓ Sentry frontend monitoring enabled');

    // Set user context from auth if available
    if (window.AUTH && window.AUTH.getUser) {
      window.AUTH.getUser().then(user => {
        if (user) {
          window.Sentry.setUser({
            id: user.uid,
            email: user.email,
            username: user.memberId || user.member_id,
            role: user.role,
          });
        }
      }).catch(() => {
        // User not logged in, that's fine
      });
    }
  };
  
  document.head.appendChild(script);
})();

/**
 * Helper function to capture custom errors
 * Usage: window.FWF_Error.capture(error, { context: 'form-submit' })
 */
window.FWF_Error = {
  capture(error, context = {}) {
    if (window.Sentry) {
      window.Sentry.captureException(error, { extra: context });
    } else {
      console.error('Error (Sentry not loaded):', error, context);
    }
  },
  
  setUser(user) {
    if (window.Sentry && user) {
      window.Sentry.setUser({
        id: user.uid || user.id,
        email: user.email,
        username: user.memberId || user.member_id,
        role: user.role,
      });
    }
  },
  
  addBreadcrumb(message, data = {}) {
    if (window.Sentry) {
      window.Sentry.addBreadcrumb({
        message,
        level: 'info',
        data,
      });
    }
  },
};

// Global error handler
window.addEventListener('error', function(event) {
  console.error('Uncaught error:', event.error);
  if (window.FWF_Error) {
    window.FWF_Error.capture(event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  if (window.FWF_Error) {
    window.FWF_Error.capture(new Error(event.reason), {
      promise: 'unhandled_rejection',
    });
  }
});
