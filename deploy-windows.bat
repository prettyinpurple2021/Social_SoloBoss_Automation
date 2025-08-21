@echo off
REM Social SoloBoss Automation - Windows Deployment Script

echo.
echo ========================================
echo  Social SoloBoss Automation Deployment
echo ========================================
echo.

REM Configuration
set PROJECT_ID=social-soloboss-ai-automation
set REGION=us-central1
set ENVIRONMENT=prod

echo Project ID: %PROJECT_ID%
echo Region: %REGION%
echo Environment: %ENVIRONMENT%
echo.

REM Check if gcloud is installed
gcloud --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: gcloud CLI is not installed or not in PATH
    echo Please install Google Cloud SDK first
    pause
    exit /b 1
)

REM Check if terraform is installed
terraform --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Terraform is not installed or not in PATH
    echo Please install Terraform first
    pause
    exit /b 1
)

echo Setting up Google Cloud project...
gcloud config set project %PROJECT_ID%

echo.
echo Enabling required Google Cloud APIs...
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudscheduler.googleapis.com

echo.
echo Initializing Terraform...
cd terraform
terraform init

echo.
echo Planning Terraform deployment...
terraform plan -var="project_id=%PROJECT_ID%" -var="region=%REGION%" -var="environment=%ENVIRONMENT%"

echo.
set /p CONTINUE="Do you want to proceed with the deployment? (y/N): "
if /i not "%CONTINUE%"=="y" (
    echo Deployment cancelled.
    pause
    exit /b 1
)

echo.
echo Applying Terraform configuration...
terraform apply -var="project_id=%PROJECT_ID%" -var="region=%REGION%" -var="environment=%ENVIRONMENT%" -auto-approve

echo.
echo Getting infrastructure details...
for /f "delims=" %%i in ('terraform output -raw database_connection_string') do set DB_CONNECTION=%%i
for /f "delims=" %%i in ('terraform output -raw redis_host') do set REDIS_HOST=%%i
for /f "delims=" %%i in ('terraform output -raw redis_port') do set REDIS_PORT=%%i
for /f "delims=" %%i in ('terraform output -raw service_account_email') do set SERVICE_ACCOUNT=%%i

cd ..

echo.
echo Building and deploying application...
gcloud builds submit --config=cloudbuild.yaml

echo.
echo Configuring Cloud Run services...

REM Backend environment variables
gcloud run services update social-soloboss-backend --region=%REGION% --set-env-vars="NODE_ENV=production" --set-env-vars="DATABASE_URL=%DB_CONNECTION%" --set-env-vars="REDIS_URL=redis://%REDIS_HOST%:%REDIS_PORT%" --set-secrets="JWT_SECRET=jwt-secret-%ENVIRONMENT%:latest" --set-secrets="ENCRYPTION_KEY=encryption-key-%ENVIRONMENT%:latest" --service-account=%SERVICE_ACCOUNT%

REM Get backend URL
for /f "delims=" %%i in ('gcloud run services describe social-soloboss-backend --region=%REGION% --format="value(status.url)"') do set BACKEND_URL=%%i

REM Frontend environment variables
gcloud run services update social-soloboss-frontend --region=%REGION% --set-env-vars="VITE_API_URL=%BACKEND_URL%/api" --set-env-vars="VITE_APP_NAME=Social SoloBoss Automation"

REM Get frontend URL
for /f "delims=" %%i in ('gcloud run services describe social-soloboss-frontend --region=%REGION% --format="value(status.url)"') do set FRONTEND_URL=%%i

echo.
echo Running database migrations...
gcloud run jobs create social-soloboss-migrate --image=gcr.io/%PROJECT_ID%/social-soloboss-backend:latest --region=%REGION% --set-env-vars="NODE_ENV=production" --set-env-vars="DATABASE_URL=%DB_CONNECTION%" --set-secrets="JWT_SECRET=jwt-secret-%ENVIRONMENT%:latest" --set-secrets="ENCRYPTION_KEY=encryption-key-%ENVIRONMENT%:latest" --service-account=%SERVICE_ACCOUNT% --command="npm" --args="run,db:migrate" --max-retries=3 --parallelism=1 --task-count=1

gcloud run jobs execute social-soloboss-migrate --region=%REGION% --wait

echo.
echo ========================================
echo  DEPLOYMENT COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Application URLs:
echo Frontend: %FRONTEND_URL%
echo Backend API: %BACKEND_URL%/api
echo API Documentation: %BACKEND_URL%/api-docs
echo.
echo Next Steps:
echo 1. Configure social media API credentials in Secret Manager
echo 2. Set up your custom domain (optional)
echo 3. Configure SoloBoss webhook URL: %BACKEND_URL%/api/soloboss/webhook
echo 4. Test the application at: %FRONTEND_URL%
echo.
echo Social SoloBoss Automation is now live!
echo.
pause