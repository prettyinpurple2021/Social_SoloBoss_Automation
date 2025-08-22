@echo off
echo ========================================
echo  Social SoloBoss Automation Deployment
echo ========================================
echo.

set PROJECT_ID=social-soloboss-ai-automation
set REGION=us-central1
set ENVIRONMENT=prod

echo Project ID: %PROJECT_ID%
echo Region: %REGION%
echo Environment: %ENVIRONMENT%
echo.

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
echo Press any key to continue with deployment...
pause

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
echo ========================================
echo  DEPLOYMENT COMPLETED!
echo ========================================
echo.
pause
