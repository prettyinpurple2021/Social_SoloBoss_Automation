# Troubleshooting Guide

This guide helps you solve common problems when using the Social Media Automation Platform API.

## Quick Fixes

### "I can't connect to the API"

**Problem**: Getting connection errors or timeouts

**Solutions**:
1. **Check the API URL**:
   - Development: `http://localhost:3001/api`
   - Sandbox: `http://localhost:3001/sandbox`
   - Production: `https://api.sma-platform.com/api`

2. **Check API Status**:
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Check Your Internet Connection**:
   - Try opening a website in your browser
   - Make sure you're not behind a firewall

### "Authentication Failed"

**Problem**: Getting 401 Unauthorized errors

**Solutions**:
1. **Check Your Credentials**:
   ```bash
   # Test login
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "your@email.com", "password": "your-password"}'
   ```

2. **Use Sandbox Credentials for Testing**:
   - Email: `developer@example.com`
   - Password: `sandbox123`

3. **Check Token Format**:
   ```bash
   # Correct format
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   # Wrong format (missing "Bearer ")
   Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Token Might Be Expired**:
   - Tokens expire after 15 minutes
   - Login again to get a new token

### "Validation Error"

**Problem**: Getting 400 Bad Request with validation errors

**Solutions**:
1. **Check Required Fields**:
   ```json
   {
     "content": "Required - cannot be empty",
     "platforms": ["Required - must have at least one platform"]
   }
   ```

2. **Check Data Types**:
   ```json
   {
     "scheduledTime": "2024-02-01T15:30:00Z",  // Correct: ISO string
     "scheduledTime": "tomorrow at 3pm"        // Wrong: not ISO format
   }
   ```

3. **Check Platform Names**:
   ```json
   {
     "platforms": ["facebook", "instagram", "pinterest", "x"]  // Correct
     "platforms": ["Facebook", "Twitter"]                      // Wrong: case sensitive
   }
   ```

### "Rate Limited"

**Problem**: Getting 429 Too Many Requests

**Solutions**:
1. **Slow Down Your Requests**:
   ```javascript
   // Add delays between requests
   await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
   ```

2. **Check Rate Limit Headers**:
   ```
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 2024-01-21T10:01:00Z
   Retry-After: 60
   ```

3. **Use Bulk Operations**:
   ```javascript
   // Instead of multiple single requests
   for (const post of posts) {
     await client.createPost(post);
   }
   
   // Use bulk operation
   await client.createBulkPosts(posts);
   ```

## Common Error Codes

### INVALID_TOKEN
**What it means**: Your authentication token is wrong or missing

**How to fix**:
1. Make sure you're including the Authorization header
2. Check that the token starts with "Bearer "
3. Login again to get a fresh token

### VALIDATION_ERROR
**What it means**: The data you sent doesn't meet our requirements

**How to fix**:
1. Check the error details for specific field issues
2. Make sure all required fields are included
3. Verify data formats (dates, emails, etc.)

### RESOURCE_NOT_FOUND
**What it means**: The thing you're looking for doesn't exist

**How to fix**:
1. Check the ID you're using
2. Make sure the resource belongs to your account
3. Verify you're using the correct endpoint

### PLATFORM_API_ERROR
**What it means**: There's a problem with the social media platform

**How to fix**:
1. Check if the platform is having issues
2. Verify your platform connection is still active
3. Try again later - it might be temporary

## SDK-Specific Issues

### JavaScript/TypeScript SDK

**Problem**: "Cannot find module '@sma/sdk'"
```bash
# Solution: Install the SDK
npm install @sma/sdk
```

**Problem**: "SMAError is not defined"
```javascript
// Solution: Import the error class
import { SocialMediaAutomationSDK, SMAError } from '@sma/sdk';
```

**Problem**: Promises not working
```javascript
// Wrong: Not handling async properly
const result = client.login(email, password);
console.log(result); // This will be a Promise, not the actual result

// Right: Use await or .then()
const result = await client.login(email, password);
console.log(result); // This will be the actual result
```

### Python SDK

**Problem**: "ModuleNotFoundError: No module named 'sma_sdk'"
```bash
# Solution: Install the SDK
pip install sma-sdk
```

**Problem**: "SMAError is not defined"
```python
# Solution: Import the error class
from sma_sdk import SocialMediaAutomationSDK, SMAError
```

**Problem**: Dictionary access errors
```python
# Wrong: Treating response as object
user = result.user.name

