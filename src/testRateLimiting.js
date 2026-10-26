import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function testRateLimiting() {
  const userId = 'rate-limit-test-user';
  const baseUrl = 'http://localhost:' + (process.env.PORT || 5000);

  console.log('Starting rate limit test...');
  console.log('------------------------------------------------');

  async function testType(type, count, interval = 100) {
    console.log(`\nTesting ${type} notification rate limiting...`);
    console.log(`Sending ${count} ${type} notifications with ${interval}ms interval`);

    let successCount = 0;
    let limitedCount = 0;

    await checkLimits(type);

    for (let i = 0; i < count; i++) {
      try {
        const notificationData = createNotificationData(type, i);
        const response = await axios.post(`${baseUrl}/notifications`, notificationData);

        if (response.data.success) {
          successCount++;
          console.log(`✅ ${type} notification #${i + 1} sent successfully`);
        }
      } catch (error) {
        limitedCount++;
        if (error.response && error.response.status === 429) {
          console.log(`❌ ${type} notification #${i + 1} rate limited: ${error.response.data.error}`);
        } else {
          console.error(`Error sending ${type} notification #${i + 1}:`, error.message);
        }
      }

      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    await checkLimits(type);

    console.log(`\n${type} test summary:`);
    console.log(`- Successful: ${successCount}/${count}`);
    console.log(`- Rate limited: ${limitedCount}/${count}`);
    console.log('------------------------------------------------');
  }

  function createNotificationData(type, index) {
    const baseData = {
      type,
      userId,
      message: `Test ${type} notification #${index + 1} for rate limiting`
    };

    switch (type) {
      case 'email':
        return {
          ...baseData,
          email: 'test@example.com',
          message: {
            subject: `Test Email #${index + 1}`,
            body: `This is test email #${index + 1} for rate limiting`
          }
        };
      case 'sms':
        return {
          ...baseData,
          phone: '+1234567890',
        };
      case 'push':
        return {
          ...baseData,
          deviceToken: 'test-device-token',
          message: {
            title: `Test Push #${index + 1}`,
            body: `This is test push notification #${index + 1} for rate limiting`
          }
        };
      default:
        return {
          ...baseData,
          message: {
            title: `Test In-App #${index + 1}`,
            body: `This is test in-app notification #${index + 1} for rate limiting`
          }
        };
    }
  }

  async function checkLimits(type) {
    try {
      const response = await axios.get(`${baseUrl}/api/rate-limits/${userId}`);
      const limits = response.data.limits[type];

      console.log(`\nCurrent ${type} rate limits for user ${userId}:`);
      console.log(`- Minute: ${limits.minuteUsage}/${limits.minuteLimit}`);
      console.log(`- Hour: ${limits.hourUsage}/${limits.hourLimit}`);
      console.log(`- Day: ${limits.dayUsage}/${limits.dayLimit}`);
    } catch (error) {
      console.error('Error checking rate limits:', error.message);
    }
  }

  await testType('in-app', 10, 100);
  await testType('email', 5, 100);
  await testType('sms', 3, 100);
  await testType('push', 4, 100);
}

testRateLimiting().catch((error) => {
  console.error('Rate limit test failed:', error);
  process.exit(1);
});
