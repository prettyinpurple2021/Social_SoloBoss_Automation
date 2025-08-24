# Staging Environment Configuration
project_id  = "social-soloboss-ai-automation-staging"
region      = "us-central1"
environment = "staging"

# Notification settings
notification_email  = "devops@sma-platform.com"
slack_webhook_url   = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Backup settings
backup_retention_days = 14
backup_schedule      = "0 3 * * *"  # Daily at 3 AM

# Custom domain (optional)
custom_domain = "staging.sma-platform.com"