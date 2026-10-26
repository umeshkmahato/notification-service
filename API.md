# Notification Service API Documentation

This document provides detailed information about the Notification Service API endpoints.

## Base URL

For local development:
```
http://localhost:5000/api
```

## Authentication

Currently, the API does not require authentication. In a production environment, implement an appropriate authentication mechanism.

## API Endpoints

### Send Notification

Sends a notification through the specified channel.

**URL**: `/notifications`  
**Method**: `POST`  
**Auth required**: No (Add authentication in production)  
**Rate limits**: Varies by notification type (see README.md)  
**Message Queue**: Uses RabbitMQ for reliable message delivery

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | Notification type: "email", "sms", "in-app", or "push" (push coming soon) |
| userId | string | Yes | User ID for the notification recipient |
| message | object/string | Yes | Notification content (format varies by type) |

Additional parameters based on notification type:

**For Email**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | No* | Recipient email address (optional if userId is mapped to an email) |
| message | object | Yes | Email content with `subject` and `body` properties |

**For SMS**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | Recipient phone number (E.164 format) |
| message | string | Yes | SMS text content |

**For Push**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceToken | string | No* | FCM device token (required if deviceTokens not provided) |
| deviceTokens | array | No* | Array of FCM device tokens (required if deviceToken not provided) |
| message | object | Yes | Notification with `title`, `body`, and optional `data` object |

**For In-App**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | object | Yes | Notification with `title`, `body`, and optional `data` object |

#### Example Requests

**Email Notification**:
```json
POST /notifications
Content-Type: application/json

{
  "type": "email",
  "userId": "user123",
  "email": "user@example.com",
  "message": {
    "subject": "Your order has shipped",
    "body": "Your order #12345 has shipped and will arrive in 2-3 business days."
  }
}
```

**SMS Notification**:
```json
POST /notifications
Content-Type: application/json

{
  "type": "sms",
  "userId": "user123",
  "phone": "+12065550100",
  "message": "Your verification code is 123456. It expires in 10 minutes."
}
```

**In-App Notification**:
```json
POST /notifications
Content-Type: application/json

{
  "type": "in-app",
  "userId": "user123",
  "message": {
    "title": "New Friend Request",
    "body": "John Doe has sent you a friend request",
    "data": {
      "action": "view_profile",
      "profileId": "john_doe"
    }
  }
}
```

**Push Notification (Coming Soon)**:
```json
POST /notifications
Content-Type: application/json

{
  "type": "push",
  "userId": "user123",
  "deviceToken": "fMEQKC5h70Rtx-gKgNndJD:APA91bHkSmF...",
  "message": {
    "title": "New Message",
    "body": "You have a new message from Jane",
    "data": {
      "action": "open_chat",
      "chatId": "chat_456",
      "senderId": "jane_doe"
    }
  }
}
```

**Push Notification to Multiple Devices (Coming Soon)**:
```json
POST /notifications
Content-Type: application/json

{
  "type": "push",
  "userId": "user123",
  "deviceTokens": [
    "fMEQKC5h70Rtx-gKgNndJD:APA91bHkSmF...",
    "cPz5-DRCSJuAPA91AQGPaw5e_Jmm7..."
  ],
  "message": {
    "title": "Account Security Alert",
    "body": "A new login was detected from Chicago, IL",
    "data": {
      "action": "review_activity",
      "activityId": "login_789"
    }
  }
}
```

#### Success Response

**Code**: `200 OK`

**Content**:
```json
{
  "success": true,
  "notification": {
    "id": 1621872164852,
    "type": "email",
    "userId": "user123",
    "message": {
      "subject": "Your order has shipped",
      "body": "Your order #12345 has shipped and will arrive in 2-3 business days."
    },
    "timestamp": "2023-05-17T12:34:56.789Z"
  }
}
```

#### Error Responses

**Missing Required Fields**:
- **Code**: `400 Bad Request`
- **Content**:
```json
{
  "success": false,
  "error": "Missing required fields: message and userId are required"
}
```

**Rate Limited**:
- **Code**: `429 Too Many Requests`
- **Content**:
```json
{
  "success": false,
  "error": "Rate limit exceeded: 2 email notifications per minute",
  "retryAfter": 30
}
```

**Server Error**:
- **Code**: `500 Internal Server Error`
- **Content**:
```json
{
  "success": false,
  "error": "Failed to create notification"
}
```

### Get User Notifications

Retrieves notifications for a specific user.

**URL**: `/users/:id/notifications`  
**Method**: `GET`  
**Auth required**: No (Add authentication in production)  

#### URL Parameters

| Parameter | Description |
|-----------|-------------|
| id | The ID of the user to get notifications for |

#### Success Response

**Code**: `200 OK`

**Content**:
```json
[
  {
    "id": 1621872164852,
    "type": "email",
    "userId": "user123",
    "message": {
      "subject": "Your order has shipped",
      "body": "Your order #12345 has shipped and will arrive in 2-3 business days."
    },
    "timestamp": "2023-05-17T12:34:56.789Z"
  },
  {
    "id": 1621872201456,
    "type": "in-app",
    "userId": "user123",
    "message": {
      "title": "New Friend Request",
      "body": "John Doe has sent you a friend request",
      "data": {
        "action": "view_profile",
        "profileId": "john_doe"
      }
    },
    "timestamp": "2023-05-17T12:36:41.456Z"
  }
]
```

#### Error Response

**Server Error**:
- **Code**: `500 Internal Server Error`
- **Content**:
```json
{
  "success": false,
  "error": "Failed to fetch user notifications"
}
```

## Rate Limiting

The API implements rate limiting based on:
- User ID
- Notification type 
- Time window (minute, hour, day)

Rate limits can be configured in `src/middleware`.

Current rate limits:

| Type   | Per Minute | Per Hour | Per Day |
|--------|------------|----------|---------|
| Email  | 2          | 10       | 20      |
| SMS    | 1          | 5        | 10      |
| In-app | 5          | 30       | 100     |
| Push   | 3          | 15       | 50      |

When a rate limit is exceeded, the API will respond with a `429 Too Many Requests` status code.

## Architecture

The service uses an event-driven architecture with RabbitMQ:

1. API server receives notification requests
2. Requests are validated and rate-limited
3. Valid requests are published to the RabbitMQ queue
4. RabbitMQ consumer processes messages from the queue
5. Each notification type is handled by its respective service
6. Results are stored in Redis for retrieval via API

### Data Flow

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│                │     │                │     │                │
│  API Server    │────▶│  RabbitMQ      │────▶│  RabbitMQ      │
│                │     │  Queue         │     │  Consumer      │
└────────────────┘     └────────────────┘     └────────────────┘
        │                                             │
        │                                             │
        ▼                                             ▼
┌────────────────┐                          ┌────────────────┐
│                │                          │                │
│  Redis         │◀─────────────────────────│  Notification  │
│  (Rate Limits  │                          │  Services      │
│   & Storage)   │                          │                │
└────────────────┘                          └────────────────┘
``` 