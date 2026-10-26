import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const API_URL = `http://localhost:${process.env.PORT || 5000}`;

async function main() {
  const userId = 'push-user-demo';
  const deviceToken = 'demo-device-token-from-client';

  try {
    console.log('Registering device token...');
    const registerResponse = await axios.post(`${API_URL}/api/push/register`, {
      userId,
      deviceToken,
      platform: 'fcm'
    });

    console.log('Registration response:', registerResponse.data);

    console.log('Sending push notification...');
    const pushResponse = await axios.post(`${API_URL}/notifications`, {
      type: 'push',
      userId,
      deviceToken,
      message: {
        title: 'Demo push notification',
        body: 'This was triggered from the notification service.'
      }
    });

    console.log('Push send response:', pushResponse.data);
  } catch (error) {
    console.error('Push test failed:', error.response?.data || error.message);
    process.exitCode = 1;
  }
}

main();

