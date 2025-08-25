# Getting Started with Social Media Automation Platform API

Welcome! This guide will help you get started with the Social Media Automation Platform API, even if you're completely new to APIs and programming.

## What is an API?

An **API (Application Programming Interface)** is like a waiter in a restaurant:
- You (your app) tell the waiter (API) what you want
- The waiter takes your request to the kitchen (our servers)
- The kitchen prepares your order and gives it back to the waiter
- The waiter brings your order back to you

In our case, you can ask our API to:
- Create social media posts
- Schedule posts for later
- Get analytics about your posts
- Connect to different social media platforms

## Before You Start

You'll need:
1. **A computer** with internet access
2. **A text editor** (like Notepad, VS Code, or any code editor)
3. **A way to make HTTP requests** (we'll show you several options)

Don't worry if you don't know what HTTP requests are - we'll explain everything!

## Step 1: Understanding the Basics

### What is HTTP?
HTTP is how computers talk to each other over the internet. Think of it like sending letters:
- **GET**: "Please give me some information"
- **POST**: "Please save this new information"
- **PUT**: "Please update this existing information"
- **DELETE**: "Please remove this information"

### What is JSON?
JSON is a way to format data that both humans and computers can read easily:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30
}
```

## Step 2: Get Your API Access

### Option 1: Create an Account (Recommended for Beginners)
1. Go to our website and create an account
2. Log in to get your authentication token
3. Use this token in all your API requests

### Option 2: Use Our Sandbox (Perfect for Testing)
Our sandbox is a safe testing environment where you can try everything without affecting real data:

**Test Login Credentials:**
- Email: `developer@example.com`
- Password: `sandbox123`

## Step 3: Make Your First API Call

Let's start with the simplest possible example. We'll show you multiple ways to do this:

### Method 1: Using a Web Browser (Easiest)

For simple GET requests, you can just type URLs in your browser:

```
http://localhost:3001/api/health
```

This will show you if our API is working.

### Method 2: Using Our Interactive Documentation

1. Open your web browser
2. Go to: `http://localhost:3001/docs`
3. Click on "Interactive API Docs"
4. Try the examples right in your browser!

### Method 3: Using curl (Command Line)

If you're comfortable with command line:

```bash
# Check if the API is working
curl http://localhost:3001/api/health

# Login to get a token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "developer@example.com", "password": "sandbox123"}'
```

### Method 4: Using Our SDKs (Recommended)

We provide easy-to-use libraries for popular programming languages:

#### JavaScript/TypeScript
```bash
npm install @sma/sdk
```

```javascript
const { SocialMediaAutomationSDK } = require('@sma/sdk');

const client = new SocialMediaAutomationSDK({
  baseURL: 'http://localhost:3001/api',
  debug: true
});

// Login
client.login('developer@example.com', 'sandbox123')
  .then(result => {
    console.log('Logged in as:', result.user.name);
  })
  .catch(error => {
    console.error('Login failed:', error.message);
  });
```

#### Python
```bash
pip install sma-sdk
```

```python
from sma_sdk import SocialMediaAutomationSDK, SMAConfig

config = SMAConfig(
    base_url="http://localhost:3001/api",
    debug=True
)
client = SocialMediaAutomationSDK(config)

try:
    result = client.login("developer@example.com", "sandbox123")
    print(f"Logged in as: {result['user'].name}")
except Exception as error:
    print(f"Login failed: {error}")
```

## Step 4: Create Your First Post

Once you're logged in, let's create a social media post:

### Using JavaScript SDK:
```javascript
// After logging in...
client.createPost({
  content: 'My first API post! 🎉',
  platforms: ['facebook', 'instagram'],
  hashtags: ['#api', '#first', '#test']
})
.then(post => {
  console.log('Created post:', post.id);
})
.catch(error => {
  console.error('Failed to create post:', error.message);
});
```

### Using Python SDK:
```python
# After logging in...
post = client.create_post({
    "content": "My first API post! 🎉",
    "platforms": ["facebook", "instagram"],
    "hashtags": ["#api", "#first", "#test"]
})
print(f"Created post: {post.id}")
```

### Using curl:
```bash
curl -X POST http://localhost:3001/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My first API post! 🎉",
    "platforms": ["facebook", "instagram"],
    "hashtags": ["#api", "#first", "#test"]
  }'
```

## Step 5: Understanding Responses

When you make an API request, you'll get a response that looks like this:

