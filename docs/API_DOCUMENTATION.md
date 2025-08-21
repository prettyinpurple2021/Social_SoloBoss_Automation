# Social Media Automation Platform - API Documentation

## Overview

The Social Media Automation Platform provides a comprehensive REST API for managing social media posts, platform connections, and integrations. This documentation covers all available endpoints, authentication methods, and usage examples.

## Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://api.sma-platform.com/api`

## Authentication

The API uses JWT (JSON Web Token) based authentication. Include the token in the Authorization header for all authenticated requests:

```
Authorization: Bearer <your-jwt-token>
```

### Obtaining a Token

**Register a new user:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'
```

**Login existing user:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

Both endpoints return a response with the JWT token:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **Post creation**: 10 requests per minute  
- **General endpoints**: 100 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Error Handling

The API returns consistent error responses:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  },
  "retryable": false
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid request data
- `INVALID_TOKEN` - Authentication token is invalid or expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `PLATFORM_ERROR` - Social media platform API error

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### POST /auth/login
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### POST /auth/logout
Invalidate the current JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true
}
```

### OAuth Platform Connections

#### POST /oauth/connect/{platform}
Connect a social media platform using OAuth.

**Parameters:**
- `platform` - One of: `facebook`, `instagram`, `pinterest`, `x`

**Request Body:**
```json
{
  "code": "AQD8H9J2K3L4M5N6",
  "redirectUri": "http://localhost:3000/oauth/callback"
}
```

