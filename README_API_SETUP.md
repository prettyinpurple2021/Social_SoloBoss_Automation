# Social Media API Credentials Setup

This guide provides everything you need to set up and configure social media API credentials for your Automated SoloBoss Content Poster app and store them securely in Google Cloud Secret Manager.

## 📁 Files Created

- **`SOCIAL_MEDIA_API_SETUP.md`** - Comprehensive setup guide
- **`API_CREDENTIALS_QUICK_REFERENCE.md`** - Quick reference card
- **`setup-secrets.ps1`** - PowerShell setup script (Windows)
- **`setup-secrets.sh`** - Bash setup script (Linux/macOS)
- **`validate-secrets.ps1`** - PowerShell validation script (Windows)
- **`validate-secrets.sh`** - Bash validation script (Linux/macOS)

## 🚀 Quick Start

### 1. Prerequisites

- Google Cloud Project with billing enabled
- Google Cloud CLI installed and authenticated
- Access to social media developer accounts

### 2. Run Setup Script

**Windows (PowerShell):**
```powershell
.\setup-secrets.ps1 -ProjectId "your-project-id" -Domain "your-domain.com"
```

**Linux/macOS (Bash):**
```bash
./setup-secrets.sh your-project-id your-domain.com
```

### 3. Validate Setup

**Windows (PowerShell):**
```powershell
.\validate-secrets.ps1 -ProjectId "your-project-id"
```

**Linux/macOS (Bash):**
```bash
./validate-secrets.sh your-project-id
```

## 🔐 Supported Platforms

Your app integrates with these social media platforms:

| Platform | Type | Required Credentials |
|----------|------|---------------------|
| **Facebook** | OAuth | App ID, App Secret |
| **Instagram** | OAuth | App ID, App Secret |
| **Pinterest** | OAuth | App ID, App Secret |
| **X (Twitter)** | OAuth | API Key, API Secret |
| **SoloBoss** | API Key | API Key, Webhook Secret |

## 📋 Required Credentials

### Facebook & Instagram
- **App ID (Client ID)**: From Facebook Developers Console
- **App Secret (Client Secret)**: From Facebook Developers Console
- **Redirect URI**: `https://your-domain.com/api/oauth/facebook/callback`

### Pinterest
- **App ID (Client ID)**: From Pinterest Developers Console
- **App Secret (Client Secret)**: From Pinterest Developers Console
- **Redirect URI**: `https://your-domain.com/api/oauth/pinterest/callback`

### X (Twitter)
- **API Key (Client ID)**: From Twitter Developer Portal
- **API Secret (Client Secret)**: From Twitter Developer Portal
- **Redirect URI**: `https://your-domain.com/api/oauth/x/callback`

### SoloBoss
- **API Key**: From SoloBoss support team
- **Webhook Secret**: From SoloBoss support team

## 🔗 Developer Portal Links

| Platform | Developer Portal | Documentation |
|----------|------------------|---------------|
| Facebook | https://developers.facebook.com/ | https://developers.facebook.com/docs/ |
| Instagram | https://developers.facebook.com/ | https://developers.facebook.com/docs/instagram-api/ |
| Pinterest | https://developers.pinterest.com/ | https://developers.pinterest.com/docs/ |
| X (Twitter) | https://developer.twitter.com/ | https://developer.twitter.com/en/docs |
| SoloBoss | Contact support | Contact support |

## 🔧 Environment Variables

After setup, your application will use these environment variables:

