import amqp from 'amqplib';
import redis from '../config/redis.js';
import emailService from '../services/emailService.js';
import smsService from '../services/smsService.js';
import inAppService from '../services/inAppService.js';
import pushService from '../services/pushService.js';
import dotenv from 'dotenv';
dotenv.config();

let connection = null;
let channel = null;
const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'notifications';

const notificationHandlers = {
  email: emailService.sendEmail,
  sms: smsService.sendSMS,
  'in-app': inAppService.saveNotification,
  push: pushService.sendPushNotification
};

// Connect to RabbitMQ
async function connect() {
  try {
    if (!connection) {
      connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
      channel = await connection.createChannel();

      // Make sure queue exists with durable settings (survives broker restart)
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      // Only prefetch one message at a time
      // This ensures we don't overwhelm the worker
      await channel.prefetch(1);
      console.log('RabbitMQ consumer connected');
    }
    return { connection, channel };
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
    // Try to reconnect after a delay
    setTimeout(connect, 5000);
    throw error;
  }
}

// Start consuming messages
async function start() {
  try {
    if (!channel) {
      await connect();
    }

    console.log(`Waiting for messages in ${QUEUE_NAME} queue`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        const notificationType = msg.properties.headers?.['notification-type'] || content.type || 'unknown';

        console.log(`Processing ${notificationType} notification for user ${content.userId}`);

        const handler = notificationHandlers[content.type] || notificationHandlers[notificationType];
        if (!handler) {
          console.error(`No handler found for notification type: ${content.type || notificationType}`);
          await channel.ack(msg);
          return;
        }

        // Process the notification with appropriate service
        await handler(content);

        // Store notification for retrieval via API
        await redis.lpush('notifications', JSON.stringify({
          id: Date.now(),
          type: content.type,
          userId: content.userId,
          message: content.message,
          timestamp: new Date().toISOString(),
          status: 'delivered'
        }));

        console.log(`Successfully processed ${content.type} notification for user ${content.userId}`);

        // Don't keep too many notifications in Redis
        await redis.ltrim('notifications', 0, 999);
        await channel.ack(msg);
      } catch (error) {
        console.error('Error processing notification:', error);

        // Store failed notification
        try {
          const content = JSON.parse(msg.content.toString());
          await redis.lpush('failed_notifications', JSON.stringify({
            ...content,
            error: error.message,
            timestamp: new Date().toISOString()
          }));
        } catch (parseError) {
          console.error('Error parsing failed notification:', parseError);
        }

        await channel.nack(msg, false, false);
      }
    });
  } catch (error) {
    console.error('Error starting RabbitMQ consumer:', error);
    channel = null;
    connection = null;
    setTimeout(start, 5000);
  }
}

async function stop() {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    console.log('RabbitMQ consumer disconnected');
  } catch (error) {
    console.error('Error disconnecting RabbitMQ consumer:', error);
  } finally {
    channel = null;
    connection = null;
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down RabbitMQ consumer...');
  await stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down RabbitMQ consumer...');
  await stop();
  process.exit(0);
});

export { start, stop };
export default { start, stop };
