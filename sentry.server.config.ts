import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Release Tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Environment
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Configure scope
  initialScope: {
    tags: {
      component: 'backend',
      runtime: 'nodejs',
    },
  },

  // Integrations
  integrations: [
    // Capture console errors
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),
  ],

  // Before send hook
  beforeSend(event, hint) {
    // Add user context if available
    if (event.request?.headers) {
      const userId = event.request.headers['x-user-id'];
      if (userId) {
        event.user = { id: userId as string };
      }
    }

    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      return null;
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Expected Firebase errors
    'auth/id-token-expired',
    'auth/argument-error',
  ],
});
