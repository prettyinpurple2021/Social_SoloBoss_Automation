#!/bin/bash

# Social Media API Credentials Setup Script for Google Cloud Secret Manager
# This script helps you create and configure secrets for your social media integrations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}🔐 $1${NC}"
}

print_header() {
    echo -e "${GREEN}🚀 $1${NC}"
}

# Check if project ID is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <PROJECT_ID> [DOMAIN]"
    echo "Example: $0 my-project-id mydomain.com"
    exit 1
fi

PROJECT_ID=$1
DOMAIN=${2:-"your-domain.com"}

print_header "Setting up Social Media API Credentials for Google Cloud Secret Manager"
echo -e "${YELLOW}Project ID: $PROJECT_ID${NC}"
echo -e "${YELLOW}Domain: $DOMAIN${NC}"
echo ""

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    print_error "Google Cloud CLI not found"
    echo "Please install gcloud CLI first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_error "Google Cloud CLI not authenticated"
    echo "Please authenticate first:"
    echo "gcloud auth login"
    exit 1
fi

print_status "Google Cloud CLI found and authenticated"

# Set the project
echo -e "${CYAN}Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable Secret Manager API
print_info "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com

# Function to create secret with user input
create_secret() {
    local secret_name=$1
    local description=$2
    local prompt=$3
    
    echo ""
    print_info "Creating secret: $secret_name"
    echo -e "${GRAY}Description: $description${NC}"
    
    read -p "$prompt: " value
    
    if [ -z "$value" ]; then
        print_warning "Skipping $secret_name (empty value)"
        return 1
    fi
    
    if echo "$value" | gcloud secrets create "$secret_name" --data-file=-; then
        print_status "Created secret: $secret_name"
        return 0
    else
        print_error "Failed to create secret: $secret_name"
        return 1
    fi
}

# Function to create redirect URI secret
create_redirect_uri_secret() {
    local platform=$1
    local domain=$2
    
    local secret_name="$platform-redirect-uri"
    local redirect_uri="https://$domain/api/oauth/$platform/callback"
    
    echo ""
    print_info "Creating redirect URI secret: $secret_name"
    echo -e "${GRAY}Redirect URI: $redirect_uri${NC}"
    
    if echo "$redirect_uri" | gcloud secrets create "$secret_name" --data-file=-; then
        print_status "Created redirect URI secret: $secret_name"
        return 0
    else
        print_error "Failed to create redirect URI secret: $secret_name"
        return 1
    fi
}

echo -e "${YELLOW}📝 Please provide your social media API credentials:${NC}"
echo ""

# Facebook OAuth Credentials
create_secret "facebook-client-id" "Facebook OAuth Client ID" "Enter your Facebook App ID (Client ID)"
create_secret "facebook-client-secret" "Facebook OAuth Client Secret" "Enter your Facebook App Secret (Client Secret)"

# Instagram OAuth Credentials (same as Facebook for most cases)
create_secret "instagram-client-id" "Instagram OAuth Client ID" "Enter your Instagram App ID (usually same as Facebook)"
create_secret "instagram-client-secret" "Instagram OAuth Client Secret" "Enter your Instagram App Secret (usually same as Facebook)"

# Pinterest OAuth Credentials
create_secret "pinterest-client-id" "Pinterest OAuth Client ID" "Enter your Pinterest App ID (Client ID)"
create_secret "pinterest-client-secret" "Pinterest OAuth Client Secret" "Enter your Pinterest App Secret (Client Secret)"

# X (Twitter) OAuth Credentials
create_secret "x-client-id" "X (Twitter) OAuth Client ID" "Enter your X (Twitter) API Key (Client ID)"
create_secret "x-client-secret" "X (Twitter) OAuth Client Secret" "Enter your X (Twitter) API Secret (Client Secret)"

# SoloBoss API Credentials
create_secret "soloboss-api-key" "SoloBoss API Key" "Enter your SoloBoss API Key"
create_secret "soloboss-webhook-secret" "SoloBoss Webhook Secret" "Enter your SoloBoss Webhook Secret"

# Create redirect URI secrets
echo ""
print_info "Creating OAuth redirect URI secrets..."

create_redirect_uri_secret "facebook" "$DOMAIN"
create_redirect_uri_secret "instagram" "$DOMAIN"
create_redirect_uri_secret "pinterest" "$DOMAIN"
create_redirect_uri_secret "x" "$DOMAIN"

# List all created secrets
echo ""
print_status "Summary of created secrets:"
gcloud secrets list --filter="name:projects/$PROJECT_ID/secrets/*"

