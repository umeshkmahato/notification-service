import { emitToUser } from '../utils/websocket.js';
import redis from '../config/redis.js';

const normalizeInAppPayload = (notification) => {
  if (typeof notification?.message === 'string') {
    return {
      type: notification.type || 'in-app',
      userId: notification.userId,
      title: 'New Notification',
      body: notification.message,
      data: notification.data || {},
      timestamp: new Date().toISOString(),
    };
  }

  return {
    type: notification.type || 'in-app',
    userId: notification.userId,
    title: notification?.message?.title || 'New Notification',
    body: notification?.message?.body || notification?.message?.text || 'You have a new notification',
    data: notification?.message?.data || notification?.data || {},
    timestamp: new Date().toISOString(),
  };
};

const saveNotification = async (notification) => {
  const payload = normalizeInAppPayload(notification);
  if (!payload.userId) {
    throw new Error('Missing userId for in-app notification');
  }

  await redis.lpush('notifications', JSON.stringify(payload));
  await redis.ltrim('notifications', 0, 999);
  emitToUser(payload.userId, payload);
  return payload;
};

const send = async (userId, message) => {
  const payload = typeof message === 'string'
    ? { userId, type: 'in-app', title: 'New Notification', body: message, data: {}, timestamp: new Date().toISOString() }
    : { userId, type: 'in-app', ...message, timestamp: new Date().toISOString() };

  await redis.lpush('notifications', JSON.stringify(payload));
  await redis.ltrim('notifications', 0, 999);
  emitToUser(userId, payload);
  return payload;
};

export { saveNotification, send };
export default { saveNotification, send };
