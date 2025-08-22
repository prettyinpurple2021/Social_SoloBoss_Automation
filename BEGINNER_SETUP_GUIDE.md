# 🚀 Beginner's Guide to Deploying Social SoloBoss Automation

## Welcome! 👋

Great news! Your Social SoloBoss Automation project is already well-structured and ready for deployment. Since you've already installed the tools and set up your Google Cloud project, this guide will walk you through the final deployment steps.

## ✅ What's Already Done

Your project already includes:

- **Complete Backend API** with authentication, OAuth, and social media integrations
- **Modern React Frontend** with Material-UI components
- **Database Models** for users, posts, and platform connections
- **Docker Configuration** for both development and production
- **Terraform Infrastructure** code for Google Cloud
- **Cloud Build Configuration** for automated deployment
- **Comprehensive Testing** setup with Jest and Vitest
- **API Documentation** with Swagger/OpenAPI
- **Security Middleware** including rate limiting and authentication
- **Scheduler Implementation** for automated post processing

## ✅ What You've Already Completed

- ✅ Google Cloud SDK installed
- ✅ Terraform installed
- ✅ Google Cloud project created
- ✅ Billing enabled

## 🎯 What We Need to Do Now

1. **Deploy your app to Google Cloud**
2. **Configure your social media API credentials**
3. **Test your live application**

## Step 1: Deploy Your App

### 1.1 Navigate to Your Project Folder

Open Command Prompt and navigate to your project folder:

```bash
cd "C:\Users\prett\Downloads\Automated SoloBoss content poster"
```

### 1.2 Set Your Google Cloud Project

First, make sure you're using the correct project:

```bash
# Login to Google Cloud (if not already logged in)
gcloud auth login

# Set your project (replace with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Verify it worked
gcloud config get-value project
```

**Replace `YOUR_PROJECT_ID` with your actual Google Cloud project ID.**

### 1.3 Run the Deployment Script

Simply run:

```bash
deploy-windows.bat
```

This script will:
- ✅ Enable all necessary Google Cloud services
- ✅ Create your database and Redis cache
- ✅ Build and deploy your app
- ✅ Set up all the security and configurations
- ✅ Give you the URLs to access your app

**The deployment takes about 10-15 minutes.** You'll see lots of text scrolling by - this is normal!

### 1.4 What You'll See During Deployment

You'll see messages like:
- "Enabling required Google Cloud APIs..." ✅
- "Initializing Terraform..." ✅
- "Building and deploying application..." ✅
- "Configuring Cloud Run services..." ✅

At the end, you'll see something like:

```
========================================
 DEPLOYMENT COMPLETED SUCCESSFULLY!
========================================

Application URLs:
Frontend: https://social-soloboss-frontend-xyz-uc.a.run.app
Backend API: https://social-soloboss-backend-xyz-uc.a.run.app/api
API Documentation: https://social-soloboss-backend-xyz-uc.a.run.app/api-docs
```

**Save these URLs!** You'll need them for the next steps.

## Step 2: Configure Social Media API Credentials

After deployment, you need to set up your social media API credentials in Google Cloud Secret Manager.

### 2.1 Access Secret Manager

1. Go to: https://console.cloud.google.com/security/secret-manager
2. Select your project
3. Click "CREATE SECRET"

### 2.2 Add Your API Credentials

For each social media platform you want to use, create a new secret:

**Facebook:**
1. Click "CREATE SECRET"
2. Secret name: `facebook-client-id-prod`
3. Secret value: Your Facebook App ID
4. Click "CREATE SECRET"

1. Click "CREATE SECRET" again
2. Secret name: `facebook-client-secret-prod`
3. Secret value: Your Facebook App Secret
4. Click "CREATE SECRET"

**Instagram:**
1. Click "CREATE SECRET"
2. Secret name: `instagram-client-id-prod`
3. Secret value: Your Instagram App ID
4. Click "CREATE SECRET"

1. Click "CREATE SECRET" again
2. Secret name: `instagram-client-secret-prod`
3. Secret value: Your Instagram App Secret
4. Click "CREATE SECRET"

**X (Twitter):**
1. Click "CREATE SECRET"
2. Secret name: `x-client-id-prod`
3. Secret value: Your X Client ID
4. Click "CREATE SECRET"

1. Click "CREATE SECRET" again
2. Secret name: `x-client-secret-prod`
3. Secret value: Your X Client Secret
4. Click "CREATE SECRET"

**Pinterest:**
1. Click "CREATE SECRET"
2. Secret name: `pinterest-client-id-prod`
3. Secret value: Your Pinterest App ID
4. Click "CREATE SECRET"

1. Click "CREATE SECRET" again
2. Secret name: `pinterest-client-secret-prod`
3. Secret value: Your Pinterest App Secret
4. Click "CREATE SECRET"

### 2.3 Update Cloud Run Services

After adding secrets, update your backend service to use them. In Command Prompt:

