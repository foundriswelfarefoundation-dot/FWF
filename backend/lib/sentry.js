import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry error monitoring for Express backend
 * Call this BEFORE any route handlers are defined
 */
export function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('⚠️  SENTRY_DSN not set. Error monitoring disabled.');
    return { requestHandler: (req, res, next) => next(), errorHandler: (err, req, res, next) => next(err) };
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
    
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
      }
      
      // Filter sensitive POST data
      if (event.request?.data) {
        const data = event.request.data;
        if (typeof data === 'object') {
          delete data.password;
          delete data.password_hash;
          delete data.token;
        }
      }
      
      return event;
    },
  });

  console.log('✓ Sentry error monitoring enabled');

  return {
    requestHandler: Sentry.Handlers.requestHandler(),
    errorHandler: Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all errors
        return true;
      },
    }),
  };
}

/**
 * Capture custom errors with context
 */
export function captureError(error, context = {}) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Add user context to error reports
 */
export function setUserContext(user) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  
  Sentry.setUser({
    id: user.uid || user.id,
    email: user.email,
    username: user.memberId || user.member_id,
    role: user.role,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(category, message, data = {}) {
  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    data,
  });
}

export default Sentry;
