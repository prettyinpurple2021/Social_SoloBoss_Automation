# Backup Module for Social Media Automation Platform

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud Region"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "database_instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "backup_schedule" {
  description = "Cron schedule for backups"
  type        = string
  default     = "0 2 * * *" # Daily at 2 AM
}

# Storage bucket for backups
resource "google_storage_bucket" "backup_bucket" {
  name          = "sma-backups-${var.environment}-${random_id.bucket_suffix.hex}"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = var.backup_retention_days
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.backup_key.id
  }

  uniform_bucket_level_access = true

  labels = {
    environment = var.environment
    purpose     = "backups"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# KMS key for backup encryption
resource "google_kms_key_ring" "backup_keyring" {
  name     = "sma-backup-keyring-${var.environment}"
  location = var.region
}

resource "google_kms_crypto_key" "backup_key" {
  name     = "sma-backup-key-${var.environment}"
  key_ring = google_kms_key_ring.backup_keyring.id

  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# Service account for backup operations
resource "google_service_account" "backup_service_account" {
  account_id   = "sma-backup-${var.environment}"
  display_name = "SMA Backup Service Account - ${var.environment}"
  description  = "Service account for automated backup operations"
}

# IAM bindings for backup service account
resource "google_project_iam_member" "backup_sql_admin" {
  project = var.project_id
  role    = "roles/cloudsql.admin"
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

resource "google_project_iam_member" "backup_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

resource "google_project_iam_member" "backup_kms_encrypt_decrypt" {
  project = var.project_id
  role    = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

resource "google_project_iam_member" "backup_compute_admin" {
  project = var.project_id
  role    = "roles/compute.admin"
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

# Cloud Function for automated backups
resource "google_storage_bucket" "function_source" {
  name     = "sma-backup-function-source-${var.environment}-${random_id.function_suffix.hex}"
  location = var.region
}

resource "random_id" "function_suffix" {
  byte_length = 4
}

# Zip the function source code
data "archive_file" "backup_function_zip" {
  type        = "zip"
  output_path = "/tmp/backup-function.zip"
  source {
    content = templatefile("${path.module}/backup-function.py", {
      project_id           = var.project_id
      database_instance    = var.database_instance_name
      backup_bucket        = google_storage_bucket.backup_bucket.name
      environment         = var.environment
    })
    filename = "main.py"
  }
  source {
    content  = file("${path.module}/requirements.txt")
    filename = "requirements.txt"
  }
}

resource "google_storage_bucket_object" "backup_function_source" {
  name   = "backup-function-${random_id.function_suffix.hex}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.backup_function_zip.output_path
}

resource "google_cloudfunctions_function" "backup_function" {
  name        = "sma-backup-${var.environment}"
  description = "Automated backup function for SMA platform"
  runtime     = "python39"

  available_memory_mb   = 256
  source_archive_bucket = google_storage_bucket.function_source.name
  source_archive_object = google_storage_bucket_object.backup_function_source.name
  trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.backup_trigger.name
  }
  timeout     = 540
  entry_point = "backup_handler"

  service_account_email = google_service_account.backup_service_account.email

  environment_variables = {
    PROJECT_ID        = var.project_id
    DATABASE_INSTANCE = var.database_instance_name
    BACKUP_BUCKET     = google_storage_bucket.backup_bucket.name
    ENVIRONMENT       = var.environment
  }
}

# Pub/Sub topic for backup triggers
resource "google_pubsub_topic" "backup_trigger" {
  name = "sma-backup-trigger-${var.environment}"

  labels = {
    environment = var.environment
  }
}

# Cloud Scheduler job for automated backups
resource "google_cloud_scheduler_job" "backup_scheduler" {
  name             = "sma-backup-scheduler-${var.environment}"
  description      = "Automated backup scheduler for SMA platform"
  schedule         = var.backup_schedule
  time_zone        = "UTC"
  attempt_deadline = "600s"

  retry_config {
    retry_count = 3
  }

  pubsub_target {
    topic_name = google_pubsub_topic.backup_trigger.id
    data       = base64encode(jsonencode({
      type        = "scheduled_backup"
      environment = var.environment
      timestamp   = timestamp()
    }))
  }
}

# Cloud Function for backup verification
resource "google_cloudfunctions_function" "backup_verification" {
  name        = "sma-backup-verification-${var.environment}"
  description = "Backup verification function for SMA platform"
  runtime     = "python39"

  available_memory_mb   = 256
  source_archive_bucket = google_storage_bucket.function_source.name
  source_archive_object = google_storage_bucket_object.backup_function_source.name
  trigger {
    event_type = "google.storage.object.finalize"
    resource   = google_storage_bucket.backup_bucket.name
  }
  timeout     = 300
  entry_point = "verify_backup"

  service_account_email = google_service_account.backup_service_account.email

  environment_variables = {
    PROJECT_ID        = var.project_id
    BACKUP_BUCKET     = google_storage_bucket.backup_bucket.name
    ENVIRONMENT       = var.environment
    NOTIFICATION_TOPIC = google_pubsub_topic.backup_notifications.name
  }
}

# Pub/Sub topic for backup notifications
resource "google_pubsub_topic" "backup_notifications" {
  name = "sma-backup-notifications-${var.environment}"

  labels = {
    environment = var.environment
  }
}

# Disaster recovery configuration
resource "google_storage_bucket" "disaster_recovery" {
  name          = "sma-disaster-recovery-${var.environment}-${random_id.dr_suffix.hex}"
  location      = "US" # Multi-region for disaster recovery
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90 # Keep disaster recovery backups for 90 days
    }
    action {
      type = "Delete"
    }
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.backup_key.id
  }

  uniform_bucket_level_access = true

  labels = {
    environment = var.environment
    purpose     = "disaster-recovery"
  }
}

resource "random_id" "dr_suffix" {
  byte_length = 4
}

# Cross-region replication for disaster recovery
resource "google_storage_transfer_job" "disaster_recovery_sync" {
  description = "Sync backups to disaster recovery bucket"

  transfer_spec {
    gcs_data_source {
      bucket_name = google_storage_bucket.backup_bucket.name
    }
    gcs_data_sink {
      bucket_name = google_storage_bucket.disaster_recovery.name
    }
    transfer_options {
      delete_objects_unique_in_sink = false
    }
  }

  schedule {
    schedule_start_date {
      year  = 2024
      month = 1
      day   = 1
    }
    start_time_of_day {
      hours   = 4
      minutes = 0
      seconds = 0
      nanos   = 0
    }
  }
}

# Monitoring for backup operations
resource "google_monitoring_alert_policy" "backup_failure_alert" {
  display_name = "SMA Backup Failure - ${var.environment}"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Backup function execution failed"

    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND resource.labels.function_name=\"sma-backup-${var.environment}\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status!=\"ok\""
      duration        = "60s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }
}

# Outputs
output "backup_bucket_name" {
  description = "Backup storage bucket name"
  value       = google_storage_bucket.backup_bucket.name
}

output "disaster_recovery_bucket_name" {
  description = "Disaster recovery bucket name"
  value       = google_storage_bucket.disaster_recovery.name
}

output "backup_service_account_email" {
  description = "Backup service account email"
  value       = google_service_account.backup_service_account.email
}

output "backup_function_name" {
  description = "Backup Cloud Function name"
  value       = google_cloudfunctions_function.backup_function.name
}

output "kms_key_id" {
  description = "KMS key ID for backup encryption"
  value       = google_kms_crypto_key.backup_key.id
}