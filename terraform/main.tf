# Enhanced Terraform configuration for Social SoloBoss Automation on Google Cloud
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.2"
    }
  }

  # Remote state backend for team collaboration
  backend "gcs" {
    bucket = "sma-terraform-state"
    prefix = "terraform/state"
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
  default     = "us-central1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

# VPC Network for private connectivity
resource "google_compute_network" "vpc" {
  name                    = "social-soloboss-vpc-${var.environment}"
  auto_create_subnetworks = false
  project                 = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_compute_subnetwork" "subnet" {
  name          = "social-soloboss-subnet-${var.environment}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_compute_global_address" "private_ip_address" {
  name          = "social-soloboss-private-ip-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
  project       = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]

  depends_on = [google_project_service.required_apis]
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com"
  ])

  service = each.value
  project = var.project_id

  disable_dependent_services = true
}

# Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "postgres" {
  name             = "social-soloboss-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier                        = "db-f1-micro"
    availability_type          = "ZONAL"
    disk_type                  = "PD_SSD"
    disk_size                  = 20
    disk_autoresize            = true
    disk_autoresize_limit      = 100

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                              = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = false

  depends_on = [
    google_project_service.required_apis,
    google_service_networking_connection.private_vpc_connection
  ]
}

# Database
resource "google_sql_database" "app_database" {
  name     = "social_soloboss_${var.environment}"
  instance = google_sql_database_instance.postgres.name
}

# Database user
resource "google_sql_user" "app_user" {
  name     = "app_user"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Redis instance
resource "google_redis_instance" "cache" {
  name               = "social-soloboss-redis-${var.environment}"
  tier               = "BASIC"
  memory_size_gb     = 1
  region             = var.region
  redis_version      = "REDIS_7_0"
  authorized_network = google_compute_network.vpc.id

  depends_on = [google_project_service.required_apis]
}

# Secret Manager secrets
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret-${var.environment}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret" "encryption_key" {
  secret_id = "encryption-key-${var.environment}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "encryption_key" {
  secret      = google_secret_manager_secret.encryption_key.id
  secret_data = random_password.encryption_key.result
}

resource "random_password" "encryption_key" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password-${var.environment}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Service account for Cloud Run
resource "google_service_account" "app_service_account" {
  account_id   = "social-soloboss-${var.environment}"
  display_name = "Social SoloBoss Automation Service Account"
}

# IAM bindings for service account
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Cloud Scheduler job for post processing
resource "google_cloud_scheduler_job" "post_processor" {
  name             = "social-soloboss-post-processor-${var.environment}"
  description      = "Process scheduled posts every minute"
  schedule         = "* * * * *"
  time_zone        = "UTC"
  attempt_deadline = "60s"

  retry_config {
    retry_count = 3
  }

  http_target {
    http_method = "POST"
    uri         = "https://social-soloboss-backend-uc.a.run.app/api/scheduler/process"
    
    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode(jsonencode({
      source = "cloud-scheduler"
    }))
  }

  depends_on = [google_project_service.required_apis]
}

resource "random_id" "suffix" {
  byte_length = 4
}

# Notification channels for monitoring
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notifications - ${var.environment}"
  type         = "email"
  labels = {
    email_address = var.notification_email
  }
  enabled = true
}

resource "google_monitoring_notification_channel" "slack" {
  count        = var.slack_webhook_url != "" ? 1 : 0
  display_name = "Slack Notifications - ${var.environment}"
  type         = "slack"
  labels = {
    url = var.slack_webhook_url
  }
  enabled = true
}

# Monitoring module
module "monitoring" {
  source = "./modules/monitoring"

  project_id = var.project_id
  region     = var.region
  environment = var.environment
  
  notification_channels = concat(
    [google_monitoring_notification_channel.email.name],
    var.slack_webhook_url != "" ? [google_monitoring_notification_channel.slack[0].name] : []
  )

  depends_on = [google_project_service.required_apis]
}

# Backup module
module "backup" {
  source = "./modules/backup"

  project_id              = var.project_id
  region                  = var.region
  environment            = var.environment
  database_instance_name = google_sql_database_instance.postgres.name
  backup_retention_days  = var.backup_retention_days
  backup_schedule        = var.backup_schedule

  depends_on = [google_project_service.required_apis]
}