# Generate environment variables configuration
echo ""
print_status "Environment Variables Configuration:"
echo -e "${YELLOW}Add these to your deployment configuration:${NC}"
echo ""

cat << EOF
# Facebook OAuth
FACEBOOK_CLIENT_ID=projects/$PROJECT_ID/secrets/facebook-client-id/versions/latest
FACEBOOK_CLIENT_SECRET=projects/$PROJECT_ID/secrets/facebook-client-secret/versions/latest
FACEBOOK_REDIRECT_URI=projects/$PROJECT_ID/secrets/facebook-redirect-uri/versions/latest

# Instagram OAuth
INSTAGRAM_CLIENT_ID=projects/$PROJECT_ID/secrets/instagram-client-id/versions/latest
INSTAGRAM_CLIENT_SECRET=projects/$PROJECT_ID/secrets/instagram-client-secret/versions/latest
INSTAGRAM_REDIRECT_URI=projects/$PROJECT_ID/secrets/instagram-redirect-uri/versions/latest

# Pinterest OAuth
PINTEREST_CLIENT_ID=projects/$PROJECT_ID/secrets/pinterest-client-id/versions/latest
PINTEREST_CLIENT_SECRET=projects/$PROJECT_ID/secrets/pinterest-client-secret/versions/latest
PINTEREST_REDIRECT_URI=projects/$PROJECT_ID/secrets/pinterest-redirect-uri/versions/latest

# X (Twitter) OAuth
X_CLIENT_ID=projects/$PROJECT_ID/secrets/x-client-id/versions/latest
X_CLIENT_SECRET=projects/$PROJECT_ID/secrets/x-client-secret/versions/latest
X_REDIRECT_URI=projects/$PROJECT_ID/secrets/x-redirect-uri/versions/latest

# SoloBoss API
SOLOBOSS_API_KEY=projects/$PROJECT_ID/secrets/soloboss-api-key/versions/latest
SOLOBOSS_WEBHOOK_SECRET=projects/$PROJECT_ID/secrets/soloboss-webhook-secret/versions/latest
EOF

# Save environment variables to file
ENV_FILE="social-media-secrets.env"
cat << EOF > "$ENV_FILE"
# Facebook OAuth
FACEBOOK_CLIENT_ID=projects/$PROJECT_ID/secrets/facebook-client-id/versions/latest
FACEBOOK_CLIENT_SECRET=projects/$PROJECT_ID/secrets/facebook-client-secret/versions/latest
FACEBOOK_REDIRECT_URI=projects/$PROJECT_ID/secrets/facebook-redirect-uri/versions/latest

# Instagram OAuth
INSTAGRAM_CLIENT_ID=projects/$PROJECT_ID/secrets/instagram-client-id/versions/latest
INSTAGRAM_CLIENT_SECRET=projects/$PROJECT_ID/secrets/instagram-client-secret/versions/latest
INSTAGRAM_REDIRECT_URI=projects/$PROJECT_ID/secrets/instagram-redirect-uri/versions/latest

# Pinterest OAuth
PINTEREST_CLIENT_ID=projects/$PROJECT_ID/secrets/pinterest-client-id/versions/latest
PINTEREST_CLIENT_SECRET=projects/$PROJECT_ID/secrets/pinterest-client-secret/versions/latest
PINTEREST_REDIRECT_URI=projects/$PROJECT_ID/secrets/pinterest-redirect-uri/versions/latest

# X (Twitter) OAuth
X_CLIENT_ID=projects/$PROJECT_ID/secrets/x-client-id/versions/latest
X_CLIENT_SECRET=projects/$PROJECT_ID/secrets/x-client-secret/versions/latest
X_REDIRECT_URI=projects/$PROJECT_ID/secrets/x-redirect-uri/versions/latest

# SoloBoss API
SOLOBOSS_API_KEY=projects/$PROJECT_ID/secrets/soloboss-api-key/versions/latest
SOLOBOSS_WEBHOOK_SECRET=projects/$PROJECT_ID/secrets/soloboss-webhook-secret/versions/latest
EOF

echo ""
print_status "Environment variables saved to: $ENV_FILE"

# Next steps
echo ""
print_status "Setup Complete!"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your deployment configuration with the environment variables above"
echo "2. Ensure your service account has Secret Manager access:"
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID --member='serviceAccount:YOUR_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com' --role='roles/secretmanager.secretAccessor'"
echo "3. Test your OAuth flows"
echo "4. Monitor application logs for any credential-related errors"
echo ""
echo -e "${CYAN}For detailed instructions, see: SOCIAL_MEDIA_API_SETUP.md${NC}"
