# Production Environment Configuration
project_id  = "social-soloboss-ai-automation-prod"
region      = "us-central1"
environment = "production"

# Notification settings
notification_email  = "alerts@sma-platform.com"
slack_webhook_url   = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Backup settings
backup_retention_days = 90
backup_schedule      = "0 2 * * *"  # Daily at 2 AM

# Custom domain
custom_domain = "sma-platform.com"