# Enhanced security configurations
resource "google_compute_security_policy" "security_policy" {
  name = "sma-security-policy-${var.environment}"

  rule {
    action   = "allow"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  rule {
    action   = "deny(403)"
    priority = "2000"
    match {
      expr {
        expression = "origin.region_code == 'CN'"
      }
    }
    description = "Block traffic from China"
  }

  rule {
    action   = "rate_based_ban"
    priority = "2001"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 600
    }
    description = "Rate limiting rule"
  }
}

# SSL certificate for custom domain
resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  count = var.custom_domain != "" ? 1 : 0
  name  = "sma-ssl-cert-${var.environment}"

  managed {
    domains = [var.custom_domain]
  }
}

# Global load balancer for high availability
resource "google_compute_global_address" "lb_ip" {
  name = "sma-lb-ip-${var.environment}"
}

resource "google_compute_url_map" "url_map" {
  name            = "sma-url-map-${var.environment}"
  default_service = google_compute_backend_service.backend_service.id

  host_rule {
    hosts        = var.custom_domain != "" ? [var.custom_domain] : ["*"]
    path_matcher = "allpaths"
  }

  path_matcher {
    name            = "allpaths"
    default_service = google_compute_backend_service.backend_service.id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.backend_service.id
    }

    path_rule {
      paths   = ["/*"]
      service = google_compute_backend_service.frontend_service.id
    }
  }
}

resource "google_compute_backend_service" "backend_service" {
  name        = "sma-backend-service-${var.environment}"
  protocol    = "HTTP"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg.id
  }

  health_checks = [google_compute_health_check.backend_health.id]
  
  security_policy = google_compute_security_policy.security_policy.id
}

resource "google_compute_backend_service" "frontend_service" {
  name        = "sma-frontend-service-${var.environment}"
  protocol    = "HTTP"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }

  health_checks = [google_compute_health_check.frontend_health.id]
  
  security_policy = google_compute_security_policy.security_policy.id
}

resource "google_compute_region_network_endpoint_group" "backend_neg" {
  name                  = "sma-backend-neg-${var.environment}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = "sma-backend-${var.environment}"
  }
}

resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "sma-frontend-neg-${var.environment}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = "sma-frontend-${var.environment}"
  }
}

resource "google_compute_health_check" "backend_health" {
  name = "sma-backend-health-${var.environment}"

  http_health_check {
    request_path = "/api/health"
    port         = "3001"
  }

  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 2
  unhealthy_threshold = 3
}

resource "google_compute_health_check" "frontend_health" {
  name = "sma-frontend-health-${var.environment}"

  http_health_check {
    request_path = "/"
    port         = "80"
  }

  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 2
  unhealthy_threshold = 3
}

resource "google_compute_target_https_proxy" "https_proxy" {
  name             = "sma-https-proxy-${var.environment}"
  url_map          = google_compute_url_map.url_map.id
  ssl_certificates = var.custom_domain != "" ? [google_compute_managed_ssl_certificate.ssl_cert[0].id] : []
}

resource "google_compute_global_forwarding_rule" "https_forwarding_rule" {
  name       = "sma-https-forwarding-rule-${var.environment}"
  target     = google_compute_target_https_proxy.https_proxy.id
  port_range = "443"
  ip_address = google_compute_global_address.lb_ip.address
}

# Additional variables
variable "notification_email" {
  description = "Email address for monitoring notifications"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "backup_schedule" {
  description = "Cron schedule for backups"
  type        = string
  default     = "0 2 * * *"
}

variable "custom_domain" {
  description = "Custom domain for the application"
  type        = string
  default     = ""
}

# Enhanced outputs
output "database_connection_string" {
  description = "Database connection string"
  value       = "postgresql://${google_sql_user.app_user.name}:${random_password.db_password.result}@${google_sql_database_instance.postgres.connection_name}/${google_sql_database.app_database.name}"
  sensitive   = true
}

output "redis_host" {
  description = "Redis host"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "Redis port"
  value       = google_redis_instance.cache.port
}

output "service_account_email" {
  description = "Service account email"
  value       = google_service_account.app_service_account.email
}

output "load_balancer_ip" {
  description = "Load balancer IP address"
  value       = google_compute_global_address.lb_ip.address
}

output "monitoring_dashboard_url" {
  description = "Monitoring dashboard URL"
  value       = module.monitoring.dashboard_url
}

output "backup_bucket_name" {
  description = "Backup storage bucket name"
  value       = module.backup.backup_bucket_name
}

output "disaster_recovery_bucket_name" {
  description = "Disaster recovery bucket name"
  value       = module.backup.disaster_recovery_bucket_name
}