**Response (200):**
```json
{
  "success": true,
  "platformConnection": {
    "id": "conn-123",
    "platform": "facebook",
    "platformUserId": "fb-123456",
    "platformUsername": "johndoe",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### DELETE /oauth/disconnect/{platform}
Disconnect a social media platform.

**Parameters:**
- `platform` - One of: `facebook`, `instagram`, `pinterest`, `x`

**Response (200):**
```json
{
  "success": true
}
```

#### GET /oauth/connections
Get all connected platforms for the user.

**Response (200):**
```json
{
  "connections": [
    {
      "id": "conn-123",
      "platform": "facebook",
      "platformUserId": "fb-123456",
      "platformUsername": "johndoe",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Posts Management

#### GET /posts
Retrieve user's posts with pagination and filtering.

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20, max: 100)
- `status` (optional) - Filter by status: `draft`, `scheduled`, `publishing`, `published`, `failed`
- `platform` (optional) - Filter by platform: `facebook`, `instagram`, `pinterest`, `x`
- `sort` (optional) - Sort by: `createdAt`, `scheduledTime`, `publishedAt` (default: `createdAt`)
- `order` (optional) - Sort order: `asc`, `desc` (default: `desc`)

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/posts?page=1&limit=10&status=scheduled" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "posts": [
    {
      "id": "post-123",
      "content": "Check out this amazing new blog post!",
      "images": ["https://example.com/image1.jpg"],
      "hashtags": ["#blog", "#content", "#social"],
      "platforms": ["facebook", "instagram"],
      "scheduledTime": "2024-01-20T15:30:00Z",
      "status": "scheduled",
      "source": "manual",
      "platformPosts": [
        {
          "platform": "facebook",
          "content": "Check out this amazing new blog post!",
          "status": "scheduled"
        }
      ],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "totalCount": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

#### POST /posts
Create a new post.

**Request Body:**
```json
{
  "content": "Check out this amazing new blog post!",
  "images": ["https://example.com/image1.jpg"],
  "hashtags": ["#blog", "#content", "#social"],
  "platforms": ["facebook", "instagram"],
  "scheduledTime": "2024-01-20T15:30:00Z",
  "platformSpecificContent": {
    "instagram": {
      "content": "Check out this amazing new blog post! 📝✨",
      "hashtags": ["#blog", "#content", "#social", "#instagram"]
    }
  }
}
```

**Response (201):**
```json
{
  "id": "post-123",
  "content": "Check out this amazing new blog post!",
  "images": ["https://example.com/image1.jpg"],
  "hashtags": ["#blog", "#content", "#social"],
  "platforms": ["facebook", "instagram"],
  "scheduledTime": "2024-01-20T15:30:00Z",
  "status": "scheduled",
  "source": "manual",
  "platformPosts": [
    {
      "platform": "facebook",
      "content": "Check out this amazing new blog post!",
      "status": "scheduled"
    },
    {
      "platform": "instagram", 
      "content": "Check out this amazing new blog post! 📝✨",
      "status": "scheduled"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### GET /posts/{postId}
Get a specific post by ID.

**Response (200):**
```json
{
  "id": "post-123",
  "content": "Check out this amazing new blog post!",
  "images": ["https://example.com/image1.jpg"],
  "hashtags": ["#blog", "#content", "#social"],
  "platforms": ["facebook", "instagram"],
  "scheduledTime": "2024-01-20T15:30:00Z",
  "status": "scheduled",
  "source": "manual",
  "platformPosts": [
    {
      "platform": "facebook",
      "platformPostId": null,
      "content": "Check out this amazing new blog post!",
      "status": "scheduled",
      "publishedAt": null,
      "error": null
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### PUT /posts/{postId}
Update an existing post (only draft and scheduled posts).

**Request Body:**
```json
{
  "content": "Updated post content!",
  "hashtags": ["#updated", "#content"],
  "scheduledTime": "2024-01-21T15:30:00Z"
}
```

**Response (200):**
```json
{
  "id": "post-123",
  "content": "Updated post content!",
  "hashtags": ["#updated", "#content"],
  "scheduledTime": "2024-01-21T15:30:00Z",
  "status": "scheduled",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

#### DELETE /posts/{postId}
Delete a post (only draft and scheduled posts).

**Response (200):**
```json
{
  "success": true
}
```

#### POST /posts/{postId}/publish
Publish a post immediately to all configured platforms.

**Response (200):**
```json
{
  "success": true,
  "results": [
    {
      "platform": "facebook",
      "success": true,
      "platformPostId": "fb_123456789",
      "error": null,
      "retryable": false
    },
    {
      "platform": "instagram",
      "success": false,
      "platformPostId": null,
      "error": "Rate limit exceeded",
      "retryable": true
    }
  ]
}
```

#### POST /posts/bulk
Create multiple posts in a single request.

**Request Body:**
```json
{
  "posts": [
    {
      "content": "First bulk post",
      "platforms": ["facebook"],
      "scheduledTime": "2024-01-20T15:30:00Z"
    },
    {
      "content": "Second bulk post", 
      "platforms": ["instagram"],
      "scheduledTime": "2024-01-20T16:30:00Z"
    }
  ]
}
```

**Response (201):**
```json
{
  "scheduledPosts": [
    {
      "id": "post-124",
      "content": "First bulk post",
      "status": "scheduled"
    },
    {
      "id": "post-125", 
      "content": "Second bulk post",
      "status": "scheduled"
    }
  ],
  "errors": []
}
```

### Analytics

#### GET /posts/analytics
Get analytics and statistics for user's posts.

**Query Parameters:**
- `startDate` (optional) - Start date for analytics (YYYY-MM-DD)
- `endDate` (optional) - End date for analytics (YYYY-MM-DD)
- `platform` (optional) - Filter by specific platform

**Response (200):**
```json
{
  "totalPosts": 150,
  "publishedPosts": 142,
  "failedPosts": 8,
  "scheduledPosts": 25,
  "platformBreakdown": {
    "facebook": 75,
    "instagram": 50,
    "pinterest": 15,
    "x": 10
  },
  "successRate": 94.67,
  "averagePostsPerDay": 4.8,
  "topHashtags": [
    {"hashtag": "#content", "count": 45},
    {"hashtag": "#blog", "count": 32},
    {"hashtag": "#social", "count": 28}
  ],
  "postingTimes": {
    "mostActive": "15:00",
    "leastActive": "03:00"
  }
}
```

### Blogger Integration

#### POST /blogger/configure
Configure Blogger integration settings.

**Request Body:**
```json
{
  "blogUrl": "https://myblog.blogspot.com",
  "autoApprove": false,
  "postingDelay": 300,
  "defaultHashtags": ["#blog", "#mybrand"]
}
```

**Response (200):**
```json
{
  "success": true,
  "configuration": {
    "blogUrl": "https://myblog.blogspot.com",
    "autoApprove": false,
    "postingDelay": 300,
    "isActive": true
  }
}
```

#### POST /blogger/webhook
Webhook endpoint for receiving new blog post notifications.

**Request Body:**
```json
{
  "title": "My Amazing Blog Post",
  "content": "This is the content of my blog post...",
  "url": "https://myblog.blogspot.com/2024/01/amazing-post",
  "publishedAt": "2024-01-15T10:30:00Z",
  "author": "John Doe"
}
```

**Response (200):**
```json
{
  "generatedPosts": [
    {
      "id": "post-126",
      "content": "Check out my latest blog post: My Amazing Blog Post",
      "platforms": ["facebook", "instagram"],
      "status": "pending_review",
      "source": "blogger"
    }
  ]
}
```

### SoloBoss Integration

#### POST /soloboss/configure
Configure SoloBoss AI Content Planner integration.

**Request Body:**
```json
{
  "apiKey": "sb_1234567890abcdef",
  "autoApprove": true,
  "webhookUrl": "https://api.sma-platform.com/api/soloboss/webhook"
}
```

**Response (200):**
```json
{
  "success": true,
  "configuration": {
    "isConnected": true,
    "autoApprove": true,
    "webhookConfigured": true
  }
}
```

#### POST /soloboss/webhook
Webhook endpoint for receiving content from SoloBoss.

**Request Body:**
```json
{
  "title": "AI Generated Blog Post",
  "content": "This is AI-generated content from SoloBoss...",
  "seoSuggestions": ["keyword1", "keyword2", "keyword3"],
  "socialMediaText": "Check out this AI-generated content! #AI #Content",
  "images": ["https://example.com/ai-image1.jpg"]
}
```

**Response (200):**
```json
{
  "processedContent": {
    "posts": [
      {
        "id": "post-127",
        "content": "Check out this AI-generated content! #AI #Content",
        "platforms": ["facebook", "instagram", "x"],
        "status": "scheduled",
        "source": "soloboss",
        "scheduledTime": "2024-01-15T16:00:00Z"
      }
    ]
  }
}
```

### Settings

#### GET /settings
Get user's application settings.

**Response (200):**
```json
{
  "timezone": "America/New_York",
  "defaultHashtags": ["#mybrand", "#content"],
  "autoApproveFromSoloBoss": false,
  "bloggerIntegrationEnabled": true,
  "notificationSettings": {
    "emailNotifications": true,
    "failedPostAlerts": true,
    "weeklyReports": false
  },
  "platformPreferences": {
    "defaultPlatforms": ["facebook", "instagram"],
    "autoOptimizeImages": true,
    "shortenLinks": true
  }
}
```

#### PUT /settings
Update user's application settings.

**Request Body:**
```json
{
  "timezone": "America/Los_Angeles",
  "defaultHashtags": ["#mybrand", "#content", "#updated"],
  "notificationSettings": {
    "emailNotifications": true,
    "failedPostAlerts": true,
    "weeklyReports": true
  }
}
```

**Response (200):**
```json
{
  "timezone": "America/Los_Angeles",
  "defaultHashtags": ["#mybrand", "#content", "#updated"],
  "autoApproveFromSoloBoss": false,
  "bloggerIntegrationEnabled": true,
  "notificationSettings": {
    "emailNotifications": true,
    "failedPostAlerts": true,
    "weeklyReports": true
  },
  "updatedAt": "2024-01-15T11:30:00Z"
}
```

### System Health

#### GET /health
Check the health status of the API and its dependencies.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "scheduler": "healthy",
    "facebook_api": "healthy",
    "instagram_api": "healthy",
    "pinterest_api": "healthy",
    "x_api": "degraded"
  },
  "version": "1.0.0",
  "uptime": 86400
}
```

## SDKs and Libraries

### JavaScript/Node.js SDK

```javascript
const SMAClient = require('@sma/sdk');

const client = new SMAClient({
  baseUrl: 'http://localhost:3001/api',
  token: 'your-jwt-token'
});

// Create a post
const post = await client.posts.create({
  content: 'Hello from the SDK!',
  platforms: ['facebook', 'instagram'],
  hashtags: ['#sdk', '#automation']
});

// Get analytics
const analytics = await client.analytics.get({
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});
```

### Python SDK

```python
from sma_sdk import SMAClient

client = SMAClient(
    base_url='http://localhost:3001/api',
    token='your-jwt-token'
)

# Create a post
post = client.posts.create({
    'content': 'Hello from Python SDK!',
    'platforms': ['facebook', 'instagram'],
    'hashtags': ['#python', '#sdk']
})

# Get user's posts
posts = client.posts.list(page=1, limit=10, status='published')
```

## Webhooks

The platform supports webhooks for real-time notifications about post status changes and other events.

### Webhook Configuration

Configure webhooks in your user settings:

```json
{
  "webhooks": {
    "postPublished": "https://your-app.com/webhooks/post-published",
    "postFailed": "https://your-app.com/webhooks/post-failed",
    "platformConnected": "https://your-app.com/webhooks/platform-connected"
  }
}
```

### Webhook Payload Example

```json
{
  "event": "post.published",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "postId": "post-123",
    "userId": "user-456",
    "platforms": ["facebook", "instagram"],
    "results": [
      {
        "platform": "facebook",
        "success": true,
        "platformPostId": "fb_123456789"
      }
    ]
  }
}
```

## Best Practices

### Authentication
- Store JWT tokens securely
- Implement token refresh logic
- Use HTTPS in production
- Implement proper logout functionality

### Rate Limiting
- Implement exponential backoff for retries
- Monitor rate limit headers
- Cache responses when appropriate
- Use bulk endpoints for multiple operations

### Error Handling
- Always check response status codes
- Implement retry logic for retryable errors
- Log errors for debugging
- Provide user-friendly error messages

### Performance
- Use pagination for large datasets
- Implement client-side caching
- Compress request/response bodies
- Use appropriate HTTP methods

## Support

For API support and questions:
- **Documentation**: https://docs.sma-platform.com
- **Email**: api-support@sma-platform.com
- **GitHub Issues**: https://github.com/sma-platform/api/issues
- **Status Page**: https://status.sma-platform.com

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial API release
- Authentication endpoints
- Posts management
- OAuth platform connections
- Blogger integration
- SoloBoss integration
- Analytics endpoints
- Settings management
- Health check endpoint