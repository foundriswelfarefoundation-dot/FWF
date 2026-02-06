import * as Sentry from '@sentry/node';

let sentryInitialized = false;

/**
 * Initialize Sentry for serverless functions
 * Call once at the start of your handler
 */
export function initSentry() {
  if (sentryInitialized) return;
  
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('⚠️  SENTRY_DSN not set. Error monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || 'production',
    tracesSampleRate: 0.1,
    
    beforeSend(event, hint) {
      // Filter sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
      }
      
      if (event.request?.data) {
        const data = event.request.data;
        if (typeof data === 'object') {
          delete data.password;
          delete data.token;
          delete data.mobile;
          delete data.paymentProof; // Large base64 images
          delete data.idProof;
          delete data.addressProof;
        }
      }
      
      return event;
    },
  });

  sentryInitialized = true;
  console.log('✓ Sentry serverless monitoring enabled');
}

/**
 * Capture error with context
 */
export function captureError(error, context = {}) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Wrap serverless handler with error monitoring
 * Usage:
 * export default withSentry(async function handler(req, res) { ... })
 */
export function withSentry(handler) {
  return async function(req, res) {
    initSentry();
    
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('Serverless function error:', error);
      
      Sentry.captureException(error, {
        extra: {
          url: req.url,
          method: req.method,
          body: req.body ? Object.keys(req.body) : undefined,
        },
      });
      
      // Flush before serverless function terminates
      await Sentry.flush(2000);
      
      // Return error response
      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          error: 'Internal server error',
        });
      }
    }
  };
}

export default Sentry;
