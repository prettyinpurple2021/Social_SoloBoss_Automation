#!/bin/bash

# Social SoloBoss Automation - Google Cloud Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${1:-"your-gcp-project-id"}
REGION=${2:-"us-central1"}
ENVIRONMENT=${3:-"prod"}

echo -e "${BLUE}🚀 Deploying Social SoloBoss Automation to Google Cloud${NC}"
echo -e "${BLUE}Project: ${PROJECT_ID}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed. Please install it first.${NC}"
    exit 1
fi

# Set the project
echo -e "${YELLOW}📋 Setting up Google Cloud project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sql-component.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    secretmanager.googleapis.com \
    cloudscheduler.googleapis.com

# Initialize Terraform
echo -e "${YELLOW}🏗️  Initializing Terraform...${NC}"
cd terraform
terraform init

# Plan Terraform deployment
echo -e "${YELLOW}📋 Planning Terraform deployment...${NC}"
terraform plan \
    -var="project_id=$PROJECT_ID" \
    -var="region=$REGION" \
    -var="environment=$ENVIRONMENT"

# Ask for confirmation
echo -e "${YELLOW}❓ Do you want to proceed with the deployment? (y/N)${NC}"
read -r response
if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${RED}❌ Deployment cancelled.${NC}"
    exit 1
fi

# Apply Terraform
echo -e "${YELLOW}🚀 Applying Terraform configuration...${NC}"
terraform apply \
    -var="project_id=$PROJECT_ID" \
    -var="region=$REGION" \
    -var="environment=$ENVIRONMENT" \
    -auto-approve

# Get Terraform outputs
echo -e "${YELLOW}📊 Getting infrastructure details...${NC}"
DB_CONNECTION=$(terraform output -raw database_connection_string)
REDIS_HOST=$(terraform output -raw redis_host)
REDIS_PORT=$(terraform output -raw redis_port)
SERVICE_ACCOUNT=$(terraform output -raw service_account_email)

cd ..

# Build and deploy with Cloud Build
echo -e "${YELLOW}🏗️  Building and deploying application...${NC}"
gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions=_PROJECT_ID=$PROJECT_ID,_REGION=$REGION,_ENVIRONMENT=$ENVIRONMENT

# Update Cloud Run services with environment variables
echo -e "${YELLOW}⚙️  Configuring Cloud Run services...${NC}"

# Backend environment variables
gcloud run services update social-soloboss-backend \
    --region=$REGION \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=$DB_CONNECTION" \
    --set-env-vars="REDIS_URL=redis://$REDIS_HOST:$REDIS_PORT" \
    --set-secrets="JWT_SECRET=jwt-secret-$ENVIRONMENT:latest" \
    --set-secrets="ENCRYPTION_KEY=encryption-key-$ENVIRONMENT:latest" \
    --service-account=$SERVICE_ACCOUNT

# Get backend URL
BACKEND_URL=$(gcloud run services describe social-soloboss-backend --region=$REGION --format="value(status.url)")

# Frontend environment variables
gcloud run services update social-soloboss-frontend \
    --region=$REGION \
    --set-env-vars="VITE_API_URL=$BACKEND_URL/api" \
    --set-env-vars="VITE_APP_NAME=Social SoloBoss Automation"

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe social-soloboss-frontend --region=$REGION --format="value(status.url)")

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
gcloud run jobs create social-soloboss-migrate \
    --image=gcr.io/$PROJECT_ID/social-soloboss-backend:latest \
    --region=$REGION \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=$DB_CONNECTION" \
    --set-secrets="JWT_SECRET=jwt-secret-$ENVIRONMENT:latest" \
    --set-secrets="ENCRYPTION_KEY=encryption-key-$ENVIRONMENT:latest" \
    --service-account=$SERVICE_ACCOUNT \
    --command="npm" \
    --args="run,db:migrate" \
    --max-retries=3 \
    --parallelism=1 \
    --task-count=1

gcloud run jobs execute social-soloboss-migrate --region=$REGION --wait

# Setup custom domain (optional)
echo -e "${YELLOW}🌐 Setting up custom domain mapping...${NC}"
echo -e "${BLUE}To set up a custom domain:${NC}"
echo -e "${BLUE}1. Go to Cloud Run in the Google Cloud Console${NC}"
echo -e "${BLUE}2. Select your service${NC}"
echo -e "${BLUE}3. Click 'Manage Custom Domains'${NC}"
echo -e "${BLUE}4. Add your domain and follow the verification steps${NC}"

# Display deployment information
echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${GREEN}📱 Application URLs:${NC}"
echo -e "${GREEN}Frontend: $FRONTEND_URL${NC}"
echo -e "${GREEN}Backend API: $BACKEND_URL/api${NC}"
echo -e "${GREEN}API Documentation: $BACKEND_URL/api-docs${NC}"
echo ""
echo -e "${GREEN}🔧 Infrastructure:${NC}"
echo -e "${GREEN}Database: Cloud SQL PostgreSQL${NC}"
echo -e "${GREEN}Cache: Cloud Memorystore Redis${NC}"
echo -e "${GREEN}Secrets: Secret Manager${NC}"
echo -e "${GREEN}Scheduler: Cloud Scheduler${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e "${YELLOW}1. Configure social media API credentials in Secret Manager${NC}"
echo -e "${YELLOW}2. Set up your custom domain (optional)${NC}"
echo -e "${YELLOW}3. Configure SoloBoss webhook URL: $BACKEND_URL/api/soloboss/webhook${NC}"
echo -e "${YELLOW}4. Test the application at: $FRONTEND_URL${NC}"
echo ""
echo -e "${GREEN}🎉 Social SoloBoss Automation is now live!${NC}"