# Social Media API Credentials Validation Script
# This script validates that all required secrets are properly configured in Google Cloud Secret Manager

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId
)

Write-Host "🔍 Validating Social Media API Credentials in Google Cloud Secret Manager" -ForegroundColor Green
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

# Define required secrets
$requiredSecrets = @(
    @{Name="facebook-client-id"; Description="Facebook OAuth Client ID"},
    @{Name="facebook-client-secret"; Description="Facebook OAuth Client Secret"},
    @{Name="facebook-redirect-uri"; Description="Facebook OAuth Redirect URI"},
    @{Name="instagram-client-id"; Description="Instagram OAuth Client ID"},
    @{Name="instagram-client-secret"; Description="Instagram OAuth Client Secret"},
    @{Name="instagram-redirect-uri"; Description="Instagram OAuth Redirect URI"},
    @{Name="pinterest-client-id"; Description="Pinterest OAuth Client ID"},
    @{Name="pinterest-client-secret"; Description="Pinterest OAuth Client Secret"},
    @{Name="pinterest-redirect-uri"; Description="Pinterest OAuth Redirect URI"},
    @{Name="x-client-id"; Description="X (Twitter) OAuth Client ID"},
    @{Name="x-client-secret"; Description="X (Twitter) OAuth Client Secret"},
    @{Name="x-redirect-uri"; Description="X (Twitter) OAuth Redirect URI"},
    @{Name="soloboss-api-key"; Description="SoloBoss API Key"},
    @{Name="soloboss-webhook-secret"; Description="SoloBoss Webhook Secret"}
)

# Function to validate secret
function Test-Secret {
    param(
        [string]$SecretName,
        [string]$Description
    )
    
    Write-Host "Checking secret: $SecretName" -ForegroundColor Cyan
    Write-Host "Description: $Description" -ForegroundColor Gray
    
    try {
        # Check if secret exists
        $secretExists = gcloud secrets describe $SecretName --format="value(name)" 2>$null
        if ($LASTEXITCODE -eq 0) {
            # Check if secret has a version
            $versionExists = gcloud secrets versions list $SecretName --format="value(name)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $versionExists) {
                Write-Host "✅ Secret exists and has versions" -ForegroundColor Green
                return $true
            } else {
                Write-Host "⚠️  Secret exists but has no versions" -ForegroundColor Yellow
                return $false
            }
        } else {
            Write-Host "❌ Secret does not exist" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error checking secret: $SecretName" -ForegroundColor Red
        return $false
    }
}

# Function to validate redirect URI format
function Test-RedirectUri {
    param(
        [string]$SecretName,
        [string]$Domain
    )
    
    try {
        $redirectUri = gcloud secrets versions access latest --secret=$SecretName 2>$null
        if ($LASTEXITCODE -eq 0) {
            if ($redirectUri -match "^https://[^/]+/api/oauth/[^/]+/callback$") {
                Write-Host "✅ Redirect URI format is valid: $redirectUri" -ForegroundColor Green
                return $true
            } else {
                Write-Host "⚠️  Redirect URI format may be incorrect: $redirectUri" -ForegroundColor Yellow
                return $false
            }
        } else {
            Write-Host "❌ Could not access redirect URI secret" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error validating redirect URI" -ForegroundColor Red
        return $false
    }
}

# Validate all secrets
$validSecrets = 0
$totalSecrets = $requiredSecrets.Count

Write-Host "📋 Validating $totalSecrets required secrets..." -ForegroundColor Cyan
Write-Host ""

foreach ($secret in $requiredSecrets) {
    if (Test-Secret -SecretName $secret.Name -Description $secret.Description) {
        $validSecrets++
        
        # Validate redirect URI format for redirect URI secrets
        if ($secret.Name -match "redirect-uri$") {
            $platform = $secret.Name -replace "-redirect-uri", ""
            Test-RedirectUri -SecretName $secret.Name -Domain "your-domain.com"
        }
    }
    Write-Host ""
}

# Summary
Write-Host "📊 Validation Summary:" -ForegroundColor Green
Write-Host "Valid secrets: $validSecrets/$totalSecrets" -ForegroundColor $(if ($validSecrets -eq $totalSecrets) { "Green" } else { "Yellow" })

if ($validSecrets -eq $totalSecrets) {
    Write-Host "🎉 All secrets are properly configured!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some secrets are missing or misconfigured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To fix missing secrets, run the setup script:" -ForegroundColor Cyan
    Write-Host ".\setup-secrets.ps1 -ProjectId '$ProjectId'" -ForegroundColor Gray
}

# Check service account permissions
Write-Host ""
Write-Host "🔐 Checking service account permissions..." -ForegroundColor Cyan

try {
    $serviceAccounts = gcloud iam service-accounts list --format="value(email)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $serviceAccounts) {
        Write-Host "Found service accounts:" -ForegroundColor Green
        foreach ($sa in $serviceAccounts) {
            Write-Host "  - $sa" -ForegroundColor Gray
            
            # Check if service account has Secret Manager access
            $hasAccess = gcloud projects get-iam-policy $ProjectId --flatten="bindings[].members" --format="value(bindings.role)" --filter="bindings.members:$sa" 2>$null | Select-String "secretmanager"
            if ($hasAccess) {
                Write-Host "    ✅ Has Secret Manager access" -ForegroundColor Green
            } else {
                Write-Host "    ⚠️  May need Secret Manager access" -ForegroundColor Yellow
                Write-Host "    Run: gcloud projects add-iam-policy-binding $ProjectId --member='serviceAccount:$sa' --role='roles/secretmanager.secretAccessor'" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "⚠️  No service accounts found or error checking permissions" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error checking service account permissions" -ForegroundColor Red
}

# Generate environment variables configuration
Write-Host ""
Write-Host "🔧 Environment Variables Configuration:" -ForegroundColor Green
Write-Host "Use these in your deployment configuration:" -ForegroundColor Yellow
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

# Next steps
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
if ($validSecrets -eq $totalSecrets) {
    Write-Host "1. ✅ Secrets are ready - you can deploy your application" -ForegroundColor Green
    Write-Host "2. Test OAuth flows after deployment" -ForegroundColor White
    Write-Host "3. Monitor application logs for any credential-related errors" -ForegroundColor White
} else {
    Write-Host "1. ⚠️  Complete the missing secrets setup first" -ForegroundColor Yellow
    Write-Host "2. Run the setup script to create missing secrets" -ForegroundColor White
    Write-Host "3. Re-run this validation script to confirm" -ForegroundColor White
}

Write-Host ""
Write-Host "For detailed instructions, see: SOCIAL_MEDIA_API_SETUP.md" -ForegroundColor Cyan