# Right: Treating response as dictionary
user = result["user"].name
```

## Network Issues

### Timeout Errors
**Solutions**:
1. **Increase Timeout**:
   ```javascript
   const client = new SocialMediaAutomationSDK({
     timeout: 60000  // 60 seconds instead of default 30
   });
   ```

2. **Check Your Network**:
   - Try a different network
   - Disable VPN if using one
   - Check firewall settings

### SSL/HTTPS Issues
**Solutions**:
1. **For Development** (not recommended for production):
   ```javascript
   process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
   ```

2. **Update Your System**:
   - Update your operating system
   - Update Node.js/Python
   - Update certificates

## Data Issues

### Date/Time Problems
**Common Issues**:
```javascript
// Wrong formats
"scheduledTime": "2024-01-21 15:30:00"     // Missing timezone
"scheduledTime": "Jan 21, 2024 3:30 PM"   // Not ISO format
"scheduledTime": "2024-01-21T15:30:00"     // Missing timezone

// Correct format
"scheduledTime": "2024-01-21T15:30:00Z"    // ISO format with UTC timezone
```

### Content Issues
**Common Problems**:
1. **Empty Content**: Content cannot be empty
2. **Too Long**: Check platform limits (e.g., Twitter has character limits)
3. **Invalid Characters**: Some platforms don't allow certain characters

### Platform Issues
**Common Problems**:
1. **Wrong Platform Names**: Use lowercase: "facebook", not "Facebook"
2. **Unsupported Platforms**: We only support: facebook, instagram, pinterest, x
3. **Platform Not Connected**: Connect to platforms first via OAuth

## Debugging Tips

### Enable Debug Mode
```javascript
// JavaScript
const client = new SocialMediaAutomationSDK({
  debug: true
});
```

```python
# Python
config = SMAConfig(debug=True)
client = SocialMediaAutomationSDK(config)
```

### Check Request/Response
```bash
# Use curl with verbose output
curl -v -X POST http://localhost:3001/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "platforms": ["facebook"]}'
```

### Use Browser Developer Tools
1. Open browser developer tools (F12)
2. Go to Network tab
3. Make API requests
4. Check request/response details

### Check Logs
Look for error messages in:
- Browser console (F12)
- Terminal/command prompt
- Application logs

## Getting More Help

### Check Our Status
- API Health: `http://localhost:3001/api/health`
- System Status: `http://localhost:3001/api-docs/status`

### Use Our Tools
- **API Playground**: `http://localhost:3001/api-docs/playground`
- **Interactive Docs**: `http://localhost:3001/api-docs`
- **Sandbox**: `http://localhost:3001/sandbox`

### Contact Support
- **Email**: support@sma-platform.com
- **Include**:
  - What you were trying to do
  - The exact error message
  - Your request details (without sensitive data)
  - Steps to reproduce the problem

### Community Resources
- **GitHub Issues**: Report bugs and get help
- **Stack Overflow**: Tag questions with `sma-platform`
- **Documentation**: Every error includes a link to relevant docs

## Prevention Tips

### Best Practices
1. **Always Handle Errors**:
   ```javascript
   try {
     const result = await client.createPost(postData);
   } catch (error) {
     console.error('Error:', error.message);
     // Handle the error appropriately
   }
   ```

2. **Use Sandbox for Testing**:
   - Test all your code in sandbox first
   - Sandbox has no rate limits
   - Safe to experiment

3. **Implement Retry Logic**:
   ```javascript
   async function createPostWithRetry(postData, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await client.createPost(postData);
       } catch (error) {
         if (error.retryable && i < maxRetries - 1) {
           await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
           continue;
         }
         throw error;
       }
     }
   }
   ```

4. **Monitor Rate Limits**:
   ```javascript
   // Check rate limit headers in responses
   const response = await fetch('/api/posts', options);
   const remaining = response.headers.get('X-RateLimit-Remaining');
   if (remaining < 10) {
     console.warn('Rate limit getting low:', remaining);
   }
   ```

5. **Keep Tokens Secure**:
   - Never commit tokens to version control
   - Use environment variables
   - Rotate tokens regularly

Remember: Most problems have simple solutions. Check the basics first (authentication, network, data format) before diving into complex debugging!