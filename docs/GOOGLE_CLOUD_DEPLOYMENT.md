# Google Cloud Deployment Guide - Social SoloBoss Automation

## Overview

This guide walks you through deploying Social SoloBoss Automation to Google Cloud Platform using Cloud Run, Cloud SQL, and other managed services.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** installed locally
3. **Terraform** installed (version >= 1.0)
4. **Docker** installed locally
5. **Project with necessary APIs enabled**

## Quick Deployment

### 1. Setup Google Cloud Project

```bash
# Create a new project (optional)
gcloud projects create your-project-id --name="Social SoloBoss Automation"

# Set the project
gcloud config set project your-project-id

# Enable billing (required for Cloud SQL and other services)
# This must be done through the Google Cloud Console
```

### 2. Install Dependencies

```bash
# Install Google Cloud SDK
# Visit: https://cloud.google.com/sdk/docs/install

# Install Terraform
# Visit: https://terraform.io/downloads

# Verify installations
gcloud --version
terraform --version
```

### 3. Deploy Infrastructure

```bash
# Make the deployment script executable (Linux/Mac)
chmod +x deploy.sh

# Run deployment script
./deploy.sh your-project-id us-central1 prod
```

**For Windows users:**
```powershell
# Run the deployment manually following the steps below
```

## Manual Deployment Steps

### Step 1: Enable Required APIs

```bash
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sql-component.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    secretmanager.googleapis.com \
    cloudscheduler.googleapis.com
```

### Step 2: Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan \
    -var="project_id=your-project-id" \
    -var="region=us-central1" \
    -var="environment=prod"

# Apply configuration
terraform apply \
    -var="project_id=your-project-id" \
    -var="region=us-central1" \
    -var="environment=prod"
```

### Step 3: Build and Deploy Application

```bash
# Build and deploy with Cloud Build
gcloud builds submit --config=cloudbuild.yaml
```

### Step 4: Configure Environment Variables

```bash
# Get infrastructure details from Terraform
DB_CONNECTION=$(terraform output -raw database_connection_string)
REDIS_HOST=$(terraform output -raw redis_host)
REDIS_PORT=$(terraform output -raw redis_port)
SERVICE_ACCOUNT=$(terraform output -raw service_account_email)

# Update backend service
gcloud run services update social-soloboss-backend \
    --region=us-central1 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=$DB_CONNECTION" \
    --set-env-vars="REDIS_URL=redis://$REDIS_HOST:$REDIS_PORT" \
    --set-secrets="JWT_SECRET=jwt-secret-prod:latest" \
    --set-secrets="ENCRYPTION_KEY=encryption-key-prod:latest" \
    --service-account=$SERVICE_ACCOUNT

# Get backend URL
BACKEND_URL=$(gcloud run services describe social-soloboss-backend --region=us-central1 --format="value(status.url)")

# Update frontend service
gcloud run services update social-soloboss-frontend \
    --region=us-central1 \
    --set-env-vars="VITE_API_URL=$BACKEND_URL/api" \
    --set-env-vars="VITE_APP_NAME=Social SoloBoss Automation"
```

### Step 5: Run Database Migrations

```bash
# Create and run migration job
gcloud run jobs create social-soloboss-migrate \
    --image=gcr.io/your-project-id/social-soloboss-backend:latest \
    --region=us-central1 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=$DB_CONNECTION" \
    --set-secrets="JWT_SECRET=jwt-secret-prod:latest" \
    --set-secrets="ENCRYPTION_KEY=encryption-key-prod:latest" \
    --service-account=$SERVICE_ACCOUNT \
    --command="npm" \
    --args="run,db:migrate"

gcloud run jobs execute social-soloboss-migrate --region=us-central1 --wait
```

## Architecture Overview

### Services Deployed

1. **Cloud Run Services**:
   - `social-soloboss-backend` - Node.js API server
   - `social-soloboss-frontend` - React frontend

2. **Cloud SQL**:
   - PostgreSQL 15 instance
   - Automated backups
   - Point-in-time recovery

3. **Cloud Memorystore**:
   - Redis cache for sessions and queues

4. **Secret Manager**:
   - JWT secrets
   - Encryption keys
   - Database passwords

5. **Cloud Scheduler**:
   - Automated post processing
   - Runs every minute

6. **Container Registry**:
   - Docker images storage

## Configuration

### Environment Variables

**Backend Service:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<from-secret-manager>
ENCRYPTION_KEY=<from-secret-manager>
```

**Frontend Service:**
```bash
VITE_API_URL=https://your-backend-url/api
VITE_APP_NAME=Social SoloBoss Automation
```

### Social Media API Configuration

Add your social media API credentials to Secret Manager:

```bash
# Facebook
gcloud secrets create facebook-app-id --data-file=- <<< "your-facebook-app-id"
gcloud secrets create facebook-app-secret --data-file=- <<< "your-facebook-app-secret"

# Instagram
gcloud secrets create instagram-app-id --data-file=- <<< "your-instagram-app-id"
gcloud secrets create instagram-app-secret --data-file=- <<< "your-instagram-app-secret"

# Pinterest
gcloud secrets create pinterest-app-id --data-file=- <<< "your-pinterest-app-id"
gcloud secrets create pinterest-app-secret --data-file=- <<< "your-pinterest-app-secret"

# X (Twitter)
gcloud secrets create x-api-key --data-file=- <<< "your-x-api-key"
gcloud secrets create x-api-secret --data-file=- <<< "your-x-api-secret"

# Update backend service to use secrets
gcloud run services update social-soloboss-backend \
    --region=us-central1 \
    --set-secrets="FACEBOOK_APP_ID=facebook-app-id:latest" \
    --set-secrets="FACEBOOK_APP_SECRET=facebook-app-secret:latest" \
    --set-secrets="INSTAGRAM_APP_ID=instagram-app-id:latest" \
    --set-secrets="INSTAGRAM_APP_SECRET=instagram-app-secret:latest" \
    --set-secrets="PINTEREST_APP_ID=pinterest-app-id:latest" \
    --set-secrets="PINTEREST_APP_SECRET=pinterest-app-secret:latest" \
    --set-secrets="X_API_KEY=x-api-key:latest" \
    --set-secrets="X_API_SECRET=x-api-secret:latest"
```

