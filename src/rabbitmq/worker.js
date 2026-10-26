import dotenv from 'dotenv';
dotenv.config();

import consumer from './consumer.js';

console.log('Starting RabbitMQ notification worker...');

process.on('SIGINT', async () => {
  console.log('Worker shutting down...');
  await consumer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Worker shutting down...');
  await consumer.stop();
  process.exit(0);
});

consumer.start().then(() => {
  console.log('Notification worker is running and processing messages');
}).catch((error) => {
  console.error('Failed to start notification worker:', error);
  process.exit(1);
});
