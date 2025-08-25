# Social Media Automation Platform SDKs

Official SDKs for integrating with the Social Media Automation Platform API. These SDKs provide type-safe, developer-friendly interfaces with built-in error handling, retry logic, and comprehensive documentation.

## Available SDKs

### TypeScript/JavaScript SDK

**Installation:**
```bash
npm install @sma/sdk
# or
yarn add @sma/sdk
```

**Quick Start:**
```typescript
import { SocialMediaAutomationSDK } from '@sma/sdk';

const client = new SocialMediaAutomationSDK({
  baseURL: 'https://api.sma-platform.com/api',
  debug: true
});

// Login
const { user, tokens } = await client.login('user@example.com', 'password');
console.log(`Welcome, ${user.name}!`);

// Create a post
const post = await client.createPost({
  content: 'Hello from TypeScript SDK!',
  platforms: ['facebook', 'instagram'],
  hashtags: ['#typescript', '#sdk'],
  scheduledTime: '2024-02-01T15:30:00Z'
});

console.log(`Created post: ${post.id}`);
```

### Python SDK

**Installation:**
```bash
pip install sma-sdk
```

**Quick Start:**
```python
from sma_sdk import SocialMediaAutomationSDK, SMAConfig

# Initialize client
config = SMAConfig(
    base_url="https://api.sma-platform.com/api",
    debug=True
)
client = SocialMediaAutomationSDK(config)

# Login
result = client.login("user@example.com", "password")
user = result["user"]
print(f"Welcome, {user.name}!")

# Create a post
post = client.create_post({
    "content": "Hello from Python SDK!",
    "platforms": ["facebook", "instagram"],
    "hashtags": ["#python", "#sdk"],
    "scheduled_time": "2024-02-01T15:30:00Z"
})

print(f"Created post: {post.id}")
```

## Features

### 🔐 Authentication
- JWT token management with automatic refresh
- API key authentication support
- Secure token storage and handling

### 🔄 Retry Logic
- Automatic retry for transient failures
- Exponential backoff strategy
- Configurable retry attempts and delays

### 📊 Comprehensive Error Handling
- Detailed error information with error codes
- Retryable error detection
- Developer-friendly error messages with guidance

### 🎯 Type Safety
- Full TypeScript support with comprehensive type definitions
- Python type hints for better IDE support
- Runtime validation for critical operations

### 📈 Built-in Analytics
- Request/response tracking
- Performance monitoring
- Usage analytics

### 🛠️ Developer Experience
- Extensive documentation with examples
- Debug mode for development
- Request/response logging
- Correlation IDs for tracing

## SDK Configuration

### TypeScript/JavaScript

```typescript
interface SMAConfig {
  baseURL?: string;           // API base URL
  apiKey?: string;           // API key for authentication
  timeout?: number;          // Request timeout in milliseconds
  retryAttempts?: number;    // Number of retry attempts
  retryDelay?: number;       // Base delay between retries
  debug?: boolean;           // Enable debug logging
}

const client = new SocialMediaAutomationSDK({
  baseURL: 'https://api.sma-platform.com/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  debug: process.env.NODE_ENV === 'development'
});
```

### Python

```python
from sma_sdk import SMAConfig, SocialMediaAutomationSDK

config = SMAConfig(
    base_url="https://api.sma-platform.com/api",
    timeout=30,
    retry_attempts=3,
    retry_delay=1.0,
    debug=True
)

client = SocialMediaAutomationSDK(config)
```

## Error Handling

Both SDKs provide comprehensive error handling with detailed error information:

### TypeScript/JavaScript

```typescript
import { SMAError } from '@sma/sdk';

try {
  const post = await client.createPost(postData);
} catch (error) {
  if (error instanceof SMAError) {
    console.error(`Error ${error.code}: ${error.message}`);
    
    if (error.retryable) {
      console.log(`Retryable error, retry after ${error.retryAfter} seconds`);
    }
    
    if (error.details) {
      console.log('Error details:', error.details);
    }
  }
}
```

### Python

```python
from sma_sdk import SMAError

try:
    post = client.create_post(post_data)
except SMAError as error:
    print(f"Error {error.code}: {error.message}")
    
    if error.retryable:
        print(f"Retryable error, retry after {error.retry_after} seconds")
    
    if error.details:
        print(f"Error details: {error.details}")
```

## Advanced Usage

### Bulk Operations

```typescript
// TypeScript
const posts = [
  { content: 'Post 1', platforms: ['facebook'] },
  { content: 'Post 2', platforms: ['instagram'] },
  { content: 'Post 3', platforms: ['facebook', 'instagram'] }
];

const result = await client.createBulkPosts(posts);
console.log(`Created ${result.scheduledPosts.length} posts`);
```

```python
# Python
posts = [
    {"content": "Post 1", "platforms": ["facebook"]},
    {"content": "Post 2", "platforms": ["instagram"]},
    {"content": "Post 3", "platforms": ["facebook", "instagram"]}
]

result = client.create_bulk_posts(posts)
print(f"Created {len(result['scheduledPosts'])} posts")
```

### Analytics

```typescript
// TypeScript
const analytics = await client.getAnalytics({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  platform: 'facebook'
});

console.log(`Success rate: ${analytics.successRate}%`);
```

```python
# Python
analytics = client.get_analytics(
    start_date="2024-01-01",
    end_date="2024-01-31",
    platform="facebook"
)

print(f"Success rate: {analytics.success_rate}%")
```

### Platform Connections

```typescript
// TypeScript
// Connect to Facebook
const connection = await client.connectPlatform(
  'facebook',
  'auth_code_from_oauth',
  'http://localhost:3000/oauth/callback'
);

console.log(`Connected to ${connection.platform} as ${connection.platformUsername}`);
```

```python
# Python
# Connect to Facebook
connection = client.connect_platform(
    "facebook",
    "auth_code_from_oauth",
    "http://localhost:3000/oauth/callback"
)

print(f"Connected to {connection.platform} as {connection.platform_username}")
```

## Testing and Development

### Sandbox Environment

Both SDKs support connecting to sandbox environments for testing:

```typescript
// TypeScript
const client = new SocialMediaAutomationSDK({
  baseURL: 'https://sandbox-api.sma-platform.com/api',
  debug: true
});
```

```python
# Python
config = SMAConfig(
    base_url="https://sandbox-api.sma-platform.com/api",
    debug=True
)
client = SocialMediaAutomationSDK(config)
```

### Health Checks

```typescript
// TypeScript
const health = await client.checkHealth();
console.log(`API Status: ${health.status}`);
```

```python
# Python
health = client.check_health()
print(f"API Status: {health['status']}")
```

## Support and Documentation

- **API Documentation**: [https://docs.sma-platform.com](https://docs.sma-platform.com)
- **Interactive API Docs**: [https://api.sma-platform.com/api-docs](https://api.sma-platform.com/api-docs)
- **SDK Examples**: [https://github.com/sma-platform/sdk-examples](https://github.com/sma-platform/sdk-examples)
- **Support**: [support@sma-platform.com](mailto:support@sma-platform.com)

## Contributing

We welcome contributions to improve the SDKs! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.