## Custom Domain Setup

### 1. Domain Mapping

```bash
# Map custom domain to Cloud Run service
gcloud run domain-mappings create \
    --service=social-soloboss-frontend \
    --domain=your-domain.com \
    --region=us-central1
```

### 2. SSL Certificate

Cloud Run automatically provisions SSL certificates for custom domains.

### 3. DNS Configuration

Update your domain's DNS records as instructed by the domain mapping command.

## SoloBoss Integration Setup

### 1. Webhook Configuration

Configure SoloBoss to send webhooks to:
```
https://your-backend-url/api/soloboss/webhook
```

### 2. Webhook Secret

```bash
# Create webhook secret
gcloud secrets create soloboss-webhook-secret --data-file=- <<< "your-webhook-secret"

# Update backend service
gcloud run services update social-soloboss-backend \
    --region=us-central1 \
    --set-secrets="SOLOBOSS_WEBHOOK_SECRET=soloboss-webhook-secret:latest"
```

## Monitoring and Logging

### Cloud Logging

All application logs are automatically sent to Cloud Logging:

```bash
# View backend logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=social-soloboss-backend" --limit=50

# View frontend logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=social-soloboss-frontend" --limit=50
```

### Cloud Monitoring

Set up monitoring dashboards and alerts:

1. Go to Cloud Monitoring in the Google Cloud Console
2. Create custom dashboards for your services
3. Set up alerting policies for errors and performance

### Health Checks

Health check endpoints are available:
- Backend: `https://your-backend-url/api/health`
- Frontend: `https://your-frontend-url/`

## Scaling Configuration

### Auto Scaling

Cloud Run automatically scales based on traffic:

```bash
# Configure scaling
gcloud run services update social-soloboss-backend \
    --region=us-central1 \
    --min-instances=1 \
    --max-instances=10 \
    --concurrency=100

gcloud run services update social-soloboss-frontend \
    --region=us-central1 \
    --min-instances=0 \
    --max-instances=5 \
    --concurrency=1000
```

### Database Scaling

```bash
# Scale Cloud SQL instance
gcloud sql instances patch social-soloboss-postgres-prod \
    --tier=db-standard-1 \
    --storage-size=50GB
```

## Backup and Recovery

### Database Backups

Automated backups are configured in Terraform:
- Daily backups at 3:00 AM UTC
- 7-day retention period
- Point-in-time recovery enabled

### Manual Backup

```bash
# Create manual backup
gcloud sql backups create \
    --instance=social-soloboss-postgres-prod \
    --description="Manual backup before update"
```

### Restore from Backup

```bash
# List available backups
gcloud sql backups list --instance=social-soloboss-postgres-prod

# Restore from backup
gcloud sql backups restore BACKUP_ID \
    --restore-instance=social-soloboss-postgres-prod
```

## Security Best Practices

### 1. IAM Permissions

- Use least privilege principle
- Service accounts have minimal required permissions
- Regular audit of IAM bindings

### 2. Network Security

- Cloud Run services use HTTPS only
- Database accessible only from authorized networks
- VPC connector for private communication (optional)

### 3. Secret Management

- All sensitive data stored in Secret Manager
- Automatic secret rotation (recommended)
- Audit logging for secret access

### 4. Container Security

- Non-root containers
- Minimal base images
- Regular security updates

## Cost Optimization

### 1. Resource Sizing

- Start with minimal resources
- Monitor usage and scale as needed
- Use Cloud Run's pay-per-use model

### 2. Database Optimization

- Use appropriate instance size
- Enable automatic storage increase
- Regular maintenance and optimization

### 3. Monitoring Costs

- Set up billing alerts
- Use Cloud Billing reports
- Regular cost analysis

## Troubleshooting

### Common Issues

1. **Service not starting**:
   ```bash
   # Check logs
   gcloud logs read "resource.type=cloud_run_revision" --limit=50
   ```

2. **Database connection issues**:
   ```bash
   # Test database connectivity
   gcloud sql connect social-soloboss-postgres-prod --user=app_user
   ```

3. **Secret access issues**:
   ```bash
   # Check IAM permissions
   gcloud projects get-iam-policy your-project-id
   ```

### Support Resources

- [Google Cloud Support](https://cloud.google.com/support)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)

## Maintenance

### Regular Tasks

1. **Update dependencies** in package.json files
2. **Monitor security advisories** for base images
3. **Review and rotate secrets** periodically
4. **Analyze performance metrics** and optimize
5. **Update Terraform configurations** as needed

### Deployment Updates

```bash
# Deploy new version
gcloud builds submit --config=cloudbuild.yaml

# Rollback if needed
gcloud run services update social-soloboss-backend \
    --region=us-central1 \
    --image=gcr.io/your-project-id/social-soloboss-backend:previous-tag
```

This deployment guide provides a complete setup for running Social SoloBoss Automation on Google Cloud Platform with production-ready configuration, monitoring, and security best practices.