# Simple Facebook Credentials Storage Script
# This script will help you store your Facebook credentials securely

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId
)

Write-Host "🔐 Storing Facebook Credentials in Google Cloud Secret Manager" -ForegroundColor Green
Write-Host "Project ID: $ProjectId" -ForegroundColor Yellow
Write-Host ""

# Check if gcloud is installed and authenticated
try {
    $gcloudVersion = gcloud version --format="value(Google Cloud SDK)" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud not found"
    }
    Write-Host "✅ Google Cloud CLI found: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Google Cloud CLI not found or not authenticated" -ForegroundColor Red
    Write-Host "Please install and authenticate gcloud CLI first:" -ForegroundColor Yellow
    Write-Host "1. Install: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    Write-Host "2. Authenticate: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

# Set the project
Write-Host "Setting project to: $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId

# Enable Secret Manager API
Write-Host "Enabling Secret Manager API..." -ForegroundColor Cyan
gcloud services enable secretmanager.googleapis.com

# Store Facebook credentials
Write-Host ""
Write-Host "🔐 Storing Facebook credentials..." -ForegroundColor Cyan

# Facebook App ID
Write-Host "Creating facebook-client-id secret..." -ForegroundColor Yellow
echo "1506300127310392" | gcloud secrets create facebook-client-id --data-file=-
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Created facebook-client-id secret" -ForegroundColor Green
} else {
    Write-Host "⚠️  facebook-client-id secret might already exist" -ForegroundColor Yellow
}

# Facebook App Secret
Write-Host "Creating facebook-client-secret secret..." -ForegroundColor Yellow
echo "ac18ff2ac205f4d562641461f5741fb2" | gcloud secrets create facebook-client-secret --data-file=-
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Created facebook-client-secret secret" -ForegroundColor Green
} else {
    Write-Host "⚠️  facebook-client-secret secret might already exist" -ForegroundColor Yellow
}

# Create redirect URI secret (using placeholder domain)
Write-Host "Creating facebook-redirect-uri secret..." -ForegroundColor Yellow
echo "https://myapp.com/api/oauth/facebook/callback" | gcloud secrets create facebook-redirect-uri --data-file=-
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Created facebook-redirect-uri secret" -ForegroundColor Green
} else {
    Write-Host "⚠️  facebook-redirect-uri secret might already exist" -ForegroundColor Yellow
}

# List created secrets
Write-Host ""
Write-Host "📋 Facebook secrets created:" -ForegroundColor Green
gcloud secrets list --filter="name:projects/$ProjectId/secrets/facebook-*"

# Generate environment variables
Write-Host ""
Write-Host "🔧 Facebook Environment Variables:" -ForegroundColor Green
Write-Host "Add these to your deployment configuration:" -ForegroundColor Yellow
Write-Host ""

$envVars = @"
# Facebook OAuth
FACEBOOK_CLIENT_ID=projects/$ProjectId/secrets/facebook-client-id/versions/latest
FACEBOOK_CLIENT_SECRET=projects/$ProjectId/secrets/facebook-client-secret/versions/latest
FACEBOOK_REDIRECT_URI=projects/$ProjectId/secrets/facebook-redirect-uri/versions/latest
"@

Write-Host $envVars -ForegroundColor Cyan

# Save to file
$envFile = "facebook-secrets.env"
$envVars | Out-File -FilePath $envFile -Encoding UTF8
Write-Host ""
Write-Host "💾 Environment variables saved to: $envFile" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Facebook credentials stored successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Complete Facebook Login setup in your app dashboard" -ForegroundColor White
Write-Host "2. Add the redirect URI to your Facebook app settings" -ForegroundColor White
Write-Host "3. Continue with other platforms (Instagram, Pinterest, etc.)" -ForegroundColor White
Write-Host ""
Write-Host "Need help finding Facebook Login? Check the left sidebar or try:" -ForegroundColor Cyan
Write-Host "https://developers.facebook.com/apps/1506300127310392/fb-login" -ForegroundColor Gray
