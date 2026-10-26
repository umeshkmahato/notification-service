# Notification Service

A scalable Node.js notification service for email, SMS, in-app, and push-style notifications, built with Redis and RabbitMQ for reliable delivery and rate limiting.

## Quick Start

Use either workflow below.

### Option 1: Local development

1. Clone the repo and install dependencies:
```bash
git clone https://github.com/umeshkmahato/notification-service.git
cd notification-service
yarn install
```

2. Create a `.env` file:
```bash
cp env.example .env
```

3. Update the `.env` values for your local setup:
```env
PORT=5000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE=notifications

# For email notifications with a real SMTP server
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# For SMS, get credentials from Twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone

# For future push notifications feature (coming soon)
# FCM_SERVER_KEY=your_firebase_server_key
# FCM_API_URL=https://fcm.googleapis.com/fcm/send
```

4. Start Redis and RabbitMQ:
```bash
docker-compose up -d redis rabbitmq
```

5. Start the API and worker:
```bash
yarn start
yarn worker
```

6. Verify the API:
```bash
curl http://localhost:5000/notifications
```

7. Run the rate-limit validation script:
```bash
yarn test:ratelimit
```


### Option 2: Docker Compose

```bash
git clone https://github.com/umeshkmahato/notification-service.git
cd notification-service
docker-compose up -d --build
curl http://localhost:5000/notifications
```

This starts Redis, RabbitMQ, the API, and the worker with health checks and dependency ordering. The API is exposed on the host at `http://localhost:5000`.

---

## Overview

This service delivers notifications across multiple channels while enforcing user-level rate limits and keeping message processing asynchronous with RabbitMQ.

* **Email Notifications** - Formatted email messages via SMTP
* **SMS Alerts** - Text message notifications via Twilio
* **Push Notifications** - Coming soon as a planned feature
* **In-App Messages** - Real-time application notifications

## Core Technologies

* **RabbitMQ** - Message queue for reliable asynchronous processing
* **Redis** - Rate limiting and data storage
* **Express API** - RESTful API endpoints
* **Node.js** - Scalable runtime environment

---

## Features

- **Multichannel Notifications:**
  - Email notifications (via Nodemailer with any SMTP server)
  - SMS notifications (via Twilio)
  - In-app notifications (stored in Redis)
  - Push notifications (via Firebase Cloud Messaging) - *Coming soon as a future feature*

- **Reliability:**
  - Event-driven architecture using RabbitMQ
  - Message queue processing with acknowledgments
  - Automatic retries and dead-letter handling
  - Graceful error handling and failure recovery
  - Worker process isolation for fault tolerance

- **Rate limiting:**
  - Configurable per-user and per-channel limits
  - Per-minute, per-hour, and per-day limits
  - API endpoint to inspect current usage
  - Protection at both API and worker levels

## Project Structure

```
notification-service/
├── .gitignore
├── API.md
├── LICENSE
├── README.md
├── docker-compose.yml
├── env.example
├── package.json
├── yarn.lock
├── src/
│   ├── app.js
│   ├── server.js
│   ├── testNotificationService.js
│   ├── testRabbitMQNotification.js
│   ├── testRateLimiting.js
│   ├── config/
│   │   └── redis.js
│   ├── controllers/
│   │   └── notificationController.js
│   ├── middleware/
│   │   └── rateLimitMiddleware.js
│   ├── models/
│   │   └── notification.js
│   ├── rabbitmq/
│   │   ├── consumer.js
│   │   ├── producer.js
│   │   └── worker.js
│   ├── routes/
│   │   └── notificationRoutes.js
│   ├── services/
│   │   ├── emailService.js
│   │   ├── inAppService.js
│   │   ├── pushService.js
│   │   └── smsService.js
│   └── utils/
│       ├── rateLimiter.js
│       └── websocket.js
└──
```

## Prerequisites

- Node.js 22.x or higher
- Redis 6.x or higher
- RabbitMQ 3.x or higher
- SMTP server for email notifications
- Twilio account for SMS notifications
- Firebase project for push notifications

## Testing

Test basic notification functionality:
```bash
# basic notification queue test
npm run test:notification
# or
node src/testNotificationService.js

# rate limiting test
yarn test:ratelimit
# or
node src/testRateLimiting.js

# RabbitMQ integration test
yarn test:rmq
# or
node src/testRabbitMQNotification.js
```

To validate the full Docker stack:

```bash
docker-compose up -d --build
curl http://localhost:5000/notifications
PORT=5000 node src/testRateLimiting.js
```

## API Documentation

See [API.md](API.md) for full endpoint details.

### Send a notification
Sends a notification through the specified channel.

**URL**: `/api/notifications`  
**Method**: `POST`  
**Auth required**: No

### Get user notifications
Retrieves notifications for a specific user.

**URL**: `/api/users/:id/notifications`  
**Method**: `GET`

## Rate Limiting Configuration

Rate limits are configured in `src/middleware/rateLimitMiddleware.js` and currently set to:

| Type   | Per Minute | Per Hour | Per Day |
|--------|------------|----------|---------|
| Email  | 2          | 10       | 20      |
| SMS    | 1          | 5        | 10      |
| In-app | 5          | 30       | 100     |
| Push   | 3          | 15       | 50      |

## Push device registration

The service can store a user’s device token for later push delivery.

```bash
curl -X POST http://localhost:5000/api/push/register \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "user-123",
    "deviceToken": "fcm-device-token",
    "platform": "fcm"
  }'
```

Response:
```json
{
  "success": true,
  "userId": "user-123",
  "platform": "fcm",
  "devices": [
    {
      "userId": "user-123",
      "platform": "fcm",
      "tokenCount": 1,
      "tokens": ["fcm-device-token"]
    }
  ]
}
```

List stored tokens:
```bash
curl 'http://localhost:5000/api/push/devices/user-123?platform=fcm'
```

## Browser / Web Push example

A minimal browser example is included in `web-push-example.html` and a service worker in `service-worker.js`.

1. Replace `YOUR_VAPID_PUBLIC_KEY` with your browser VAPID public key.
2. Serve the files from a web app or static host.
3. Register the browser and call the backend registration endpoint.

Example usage:
```html
<script>
  // Register the browser and send the subscription to the backend
  // Example: POST /api/push/register
</script>
```

This is a client-side example, not a full production web-push setup. For production, use a proper VAPID keypair and a secure web app domain.

## Push testing

Run a quick push test script:
```bash
yarn test:push
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/<feature-branch-name>`)
3. Commit your changes (`git commit -m 'describe your changes in detail'`)
4. Push to the branch (`git push origin feature/<feature-branch-name>`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
