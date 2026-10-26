import fs from 'fs';
import path from 'path';
import redis from '../config/redis.js';
import PushNotifications from 'node-pushnotifications';

const normalizeMessage = (message) => {
  if (typeof message === 'string') {
    return { title: 'New notification', body: message };
  }

  if (message && typeof message === 'object') {
    return {
      title: message.title || 'New notification',
      body: message.body || message.text || 'You have a new notification',
      data: message.data || {}
    };
  }

  return { title: 'New notification', body: 'You have a new notification', data: {} };
};

const resolveServiceAccount = () => {
  if (process.env.FCM_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FCM_SERVICE_ACCOUNT);
    } catch (error) {
      console.warn('[pushService] FCM_SERVICE_ACCOUNT is not valid JSON:', error.message);
    }
  }

  if (process.env.FCM_SERVICE_ACCOUNT_PATH) {
    const absolutePath = path.resolve(process.cwd(), process.env.FCM_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(absolutePath)) {
      try {
        return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      } catch (error) {
        console.warn('[pushService] Failed to read FCM service account JSON from file:', error.message);
      }
    }
  }

  if (process.env.FCM_PROJECT_ID || process.env.FCM_CLIENT_EMAIL || process.env.FCM_PRIVATE_KEY) {
    return {
      project_id: process.env.FCM_PROJECT_ID,
      client_email: process.env.FCM_CLIENT_EMAIL,
      private_key: (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    };
  }

  return null;
};

const buildPushClient = () => {
  const serviceAccount = resolveServiceAccount();
  const hasFcmCredentials = Boolean(serviceAccount || process.env.FCM_PROJECT_ID || process.env.FCM_CLIENT_EMAIL);

  if (!hasFcmCredentials) {
    console.warn('[pushService] FCM credentials not configured. Push notification sending is disabled until FCM_SERVICE_ACCOUNT or equivalent values are supplied.');
    return null;
  }

  const settings = {
    fcm: {
      appName: process.env.FCM_APP_NAME || 'notification-service',
      ...(serviceAccount ? { serviceAccountKey: serviceAccount } : {}),
      ...(process.env.FCM_PROJECT_ID ? { projectId: process.env.FCM_PROJECT_ID } : {}),
      ...(process.env.FCM_CLIENT_EMAIL ? { serviceAccountId: process.env.FCM_CLIENT_EMAIL } : {})
    }
  };

  return new PushNotifications(settings);
};

const pushClient = buildPushClient();

const getRegisteredTokens = async (userId, platform = 'fcm') => {
  if (userId && typeof userId === 'string') {
    return redis.smembers(`push:${platform}:devices:${userId}`);
  }
  return [];
};

const sendPushNotification = async (notification) => {
  const platform = notification.platform || 'fcm';

  let targetTokens = Array.isArray(notification.deviceTokens)
    ? notification.deviceTokens
    : notification.deviceToken
      ? [notification.deviceToken]
      : [];

  if (!targetTokens.length && notification.userId) {
    targetTokens = await getRegisteredTokens(notification.userId, platform);
  }

  if (!targetTokens.length) {
    return {
      success: false,
      skipped: true,
      reason: 'No device token provided or no tokens are stored for this user.'
    };
  }

  if (!pushClient) {
    return {
      success: false,
      skipped: true,
      reason: 'Push notifications are disabled because FCM credentials are not configured.'
    };
  }

  const message = normalizeMessage(notification.message || notification.body || notification.title);

  const payload = {
    title: message.title,
    body: message.body,
    sound: 'default',
    priority: 'high',
    data: {
      userId: notification.userId,
      type: notification.type || 'push',
      ...(message.data || {}),
      ...(notification.data || {})
    },
    custom: {
      userId: notification.userId,
      type: notification.type || 'push',
      ...(notification.custom || {})
    }
  };

  try {
    const result = await pushClient.send(targetTokens, payload);
    console.log(`[pushService] Push notification sent for user ${notification.userId}:`, JSON.stringify(result));
    return { success: true, result, sentTo: targetTokens.length, platform };
  } catch (error) {
    console.error('[pushService] Failed to send push notification:', error);
    return {
      success: false,
      skipped: false,
      error: error.message,
      platform
    };
  }
};

export { sendPushNotification, getRegisteredTokens };
export default { sendPushNotification, getRegisteredTokens };
