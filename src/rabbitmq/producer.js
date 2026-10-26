import amqp from 'amqplib';
import dotenv from 'dotenv';
dotenv.config();

let connection = null;
let channel = null;
const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'notifications';

async function connect() {
  try {
    if (!connection) {
      connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
      channel = await connection.createChannel();
      await channel.assertQueue(QUEUE_NAME, { durable: true });
      console.log('RabbitMQ producer connected');
    }
    return { connection, channel };
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
    setTimeout(connect, 5000);
    throw error;
  }
}

async function sendMessage(routingKey, message) {
  try {
    if (!channel) {
      await connect();
    }

    const content = Buffer.from(JSON.stringify(message));
    const options = {
      persistent: true,
      contentType: 'application/json',
      headers: {
        'notification-type': message.type || 'unknown',
        timestamp: Date.now().toString()
      }
    };

    await channel.sendToQueue(QUEUE_NAME, content, options);
    console.log(`Message for user ${message.userId} sent to RabbitMQ`);
    return true;
  } catch (error) {
    console.error('Error sending message to RabbitMQ:', error);
    channel = null;
    connection = null;
    throw error;
  }
}

async function disconnect() {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    console.log('RabbitMQ producer disconnected');
  } catch (error) {
    console.error('Error disconnecting RabbitMQ producer:', error);
  } finally {
    channel = null;
    connection = null;
  }
}

process.on('SIGINT', async () => {
  await disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnect();
  process.exit(0);
});

connect().catch(console.error);

export { sendMessage, disconnect };
export default { sendMessage, disconnect };
