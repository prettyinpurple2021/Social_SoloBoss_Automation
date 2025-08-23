# Social Media API Credentials Setup Guide

This guide will help you create and configure API credentials for all social media platforms integrated with your Automated SoloBoss Content Poster app, and then add them to Google Cloud Secret Manager.

## Supported Platforms

1. **Facebook** - OAuth for Facebook Pages
2. **Instagram** - OAuth for Instagram Business accounts  
3. **Pinterest** - OAuth for Pinterest boards
4. **X (Twitter)** - OAuth for X/Twitter posting
5. **SoloBoss** - API key integration

## Prerequisites

- Google Cloud Project with billing enabled
- Google Cloud CLI installed and authenticated
- Access to social media developer accounts

## Step 1: Create Social Media API Credentials

### Facebook & Instagram Setup

1. **Go to Facebook Developers**
   - Visit: https://developers.facebook.com/
   - Create a new app or use existing app
   - App Type: Business

2. **Configure Facebook App**
   - Add Facebook Login product
   - Add Instagram Basic Display product
   - Add Pages API product

3. **Get Credentials**
   - App ID (Client ID)
   - App Secret (Client Secret)
   - Add OAuth redirect URI: `https://your-domain.com/api/oauth/facebook/callback`

4. **Configure Instagram**
   - Connect Instagram Business account
   - Get Instagram App ID and Secret (same as Facebook app)

### Pinterest Setup

1. **Go to Pinterest Developers**
   - Visit: https://developers.pinterest.com/
   - Create a new app

2. **Configure Pinterest App**
   - App Type: Web application
   - Add required scopes: `boards:read`, `pins:read`, `pins:write`

3. **Get Credentials**
   - App ID (Client ID)
   - App Secret (Client Secret)
   - Add OAuth redirect URI: `https://your-domain.com/api/oauth/pinterest/callback`

### X (Twitter) Setup

1. **Go to Twitter Developer Portal**
   - Visit: https://developer.twitter.com/
   - Create a new app

2. **Configure Twitter App**
   - App Type: Web App
   - Enable OAuth 2.0
   - Add required scopes: `tweet.read`, `tweet.write`, `users.read`

3. **Get Credentials**
   - API Key (Client ID)
   - API Secret (Client Secret)
   - Add OAuth redirect URI: `https://your-domain.com/api/oauth/x/callback`

### SoloBoss Setup

1. **Contact SoloBoss Support**
   - Request API access
   - Get API key and webhook secret

## Step 2: Google Cloud Secret Manager Setup

### Enable Secret Manager API

```bash
gcloud services enable secretmanager.googleapis.com
```

### Create Secrets

Run the following commands to create secrets in Google Cloud Secret Manager:

```bash
# Facebook OAuth Credentials
echo "YOUR_FACEBOOK_CLIENT_ID" | gcloud secrets create facebook-client-id --data-file=-
echo "YOUR_FACEBOOK_CLIENT_SECRET" | gcloud secrets create facebook-client-secret --data-file=-

# Instagram OAuth Credentials  
echo "YOUR_INSTAGRAM_CLIENT_ID" | gcloud secrets create instagram-client-id --data-file=-
echo "YOUR_INSTAGRAM_CLIENT_SECRET" | gcloud secrets create instagram-client-secret --data-file=-

# Pinterest OAuth Credentials
echo "YOUR_PINTEREST_CLIENT_ID" | gcloud secrets create pinterest-client-id --data-file=-
echo "YOUR_PINTEREST_CLIENT_SECRET" | gcloud secrets create pinterest-client-secret --data-file=-

# X (Twitter) OAuth Credentials
echo "YOUR_X_CLIENT_ID" | gcloud secrets create x-client-id --data-file=-
echo "YOUR_X_CLIENT_SECRET" | gcloud secrets create x-client-secret --data-file=-

# SoloBoss API Credentials
echo "YOUR_SOLOBOSS_API_KEY" | gcloud secrets create soloboss-api-key --data-file=-
echo "YOUR_SOLOBOSS_WEBHOOK_SECRET" | gcloud secrets create soloboss-webhook-secret --data-file=-

# OAuth Redirect URIs
echo "https://your-domain.com/api/oauth/facebook/callback" | gcloud secrets create facebook-redirect-uri --data-file=-
echo "https://your-domain.com/api/oauth/instagram/callback" | gcloud secrets create instagram-redirect-uri --data-file=-
echo "https://your-domain.com/api/oauth/pinterest/callback" | gcloud secrets create pinterest-redirect-uri --data-file=-
echo "https://your-domain.com/api/oauth/x/callback" | gcloud secrets create x-redirect-uri --data-file=-
```