```bash
# Facebook OAuth
FACEBOOK_CLIENT_ID=projects/PROJECT_ID/secrets/facebook-client-id/versions/latest
FACEBOOK_CLIENT_SECRET=projects/PROJECT_ID/secrets/facebook-client-secret/versions/latest
FACEBOOK_REDIRECT_URI=projects/PROJECT_ID/secrets/facebook-redirect-uri/versions/latest

# Instagram OAuth
INSTAGRAM_CLIENT_ID=projects/PROJECT_ID/secrets/instagram-client-id/versions/latest
INSTAGRAM_CLIENT_SECRET=projects/PROJECT_ID/secrets/instagram-client-secret/versions/latest
INSTAGRAM_REDIRECT_URI=projects/PROJECT_ID/secrets/instagram-redirect-uri/versions/latest

# Pinterest OAuth
PINTEREST_CLIENT_ID=projects/PROJECT_ID/secrets/pinterest-client-id/versions/latest
PINTEREST_CLIENT_SECRET=projects/PROJECT_ID/secrets/pinterest-client-secret/versions/latest
PINTEREST_REDIRECT_URI=projects/PROJECT_ID/secrets/pinterest-redirect-uri/versions/latest

# X (Twitter) OAuth
X_CLIENT_ID=projects/PROJECT_ID/secrets/x-client-id/versions/latest
X_CLIENT_SECRET=projects/PROJECT_ID/secrets/x-client-secret/versions/latest
X_REDIRECT_URI=projects/PROJECT_ID/secrets/x-redirect-uri/versions/latest

# SoloBoss API
SOLOBOSS_API_KEY=projects/PROJECT_ID/secrets/soloboss-api-key/versions/latest
SOLOBOSS_WEBHOOK_SECRET=projects/PROJECT_ID/secrets/soloboss-webhook-secret/versions/latest
```

## 🚨 Common Issues & Solutions

### OAuth Redirect URI Mismatch
- **Problem**: "redirect_uri_mismatch" error
- **Solution**: Ensure redirect URI in developer portal exactly matches your secret

### Invalid API Credentials
- **Problem**: "invalid_client" or "unauthorized" errors
- **Solution**: Verify credentials are correctly stored in Secret Manager

### Permission Denied
- **Problem**: "permission_denied" when accessing secrets
- **Solution**: Grant Secret Manager access to your service account

### Missing Scopes
- **Problem**: "insufficient_scope" errors
- **Solution**: Ensure required scopes are added to your OAuth app

## 🔄 Secret Rotation

To rotate secrets:

1. Create new version in Secret Manager
2. Update your application to use the new version
3. Test the integration
4. Delete old version (optional)

```bash
# Create new version
echo "new-secret-value" | gcloud secrets versions add secret-name --data-file=-

# Access specific version
gcloud secrets versions access VERSION_NUMBER --secret=secret-name
```

## 📊 Monitoring

Monitor your secrets and OAuth flows:

```bash
# List secret access logs
gcloud logging read "resource.type=secretmanager_secret" --limit=50

# Check OAuth errors in application logs
gcloud logging read "resource.type=cloud_run_revision AND textPayload:OAuth" --limit=50
```

## 🔐 Security Best Practices

1. **Never commit secrets to version control**
2. **Use least privilege access for service accounts**
3. **Rotate secrets regularly**
4. **Monitor secret access logs**
5. **Use separate secrets for different environments**

## 📞 Support

For platform-specific issues:
- **Facebook/Instagram**: https://developers.facebook.com/support/
- **Pinterest**: https://developers.pinterest.com/support/
- **X (Twitter)**: https://developer.twitter.com/en/support
- **SoloBoss**: Contact SoloBoss support team
- **Google Cloud**: https://cloud.google.com/support

## 📝 Next Steps

1. **Complete the setup** using the provided scripts
2. **Validate your configuration** using the validation scripts
3. **Deploy your application** with the environment variables
4. **Test OAuth flows** for each platform
5. **Monitor application logs** for any credential-related errors
6. **Set up automated secret rotation** if needed

## 📚 Additional Resources

- **Detailed Setup Guide**: `SOCIAL_MEDIA_API_SETUP.md`
- **Quick Reference**: `API_CREDENTIALS_QUICK_REFERENCE.md`
- **Google Cloud Secret Manager**: https://cloud.google.com/secret-manager
- **OAuth 2.0 Documentation**: https://oauth.net/2/

---

**Note**: Keep your API credentials secure and never share them publicly. The scripts provided will help you store them safely in Google Cloud Secret Manager.
