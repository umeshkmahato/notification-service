import { sendMessage } from '../rabbitmq/producer.js';
import redis from '../config/redis.js';

export const sendNotification = async (req, res) => {
  const { userId, type, message } = req.body;

  if (!userId || !type || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  try {
    const notification = {
      id: Date.now(),
      type,
      userId,
      message,
      ...req.body,
      timestamp: new Date().toISOString()
    };

    await sendMessage('', notification);

    res.status(202).json({
      success: true,
      message: 'Notification queued successfully',
      notification
    });
  } catch (error) {
    console.error('RabbitMQ Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue notification'
    });
  }
};

export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.params.id;
    const notifications = await redis.lrange('notifications', 0, -1);
    const parsedNotifications = notifications
      .map((n) => JSON.parse(n))
      .filter((n) => n.userId === userId);

    res.status(200).json(parsedNotifications);
  } catch (error) {
    console.error('Error retrieving notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications'
    });
  }
};