### Grant Access to Your Application

```bash
# Get your service account email (if using service account)
gcloud iam service-accounts list

# Grant Secret Manager Secret Accessor role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## Step 3: Environment Configuration

### Update Environment Variables

Add these environment variables to your deployment configuration:

```bash
# Facebook OAuth
FACEBOOK_CLIENT_ID=projects/YOUR_PROJECT_ID/secrets/facebook-client-id/versions/latest
FACEBOOK_CLIENT_SECRET=projects/YOUR_PROJECT_ID/secrets/facebook-client-secret/versions/latest
FACEBOOK_REDIRECT_URI=projects/YOUR_PROJECT_ID/secrets/facebook-redirect-uri/versions/latest

# Instagram OAuth
INSTAGRAM_CLIENT_ID=projects/YOUR_PROJECT_ID/secrets/instagram-client-id/versions/latest
INSTAGRAM_CLIENT_SECRET=projects/YOUR_PROJECT_ID/secrets/instagram-client-secret/versions/latest
INSTAGRAM_REDIRECT_URI=projects/YOUR_PROJECT_ID/secrets/instagram-redirect-uri/versions/latest

# Pinterest OAuth
PINTEREST_CLIENT_ID=projects/YOUR_PROJECT_ID/secrets/pinterest-client-id/versions/latest
PINTEREST_CLIENT_SECRET=projects/YOUR_PROJECT_ID/secrets/pinterest-client-secret/versions/latest
PINTEREST_REDIRECT_URI=projects/YOUR_PROJECT_ID/secrets/pinterest-redirect-uri/versions/latest

# X (Twitter) OAuth
X_CLIENT_ID=projects/YOUR_PROJECT_ID/secrets/x-client-id/versions/latest
X_CLIENT_SECRET=projects/YOUR_PROJECT_ID/secrets/x-client-secret/versions/latest
X_REDIRECT_URI=projects/YOUR_PROJECT_ID/secrets/x-redirect-uri/versions/latest

# SoloBoss API
SOLOBOSS_API_KEY=projects/YOUR_PROJECT_ID/secrets/soloboss-api-key/versions/latest
SOLOBOSS_WEBHOOK_SECRET=projects/YOUR_PROJECT_ID/secrets/soloboss-webhook-secret/versions/latest
```

## Step 4: Update Application Code

### Update OAuth Service

The application already has the OAuth service configured to read from environment variables. Make sure your deployment uses the Secret Manager references.

### Update SoloBoss Service

The SoloBoss service is already configured to handle API keys securely.

## Step 5: Testing

### Test OAuth Flows

1. Test Facebook OAuth flow
2. Test Instagram OAuth flow  
3. Test Pinterest OAuth flow
4. Test X OAuth flow

### Test SoloBoss Integration

1. Test API key authentication
2. Test webhook signature verification

## Security Best Practices

1. **Never commit secrets to version control**
2. **Use least privilege access for service accounts**
3. **Rotate secrets regularly**
4. **Monitor secret access logs**
5. **Use separate secrets for different environments**

## Troubleshooting

### Common Issues

1. **OAuth redirect URI mismatch**
   - Ensure redirect URIs match exactly in both app settings and secrets

2. **Invalid API credentials**
   - Verify credentials are correctly stored in Secret Manager
   - Check for extra spaces or characters

3. **Permission denied errors**
   - Verify service account has Secret Manager access
   - Check IAM permissions

### Debug Commands

```bash
# List all secrets
gcloud secrets list

# View secret metadata
gcloud secrets describe SECRET_NAME

# Access secret value (for debugging only)
gcloud secrets versions access latest --secret=SECRET_NAME
```

## Next Steps

1. Deploy your application with the updated configuration
2. Test all OAuth flows
3. Monitor application logs for any credential-related errors
4. Set up automated secret rotation if needed

## Support

For platform-specific issues:
- Facebook: https://developers.facebook.com/support/
- Instagram: https://developers.facebook.com/support/
- Pinterest: https://developers.pinterest.com/support/
- X: https://developer.twitter.com/en/support
- SoloBoss: Contact SoloBoss support team
