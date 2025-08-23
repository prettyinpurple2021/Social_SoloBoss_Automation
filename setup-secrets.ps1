# Social Media API Credentials Setup Script for Google Cloud Secret Manager
# This script helps you create and configure secrets for your social media integrations

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$false)]
    [string]$Domain = "your-domain.com"
)

Write-Host "🚀 Setting up Social Media API Credentials for Google Cloud Secret Manager" -ForegroundColor Green
Write-Host "Project ID: $ProjectId" -ForegroundColor Yellow
Write-Host "Domain: $Domain" -ForegroundColor Yellow
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

# Function to create secret with user input
function Create-Secret {
    param(
        [string]$SecretName,
        [string]$Description,
        [string]$Prompt
    )
    
    Write-Host ""
    Write-Host "🔐 Creating secret: $SecretName" -ForegroundColor Cyan
    Write-Host "Description: $Description" -ForegroundColor Gray
    
    $value = Read-Host $Prompt
    
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "⚠️  Skipping $SecretName (empty value)" -ForegroundColor Yellow
        return $false
    }
    
    try {
        echo $value | gcloud secrets create $SecretName --data-file=-
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Created secret: $SecretName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to create secret: $SecretName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error creating secret: $SecretName" -ForegroundColor Red
        return $false
    }
}

# Function to create redirect URI secret
function Create-RedirectUriSecret {
    param(
        [string]$Platform,
        [string]$Domain
    )
    
    $secretName = "$Platform-redirect-uri"
    $redirectUri = "https://$Domain/api/oauth/$Platform/callback"
    
    Write-Host ""
    Write-Host "🔐 Creating redirect URI secret: $secretName" -ForegroundColor Cyan
    Write-Host "Redirect URI: $redirectUri" -ForegroundColor Gray
    
    try {
        echo $redirectUri | gcloud secrets create $secretName --data-file=-
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Created redirect URI secret: $secretName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to create redirect URI secret: $secretName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error creating redirect URI secret: $secretName" -ForegroundColor Red
        return $false
    }
}

Write-Host "📝 Please provide your social media API credentials:" -ForegroundColor Yellow
Write-Host ""

# Facebook OAuth Credentials
$facebookClientId = Create-Secret -SecretName "facebook-client-id" -Description "Facebook OAuth Client ID" -Prompt "Enter your Facebook App ID (Client ID)"
$facebookClientSecret = Create-Secret -SecretName "facebook-client-secret" -Description "Facebook OAuth Client Secret" -Prompt "Enter your Facebook App Secret (Client Secret)"

# Instagram OAuth Credentials (same as Facebook for most cases)
$instagramClientId = Create-Secret -SecretName "instagram-client-id" -Description "Instagram OAuth Client ID" -Prompt "Enter your Instagram App ID (usually same as Facebook)"
$instagramClientSecret = Create-Secret -SecretName "instagram-client-secret" -Description "Instagram OAuth Client Secret" -Prompt "Enter your Instagram App Secret (usually same as Facebook)"

# Pinterest OAuth Credentials
$pinterestClientId = Create-Secret -SecretName "pinterest-client-id" -Description "Pinterest OAuth Client ID" -Prompt "Enter your Pinterest App ID (Client ID)"
$pinterestClientSecret = Create-Secret -SecretName "pinterest-client-secret" -Description "Pinterest OAuth Client Secret" -Prompt "Enter your Pinterest App Secret (Client Secret)"

# X (Twitter) OAuth Credentials
$xClientId = Create-Secret -SecretName "x-client-id" -Description "X (Twitter) OAuth Client ID" -Prompt "Enter your X (Twitter) API Key (Client ID)"
$xClientSecret = Create-Secret -SecretName "x-client-secret" -Description "X (Twitter) OAuth Client Secret" -Prompt "Enter your X (Twitter) API Secret (Client Secret)"

