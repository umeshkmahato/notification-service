import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import redis from './config/redis.js';
import rateLimitMiddleware from './middleware/rateLimitMiddleware.js';
import rabbitMQProducer from './rabbitmq/producer.js';

const app = express();
app.use(express.json());

const getDeviceKey = (userId, platform = 'fcm') => `push:${platform}:devices:${userId}`;

async function getNotificationsFromRedis(userId = null) {
  const notifications = await redis.lrange('notifications', 0, -1);
  const parsedNotifications = notifications.map((n) => JSON.parse(n));

  if (userId) {
    return parsedNotifications.filter((n) => n.userId === userId);
  }

  return parsedNotifications;
}

async function getDeviceTokens(userId, platform = 'fcm') {
  const key = getDeviceKey(userId, platform);
  return redis.smembers(key);
}

async function saveDeviceToken({ userId, deviceToken, platform = 'fcm' }) {
  if (!userId || !deviceToken) {
    throw new Error('userId and deviceToken are required');
  }

  const key = getDeviceKey(userId, platform);
  await redis.sadd(key, deviceToken);
  const savedTokens = await redis.smembers(key);
  return { userId, platform, tokenCount: savedTokens.length, tokens: savedTokens };
}

async function removeDeviceToken({ userId, deviceToken, platform = 'fcm' }) {
  if (!userId || !deviceToken) {
    throw new Error('userId and deviceToken are required');
  }

  const key = getDeviceKey(userId, platform);
  await redis.srem(key, deviceToken);
  const savedTokens = await redis.smembers(key);
  return { userId, platform, tokenCount: savedTokens.length, tokens: savedTokens };
}

app.post('/api/push/register', async (req, res) => {
  try {
    const { userId, deviceToken, deviceTokens, platform = 'fcm' } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const finalTokens = Array.isArray(deviceTokens) ? deviceTokens : [deviceToken].filter(Boolean);

    if (finalTokens.length === 0) {
      return res.status(400).json({ success: false, error: 'deviceToken or deviceTokens are required' });
    }

    const stored = [];
    for (const token of finalTokens) {
      stored.push(await saveDeviceToken({ userId, deviceToken: token, platform }));
    }

    res.json({ success: true, userId, platform, devices: stored });
  } catch (error) {
    console.error('Error registering push device:', error);
    res.status(500).json({ success: false, error: 'Failed to register device token' });
  }
});

app.delete('/api/push/register', async (req, res) => {
  try {
    const { userId, deviceToken, platform = 'fcm' } = req.body;

    if (!userId || !deviceToken) {
      return res.status(400).json({ success: false, error: 'userId and deviceToken are required' });
    }

    const result = await removeDeviceToken({ userId, deviceToken, platform });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error removing push device:', error);
    res.status(500).json({ success: false, error: 'Failed to remove device token' });
  }
});

app.get('/api/push/devices/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const platform = req.query.platform || 'fcm';
    const tokens = await getDeviceTokens(userId, platform);

    res.json({ success: true, userId, platform, tokens, tokenCount: tokens.length });
  } catch (error) {
    console.error('Error fetching push devices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch push devices' });
  }
});

app.post('/api/push/send', async (req, res) => {
  try {
    const { userId, message, title, body, data, platform = 'fcm' } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const deviceTokens = await getDeviceTokens(userId, platform);
    if (!deviceTokens.length) {
      return res.status(404).json({ success: false, error: 'No registered device tokens found for this user' });
    }

    const pushService = await import('./services/pushService.js');
    const result = await pushService.default.sendPushNotification({
      userId,
      platform,
      deviceTokens,
      message: message || { title: title || 'Notification', body: body || 'You have a new notification', data }
    });

    return res.json({ success: result.success, ...result });
  } catch (error) {
    console.error('Error sending push to user devices:', error);
    res.status(500).json({ success: false, error: 'Failed to send push notifications' });
  }
});

app.post('/notifications', rateLimitMiddleware, async (req, res) => {
  try {
    const { message, userId, type = 'in-app' } = req.body;

    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: message and userId are required'
      });
    }

    const notification = {
      id: Date.now(),
      type,
      message,
      userId,
      timestamp: new Date()
    };

    await redis.lpush('notifications', JSON.stringify(notification));

    await rabbitMQProducer.sendMessage(type, {
      type,
      userId,
      message: type === 'in-app' ? { title: 'New Notification', body: message } : message,
      ...req.body
    });

    console.log('New notification sent to RabbitMQ:', notification);
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, error: 'Failed to create notification' });
  }
});

app.get('/notifications', async (req, res) => {
  try {
    const notifications = await getNotificationsFromRedis();
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

app.get('/notifications/:userId', async (req, res) => {
  try {
    const userNotifications = await getNotificationsFromRedis(req.params.userId);
    res.json(userNotifications);
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user notifications' });
  }
});

app.delete('/notifications', async (req, res) => {
  try {
    await redis.del('notifications');
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to clear notifications' });
  }
});

app.get('/api/rate-limits/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const notificationTypes = ['email', 'sms', 'in-app', 'push'];
    const limits = {};

    for (const type of notificationTypes) {
      const status = await redis.get(`ratelimit:${type}:${userId}:minute`);
      const hourStatus = await redis.get(`ratelimit:${type}:${userId}:hour`);
      const dayStatus = await redis.get(`ratelimit:${type}:${userId}:day`);

      limits[type] = {
        minuteUsage: status ? parseInt(status) : 0,
        hourUsage: hourStatus ? parseInt(hourStatus) : 0,
        dayUsage: dayStatus ? parseInt(dayStatus) : 0,
        minuteLimit: type === 'sms' ? 1 : (type === 'in-app' ? 5 : (type === 'push' ? 3 : 2)),
        hourLimit: type === 'sms' ? 5 : (type === 'in-app' ? 30 : (type === 'push' ? 15 : 10)),
        dayLimit: type === 'sms' ? 10 : (type === 'in-app' ? 100 : (type === 'push' ? 50 : 20))
      };
    }

    res.json({ userId, limits });
  } catch (error) {
    console.error('Error fetching rate limits:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rate limits' });
  }
});

app.post('/api/rate-limits/:userId/reset', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Notification type is required'
      });
    }

    const rateLimiter = await import('./utils/rateLimiter.js');
    await rateLimiter.default.reset(userId, type);

    res.json({
      success: true,
      message: `Rate limits for ${type} notifications reset for user ${userId}`
    });
  } catch (error) {
    console.error('Error resetting rate limits:', error);
    res.status(500).json({ success: false, error: 'Failed to reset rate limits' });
  }
});

export default app;
