/**
 * Rate Limiting Middleware for Notification API
 *
 * This middleware applies rate limiting to notification API requests
 * based on user ID and notification type.
 */
import rateLimiter from '../utils/rateLimiter.js';

const rateLimits = {
  email: {
    maxPerMinute: 2,
    maxPerHour: 10,
    maxPerDay: 20
  },
  sms: {
    maxPerMinute: 1,
    maxPerHour: 5,
    maxPerDay: 10
  },
  'in-app': {
    maxPerMinute: 5,
    maxPerHour: 30,
    maxPerDay: 100
  },
  push: {
    maxPerMinute: 3,
    maxPerHour: 15,
    maxPerDay: 50
  }
};

async function rateLimitMiddleware(req, res, next) {
  if (!req.body.type || !req.body.userId) {
    return next();
  }

  const { type, userId } = req.body;

  try {
    const limits = rateLimits[type] || { maxPerMinute: 2, maxPerHour: 20, maxPerDay: 50 };
    const result = await rateLimiter.checkLimit(userId, type, limits);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: result.reason,
        retryAfter: type === 'sms' ? 60 : 30
      });
    }

    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      originalEnd.call(this, chunk, encoding);

      if (res.statusCode >= 200 && res.statusCode < 300) {
        rateLimiter.increment(userId, type).catch((err) => console.error('Failed to increment rate limit counter:', err));
      }
    };

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    next();
  }
}

export default rateLimitMiddleware;