# SoloBoss API Credentials
$solobossApiKey = Create-Secret -SecretName "soloboss-api-key" -Description "SoloBoss API Key" -Prompt "Enter your SoloBoss API Key"
$solobossWebhookSecret = Create-Secret -SecretName "soloboss-webhook-secret" -Description "SoloBoss Webhook Secret" -Prompt "Enter your SoloBoss Webhook Secret"

# Create redirect URI secrets
Write-Host ""
Write-Host "🔗 Creating OAuth redirect URI secrets..." -ForegroundColor Cyan

Create-RedirectUriSecret -Platform "facebook" -Domain $Domain
Create-RedirectUriSecret -Platform "instagram" -Domain $Domain
Create-RedirectUriSecret -Platform "pinterest" -Domain $Domain
Create-RedirectUriSecret -Platform "x" -Domain $Domain

# List all created secrets
Write-Host ""
Write-Host "📋 Summary of created secrets:" -ForegroundColor Green
gcloud secrets list --filter="name:projects/$ProjectId/secrets/*"

# Generate environment variables configuration
Write-Host ""
Write-Host "🔧 Environment Variables Configuration:" -ForegroundColor Green
Write-Host "Add these to your deployment configuration:" -ForegroundColor Yellow
Write-Host ""

$envVars = @"
# Facebook OAuth
FACEBOOK_CLIENT_ID=projects/$ProjectId/secrets/facebook-client-id/versions/latest
FACEBOOK_CLIENT_SECRET=projects/$ProjectId/secrets/facebook-client-secret/versions/latest
FACEBOOK_REDIRECT_URI=projects/$ProjectId/secrets/facebook-redirect-uri/versions/latest

# Instagram OAuth
INSTAGRAM_CLIENT_ID=projects/$ProjectId/secrets/instagram-client-id/versions/latest
INSTAGRAM_CLIENT_SECRET=projects/$ProjectId/secrets/instagram-client-secret/versions/latest
INSTAGRAM_REDIRECT_URI=projects/$ProjectId/secrets/instagram-redirect-uri/versions/latest

# Pinterest OAuth
PINTEREST_CLIENT_ID=projects/$ProjectId/secrets/pinterest-client-id/versions/latest
PINTEREST_CLIENT_SECRET=projects/$ProjectId/secrets/pinterest-client-secret/versions/latest
PINTEREST_REDIRECT_URI=projects/$ProjectId/secrets/pinterest-redirect-uri/versions/latest

# X (Twitter) OAuth
X_CLIENT_ID=projects/$ProjectId/secrets/x-client-id/versions/latest
X_CLIENT_SECRET=projects/$ProjectId/secrets/x-client-secret/versions/latest
X_REDIRECT_URI=projects/$ProjectId/secrets/x-redirect-uri/versions/latest

# SoloBoss API
SOLOBOSS_API_KEY=projects/$ProjectId/secrets/soloboss-api-key/versions/latest
SOLOBOSS_WEBHOOK_SECRET=projects/$ProjectId/secrets/soloboss-webhook-secret/versions/latest
"@

Write-Host $envVars -ForegroundColor Cyan

# Save environment variables to file
$envFile = "social-media-secrets.env"
$envVars | Out-File -FilePath $envFile -Encoding UTF8
Write-Host ""
Write-Host "💾 Environment variables saved to: $envFile" -ForegroundColor Green

# Next steps
Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update your deployment configuration with the environment variables above" -ForegroundColor White
Write-Host "2. Ensure your service account has Secret Manager access:" -ForegroundColor White
Write-Host "   gcloud projects add-iam-policy-binding $ProjectId --member='serviceAccount:YOUR_SERVICE_ACCOUNT@$ProjectId.iam.gserviceaccount.com' --role='roles/secretmanager.secretAccessor'" -ForegroundColor Gray
Write-Host "3. Test your OAuth flows" -ForegroundColor White
Write-Host "4. Monitor application logs for any credential-related errors" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see: SOCIAL_MEDIA_API_SETUP.md" -ForegroundColor Cyan
