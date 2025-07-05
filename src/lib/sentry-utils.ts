import * as Sentry from '@sentry/nextjs';
import type { User } from 'firebase/auth';

/**
 * Set user context in Sentry
 */
export function setSentryUser(user: User | null) {
  if (user) {
    Sentry.setUser({
      id: user.uid,
      email: user.email || undefined,
      username: user.displayName || undefined,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Log a custom event to Sentry
 */
export function logSentryEvent(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  extra?: Record<string, any>
) {
  Sentry.captureMessage(message, {
    level,
    extra,
  });
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    user?: User;
    level?: Sentry.SeverityLevel;
  }
) {
  const { tags, extra, user, level } = context || {};

  if (user) {
    setSentryUser(user);
  }

  Sentry.captureException(error, {
    tags,
    extra,
    level,
  });
}

/**
 * Create a transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Add breadcrumb for better error context
 */
export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Wrap async functions with error handling
 */
export function withSentry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    name?: string;
    op?: string;
    tags?: Record<string, string>;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const transaction = options?.name
      ? startTransaction(options.name, options.op || 'function')
      : null;

    if (options?.tags && transaction) {
      Object.entries(options.tags).forEach(([key, value]) => {
        transaction.setTag(key, value);
      });
    }

    try {
      const result = await fn(...args);
      transaction?.setStatus('ok');
      return result;
    } catch (error) {
      transaction?.setStatus('internal_error');
      captureException(error, {
        tags: options?.tags,
        extra: {
          functionName: options?.name || fn.name,
          arguments: args,
        },
      });
      throw error;
    } finally {
      transaction?.finish();
    }
  }) as T;
}

/**
 * Track user interactions
 */
export function trackInteraction(action: string, category: string, data?: Record<string, any>) {
  addBreadcrumb(`User ${action}`, category, data);

  // Also send as transaction for performance tracking
  const transaction = startTransaction(`user.${action}`, 'user.interaction');
  transaction.setTag('category', category);

  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        transaction.setTag(key, String(value));
      }
    });
  }

  transaction.finish();
}

/**
 * Monitor API calls
 */
export async function monitorApiCall<T>(
  apiCall: () => Promise<T>,
  endpoint: string,
  method: string = 'GET'
): Promise<T> {
  const transaction = startTransaction(`api.${method} ${endpoint}`, 'http.client');
  transaction.setTag('http.method', method);
  transaction.setTag('http.url', endpoint);

  const startTime = Date.now();

  try {
    const result = await apiCall();
    const duration = Date.now() - startTime;

    transaction.setStatus('ok');
    transaction.setMeasurement('http.response_time', duration, 'millisecond');

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    transaction.setStatus('internal_error');
    transaction.setMeasurement('http.response_time', duration, 'millisecond');

    if (error instanceof Error) {
      transaction.setTag('error.message', error.message);
    }

    captureException(error, {
      tags: {
        api_endpoint: endpoint,
        api_method: method,
      },
      extra: {
        duration,
      },
    });

    throw error;
  } finally {
    transaction.finish();
  }
}