```bash
# Get your backend service URL (replace with your actual region if different)
gcloud run services describe social-soloboss-backend --region=us-central1 --format="value(status.url)"

# Update the service with new secrets
gcloud run services update social-soloboss-backend --region=us-central1 ^
  --set-secrets="FACEBOOK_CLIENT_ID=facebook-client-id-prod:latest" ^
  --set-secrets="FACEBOOK_CLIENT_SECRET=facebook-client-secret-prod:latest" ^
  --set-secrets="INSTAGRAM_CLIENT_ID=instagram-client-id-prod:latest" ^
  --set-secrets="INSTAGRAM_CLIENT_SECRET=instagram-client-secret-prod:latest" ^
  --set-secrets="X_CLIENT_ID=x-client-id-prod:latest" ^
  --set-secrets="X_CLIENT_SECRET=x-client-secret-prod:latest" ^
  --set-secrets="PINTEREST_CLIENT_ID=pinterest-client-id-prod:latest" ^
  --set-secrets="PINTEREST_CLIENT_SECRET=pinterest-client-secret-prod:latest"
```

**Note:** If you don't have API credentials yet, you can skip this step and add them later.

## Step 3: Test Your Live Application

### 3.1 Test the Frontend

1. **Open your browser** and go to the Frontend URL from step 1.4
2. **You should see** the Social SoloBoss Automation login page
3. **Click "Sign Up"** to create a new account
4. **Fill in your details** and create your account
5. **Log in** with your new account

### 3.2 Test the Backend API

1. **Open your browser** and go to the API Documentation URL from step 1.4
2. **You should see** the Swagger API documentation
3. **Test the health endpoint** by clicking on `/api/health` and then "Try it out"
4. **Click "Execute"** - you should get a successful response

### 3.3 Test Social Media Connections

1. **In your app**, go to "Settings" or "Connections"
2. **Click "Connect Facebook"** (or other platforms)
3. **You should be redirected** to the social media platform for authorization
4. **Authorize the app** and you should be redirected back

## Step 4: Connect to SoloBoss

In your SoloBoss AI Content Planner settings, set the webhook URL to:
```
https://your-backend-url/api/soloboss/webhook
```

(Replace `your-backend-url` with the actual Backend URL from step 1.4)

## Troubleshooting Common Issues

### Deployment Script Fails

**Error: "Project not found"**
```bash
# Check your current project
gcloud config get-value project

# Set the correct project
gcloud config set project YOUR_PROJECT_ID
```

**Error: "Permission denied"**
```bash
# Re-authenticate
gcloud auth login
```

**Error: "Billing not enabled"**
- Go to: https://console.cloud.google.com/billing
- Select your project
- Click "Link a billing account"

### App Doesn't Load

**Frontend shows error:**
1. Check if the backend is running: Visit the API Documentation URL
2. If backend is down, check Cloud Run logs:
   ```bash
   gcloud run services logs read social-soloboss-backend --region=us-central1
   ```

**Backend shows error:**
1. Check if the database is running
2. Check Cloud Run logs for database connection errors
3. Verify secrets are properly configured

### Social Media Connections Don't Work

**"Invalid redirect URI" error:**
1. Go to your social media app settings
2. Add your backend URL + `/api/oauth/[platform]/callback` to allowed redirect URIs
3. Example: `https://your-backend-url/api/oauth/facebook/callback`

**"App not found" error:**
1. Make sure you've added the API credentials to Secret Manager
2. Verify the secret names match exactly
3. Check that you've updated the Cloud Run service with the secrets

## What You've Just Accomplished! 🎉

You've successfully:
- ✅ Deployed a full-stack web application to Google Cloud
- ✅ Set up a production PostgreSQL database
- ✅ Configured Redis caching
- ✅ Implemented automatic scaling with Cloud Run
- ✅ Set up security with Secret Manager
- ✅ Created a live app accessible from anywhere in the world
- ✅ Configured automated post processing with Cloud Scheduler

## Next Steps

1. **Set up social media API credentials** (if you haven't already)
2. **Connect your social media accounts** through the app
3. **Configure your SoloBoss webhook**
4. **Start creating and scheduling posts**
5. **Monitor your app** using Google Cloud Console

## Getting Help

If you run into any issues:

1. **Check the error message** - it usually tells you what's wrong
2. **Try the command again** - sometimes it's just a temporary network issue
3. **Check the detailed documentation** in the `docs/` folder:
   - `docs/GOOGLE_CLOUD_DEPLOYMENT.md` - Technical deployment guide
   - `docs/API_DOCUMENTATION.md` - API reference
   - `docs/USER_GUIDE.md` - How to use the application
4. **Ask for help** - provide the exact error message you're seeing

## Cost Information

Your app will cost approximately:
- **$70-120 per month** for typical usage
- **Pay only for what you use** - if no one uses the app, costs are minimal

**Cost breakdown:**
- Cloud Run: ~$20-40/month (depending on usage)
- Cloud SQL: ~$25-50/month (PostgreSQL instance)
- Redis: ~$15-25/month (cache instance)
- Cloud Build: ~$5-10/month (builds and deployments)
- Other services: ~$5-15/month

## Congratulations! 🎊

You've just deployed a professional-grade social media automation platform to Google Cloud! Your Social SoloBoss Automation app is now live and ready to help you manage your social media presence automatically.

## Additional Resources

- **API Documentation**: Available at your backend URL + `/api-docs`
- **User Guide**: See `docs/USER_GUIDE.md` for detailed usage instructions
- **Testing Guide**: See `docs/TESTING_GUIDE.md` for testing procedures
- **Google Cloud Console**: Monitor your app at https://console.cloud.google.com