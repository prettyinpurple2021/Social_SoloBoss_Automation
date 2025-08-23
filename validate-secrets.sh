#!/bin/bash

# Social Media API Credentials Validation Script
# This script validates that all required secrets are properly configured in Google Cloud Secret Manager

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
    echo -e "${GREEN}🔍 $1${NC}"
}

# Check if project ID is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <PROJECT_ID>"
    echo "Example: $0 my-project-id"
    exit 1
fi

PROJECT_ID=$1

print_header "Validating Social Media API Credentials in Google Cloud Secret Manager"
echo -e "${YELLOW}Project ID: $PROJECT_ID${NC}"
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

# Define required secrets
declare -A required_secrets=(
    ["facebook-client-id"]="Facebook OAuth Client ID"
    ["facebook-client-secret"]="Facebook OAuth Client Secret"
    ["facebook-redirect-uri"]="Facebook OAuth Redirect URI"
    ["instagram-client-id"]="Instagram OAuth Client ID"
    ["instagram-client-secret"]="Instagram OAuth Client Secret"
    ["instagram-redirect-uri"]="Instagram OAuth Redirect URI"
    ["pinterest-client-id"]="Pinterest OAuth Client ID"
    ["pinterest-client-secret"]="Pinterest OAuth Client Secret"
    ["pinterest-redirect-uri"]="Pinterest OAuth Redirect URI"
    ["x-client-id"]="X (Twitter) OAuth Client ID"
    ["x-client-secret"]="X (Twitter) OAuth Client Secret"
    ["x-redirect-uri"]="X (Twitter) OAuth Redirect URI"
    ["soloboss-api-key"]="SoloBoss API Key"
    ["soloboss-webhook-secret"]="SoloBoss Webhook Secret"
)

# Function to validate secret
test_secret() {
    local secret_name=$1
    local description=$2
    
    echo ""
    print_info "Checking secret: $secret_name"
    echo -e "${GRAY}Description: $description${NC}"
    
    # Check if secret exists
    if gcloud secrets describe "$secret_name" --format="value(name)" >/dev/null 2>&1; then
        # Check if secret has a version
        if gcloud secrets versions list "$secret_name" --format="value(name)" | grep -q .; then
            print_status "Secret exists and has versions"
            return 0
        else
            print_warning "Secret exists but has no versions"
            return 1
        fi
    else
        print_error "Secret does not exist"
        return 1
    fi
}

# Function to validate redirect URI format
test_redirect_uri() {
    local secret_name=$1
    
    if redirect_uri=$(gcloud secrets versions access latest --secret="$secret_name" 2>/dev/null); then
        if [[ $redirect_uri =~ ^https://[^/]+/api/oauth/[^/]+/callback$ ]]; then
            print_status "Redirect URI format is valid: $redirect_uri"
            return 0
        else
            print_warning "Redirect URI format may be incorrect: $redirect_uri"
            return 1
        fi
    else
        print_error "Could not access redirect URI secret"
        return 1
    fi
}

# Validate all secrets
valid_secrets=0
total_secrets=${#required_secrets[@]}

echo -e "${CYAN}📋 Validating $total_secrets required secrets...${NC}"
echo ""

for secret_name in "${!required_secrets[@]}"; do
    if test_secret "$secret_name" "${required_secrets[$secret_name]}"; then
        ((valid_secrets++))
        
        # Validate redirect URI format for redirect URI secrets
        if [[ $secret_name == *-redirect-uri ]]; then
            test_redirect_uri "$secret_name"
        fi
    fi
done

# Summary
echo ""
print_status "Validation Summary:"
if [ $valid_secrets -eq $total_secrets ]; then
    echo -e "${GREEN}Valid secrets: $valid_secrets/$total_secrets${NC}"
    print_status "All secrets are properly configured!"
else
    echo -e "${YELLOW}Valid secrets: $valid_secrets/$total_secrets${NC}"
    print_warning "Some secrets are missing or misconfigured"
    echo ""
    echo -e "${CYAN}To fix missing secrets, run the setup script:${NC}"
    echo "./setup-secrets.sh '$PROJECT_ID'"
fi

# Check service account permissions
echo ""
print_info "Checking service account permissions..."

if service_accounts=$(gcloud iam service-accounts list --format="value(email)" 2>/dev/null); then
    if [ -n "$service_accounts" ]; then
        print_status "Found service accounts:"
        while IFS= read -r sa; do
            echo -e "${GRAY}  - $sa${NC}"
            
            # Check if service account has Secret Manager access
            if gcloud projects get-iam-policy "$PROJECT_ID" --flatten="bindings[].members" --format="value(bindings.role)" --filter="bindings.members:$sa" 2>/dev/null | grep -q "secretmanager"; then
                echo -e "${GREEN}    ✅ Has Secret Manager access${NC}"
            else
                echo -e "${YELLOW}    ⚠️  May need Secret Manager access${NC}"
                echo -e "${GRAY}    Run: gcloud projects add-iam-policy-binding $PROJECT_ID --member='serviceAccount:$sa' --role='roles/secretmanager.secretAccessor'${NC}"
            fi
        done <<< "$service_accounts"
    else
        print_warning "No service accounts found"
    fi
else
    print_warning "Error checking service account permissions"
fi

# Generate environment variables configuration
echo ""
print_status "Environment Variables Configuration:"
echo -e "${YELLOW}Use these in your deployment configuration:${NC}"
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

# Next steps
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
if [ $valid_secrets -eq $total_secrets ]; then
    echo -e "${GREEN}1. ✅ Secrets are ready - you can deploy your application${NC}"
    echo "2. Test OAuth flows after deployment"
    echo "3. Monitor application logs for any credential-related errors"
else
    echo -e "${YELLOW}1. ⚠️  Complete the missing secrets setup first${NC}"
    echo "2. Run the setup script to create missing secrets"
    echo "3. Re-run this validation script to confirm"
fi

echo ""
echo -e "${CYAN}For detailed instructions, see: SOCIAL_MEDIA_API_SETUP.md${NC}"