### Successful Response:
```json
{
  "success": true,
  "data": {
    "id": "post-123",
    "content": "My first API post! 🎉",
    "status": "draft",
    "createdAt": "2024-01-21T10:00:00Z"
  },
  "meta": {
    "requestId": "req_123456",
    "timestamp": "2024-01-21T10:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Content is required",
    "field": "content",
    "retryable": false,
    "documentation": "http://localhost:3001/docs/validation"
  }
}
```

## Step 6: Common Tasks

### Get Your Posts
```javascript
// JavaScript
const posts = await client.getPosts();
console.log('You have', posts.data.length, 'posts');
```

```python
# Python
posts = client.get_posts()
print(f"You have {len(posts['data'])} posts")
```

### Schedule a Post for Later
```javascript
// JavaScript
const scheduledPost = await client.createPost({
  content: 'This will post tomorrow!',
  platforms: ['facebook'],
  scheduledTime: '2024-02-01T15:30:00Z'
});
```

### Get Analytics
```javascript
// JavaScript
const analytics = await client.getAnalytics();
console.log('Success rate:', analytics.successRate + '%');
```

## Step 7: Error Handling

Things don't always go perfectly, so here's how to handle errors:

### JavaScript:
```javascript
try {
  const post = await client.createPost({
    content: 'Test post',
    platforms: ['facebook']
  });
  console.log('Success!', post.id);
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log('Slow down! Try again in', error.retryAfter, 'seconds');
  } else {
    console.error('Error:', error.message);
  }
}
```

### Python:
```python
from sma_sdk import SMAError

try:
    post = client.create_post({
        "content": "Test post",
        "platforms": ["facebook"]
    })
    print(f"Success! {post.id}")
except SMAError as error:
    if error.code == "RATE_LIMIT_EXCEEDED":
        print(f"Slow down! Try again in {error.retry_after} seconds")
    else:
        print(f"Error: {error.message}")
```

## Step 8: Testing and Development

### Use the Sandbox
Always test your code in our sandbox environment first:
- Base URL: `http://localhost:3001/sandbox`
- No rate limits
- Safe test data
- Realistic responses

### Check API Status
Before making requests, check if our API is working:
```
GET http://localhost:3001/api/health
```

### Use Debug Mode
Enable debug mode in SDKs to see what's happening:
```javascript
const client = new SocialMediaAutomationSDK({
  debug: true  // This will show you all requests and responses
});
```

## Common Mistakes to Avoid

1. **Forgetting Authentication**: Most endpoints need a token
2. **Wrong Content-Type**: Use `application/json` for JSON data
3. **Not Handling Errors**: Always check for and handle errors
4. **Ignoring Rate Limits**: Don't make too many requests too quickly
5. **Using Production for Testing**: Always test in sandbox first

## Getting Help

### Documentation
- **Interactive Docs**: `http://localhost:3001/api-docs`
- **API Playground**: `http://localhost:3001/api-docs/playground`
- **Examples**: `http://localhost:3001/docs/examples`

### Support
- **Email**: support@sma-platform.com
- **Documentation**: All error messages include links to relevant docs
- **Status Page**: Check `http://localhost:3001/api/health` for system status

### Community
- **GitHub**: Find code examples and report issues
- **Discord**: Chat with other developers
- **Stack Overflow**: Tag your questions with `sma-platform`

## Next Steps

Once you're comfortable with the basics:

1. **Explore Advanced Features**:
   - Bulk operations
   - Platform-specific content
   - Webhook notifications
   - Advanced analytics

2. **Build Something Cool**:
   - Automated posting schedule
   - Content management dashboard
   - Analytics reporting tool
   - Social media bot

3. **Optimize Your Code**:
   - Implement proper error handling
   - Add retry logic
   - Cache responses when appropriate
   - Monitor your usage

## Quick Reference

### Authentication
```bash
POST /api/auth/login
{
  "email": "your@email.com",
  "password": "your-password"
}
```

### Create Post
```bash
POST /api/posts
Authorization: Bearer YOUR_TOKEN
{
  "content": "Your post content",
  "platforms": ["facebook", "instagram"],
  "hashtags": ["#tag1", "#tag2"]
}
```

### Get Posts
```bash
GET /api/posts?page=1&limit=20
Authorization: Bearer YOUR_TOKEN
```

### Get Analytics
```bash
GET /api/posts/analytics
Authorization: Bearer YOUR_TOKEN
```

## Conclusion

You now have everything you need to start using our API! Remember:

- Start with the sandbox
- Use our SDKs for easier development
- Read error messages carefully
- Check our documentation when stuck
- Don't hesitate to ask for help

Happy coding! 🚀