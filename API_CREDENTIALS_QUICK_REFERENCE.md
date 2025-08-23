# Social Media API Credentials - Quick Reference

## 🚀 Quick Setup

### 1. Run the Setup Script

**Windows (PowerShell):**

```powershell
.\setup-secrets.ps1 -ProjectId "your-project-id" -Domain "your-domain.com"
```

            **Linux/macOS (Bash):**

            ```bash
./setup-secrets.sh your-project-id your-domain.com

```

### 2. Manual Setup (Alternative)

If you prefer to set up manually, follow the detailed guide in `SOCIAL_MEDIA_API_SETUP.md`.

## 📋 Required Credentials

### Facebook & Instagram

- **App ID (Client ID)**: 1506300127310392
- **App Secret (Client Secret)**: ac18ff2ac205f4d562641461f5741fb2
- **Redirect URI**: `https://social-soloboss-ai-automation.ew.r.appspot.com/api/oauth/facebook/callback`

### Pinterest

- **App ID (Client ID)**: From Pinterest Developers Console
- **App Secret (Client Secret)**: From Pinterest Developers Console
- **Redirect URI**: `https://social-soloboss-ai-automation.ew.r.appspot.com/api/oauth/pinterest/callback`

### X (Twitter)

- **API Key (Client ID)**: From Twitter Developer Portal
- **API Secret (Client Secret)**: From Twitter Developer Portal
- **Redirect URI**: `https://social-soloboss-ai-automation.ew.r.appspot.com/api/oauth/x/callback`

### SoloBoss

- **API Key**: From SoloBoss support team
- **Webhook Secret**: From SoloBoss support team

## 🔗 Developer Portal Links

| Platform | Developer Portal | Documentation |
|----------|------------------|---------------|
| Facebook | <https://developers.facebook.com/> | <https://developers.facebook.com/docs/> |
| Instagram | <https://developers.facebook.com/> | <https://developers.facebook.com/docs/instagram-api/> |
| Pinterest | <https://developers.pinterest.com/> | <https://developers.pinterest.com/docs/> |
| X (Twitter) | <https://developer.twitter.com/> | <https://developer.twitter.com/en/docs> |
| SoloBoss | Contact support | Contact support |

## 🔐 Secret Manager Commands

### Enable Secret Manager API

```bash
gcloud services enable secretmanager.googleapis.com
```

### Create a Secret

```bash
echo "your-secret-value" | gcloud secrets create secret-name --data-file=-
```

### List Secrets

```bash
gcloud secrets list
```

### Grant Access to Service Account

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## 🌐 OAuth Redirect URIs

Your application expects these OAuth redirect URIs:

- **Facebook**: `https://your-domain.com/api/oauth/facebook/callback`
- **Instagram**: `https://your-domain.com/api/oauth/instagram/callback`
- **Pinterest**: `https://your-domain.com/api/oauth/pinterest/callback`
- **X**: `https://your-domain.com/api/oauth/x/callback`

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

## 📞 Support

- **Facebook/Instagram**: <https://developers.facebook.com/support/>
- **Pinterest**: <https://developers.pinterest.com/support/>
- **X (Twitter)**: <https://developer.twitter.com/en/support>
- **SoloBoss**: Contact SoloBoss support team
- **Google Cloud**: <https://cloud.google.com/support>

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
