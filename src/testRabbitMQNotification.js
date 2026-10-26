import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const API_URL = `http://localhost:${process.env.PORT || 5000}/api`;

async function testNotifications() {
  console.log('🔔 Running notification service tests with RabbitMQ\n');

  try {
    console.log('📧 Testing EMAIL notification...');
    const emailResponse = await axios.post(`${API_URL}/notifications`, {
      type: 'email',
      userId: 'user123',
      email: 'test@example.com',
      message: {
        subject: 'Test Email',
        body: 'This is a test email notification sent via RabbitMQ'
      }
    });
    console.log('Response:', emailResponse.data);
    console.log('✅ Email notification test completed\n');

    console.log('📱 Testing SMS notification...');
    const smsResponse = await axios.post(`${API_URL}/notifications`, {
      type: 'sms',
      userId: 'user123',
      phone: '+1234567890',
      message: 'This is a test SMS notification sent via RabbitMQ'
    });
    console.log('Response:', smsResponse.data);
    console.log('✅ SMS notification test completed\n');

    console.log('🔔 Testing IN-APP notification...');
    const inAppResponse = await axios.post(`${API_URL}/notifications`, {
      type: 'in-app',
      userId: 'user123',
      message: {
        title: 'Test Notification',
        body: 'This is a test in-app notification sent via RabbitMQ',
        data: {
          action: 'view',
          entityId: '12345'
        }
      }
    });
    console.log('Response:', inAppResponse.data);
    console.log('✅ In-app notification test completed\n');

    console.log('📲 Testing PUSH notification...');
    const pushResponse = await axios.post(`${API_URL}/notifications`, {
      type: 'push',
      userId: 'user123',
      deviceToken: 'test-device-token',
      message: {
        title: 'Test Push',
        body: 'This is a test push notification sent via RabbitMQ',
        data: {
          action: 'open',
          entityId: '12345'
        }
      }
    });
    console.log('Response:', pushResponse.data);
    console.log('✅ Push notification test completed\n');

    console.log('🔍 Testing GET user notifications...');
    const getUserResponse = await axios.get(`${API_URL}/users/user123/notifications`);
    console.log('User Notifications:', getUserResponse.data);
    console.log('✅ Get user notifications test completed\n');

    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Status code:', error.response.status);
    }
  }
}

testNotifications();
