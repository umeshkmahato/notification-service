/**
 * Rate Limiter Utility for Notification Service
 *
 * This module provides rate limiting capabilities to prevent sending too many
 * notifications to a single user within a specific time window.
 */

import redis from '../config/redis.js';

class RateLimiter {
  async checkLimit(userId, type, options = {}) {
    if (!userId) {
      throw new Error('User ID is required for rate limiting');
    }

    const defaults = {
      maxPerMinute: 2,
      maxPerHour: 20,
      maxPerDay: 50
    };

    const config = { ...defaults, ...options };
    const minuteKey = `ratelimit:${type}:${userId}:minute`;
    const hourKey = `ratelimit:${type}:${userId}:hour`;
    const dayKey = `ratelimit:${type}:${userId}:day`;

    const [minuteCount, hourCount, dayCount] = await Promise.all([
      redis.get(minuteKey),
      redis.get(hourKey),
      redis.get(dayKey)
    ]);

    if (minuteCount && parseInt(minuteCount) >= config.maxPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${config.maxPerMinute} ${type} notifications per minute`
      };
    }

    if (hourCount && parseInt(hourCount) >= config.maxPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${config.maxPerHour} ${type} notifications per hour`
      };
    }

    if (dayCount && parseInt(dayCount) >= config.maxPerDay) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${config.maxPerDay} ${type} notifications per day`
      };
    }

    return { allowed: true, reason: null };
  }

  async increment(userId, type) {
    if (!userId) {
      throw new Error('User ID is required for rate limiting');
    }

    const minuteKey = `ratelimit:${type}:${userId}:minute`;
    const hourKey = `ratelimit:${type}:${userId}:hour`;
    const dayKey = `ratelimit:${type}:${userId}:day`;

    const pipeline = redis.pipeline();
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60);
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 3600);
    pipeline.incr(dayKey);
    pipeline.expire(dayKey, 86400);

    await pipeline.exec();
  }

  async reset(userId, type) {
    if (!userId) {
      throw new Error('User ID is required for rate limiting');
    }

    const minuteKey = `ratelimit:${type}:${userId}:minute`;
    const hourKey = `ratelimit:${type}:${userId}:hour`;
    const dayKey = `ratelimit:${type}:${userId}:day`;

    await redis.del(minuteKey, hourKey, dayKey);
  }
}

const rateLimiter = new RateLimiter();
export default rateLimiter;
