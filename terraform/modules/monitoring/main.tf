# Monitoring Module for Social Media Automation Platform

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

variable "notification_channels" {
  description = "List of notification channel IDs"
  type        = list(string)
  default     = []
}

# Monitoring workspace
resource "google_monitoring_workspace" "workspace" {
  provider = google

  project = var.project_id
}

# Uptime check for backend
resource "google_monitoring_uptime_check_config" "backend_uptime" {
  display_name = "SMA Backend Uptime - ${var.environment}"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/health"
    port         = "443"
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "sma-backend-${var.environment}.${var.region}.run.app"
    }
  }

  content_matchers {
    content = "\"status\":\"ok\""
    matcher = "CONTAINS_STRING"
  }

  depends_on = [google_monitoring_workspace.workspace]
}

# Uptime check for frontend
resource "google_monitoring_uptime_check_config" "frontend_uptime" {
  display_name = "SMA Frontend Uptime - ${var.environment}"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/"
    port         = "443"
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "sma-frontend-${var.environment}.${var.region}.run.app"
    }
  }

  content_matchers {
    content = "Social Media Automation"
    matcher = "CONTAINS_STRING"
  }

  depends_on = [google_monitoring_workspace.workspace]
}

# Alert policy for backend uptime
resource "google_monitoring_alert_policy" "backend_uptime_alert" {
  display_name = "SMA Backend Down - ${var.environment}"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Backend uptime check failed"

    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND resource.labels.host=\"sma-backend-${var.environment}.${var.region}.run.app\""
      duration        = "300s"
      comparison      = "COMPARISON_EQUAL"
      threshold_value = 0

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_monitoring_uptime_check_config.backend_uptime]
}

# Alert policy for frontend uptime
resource "google_monitoring_alert_policy" "frontend_uptime_alert" {
  display_name = "SMA Frontend Down - ${var.environment}"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Frontend uptime check failed"

    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND resource.labels.host=\"sma-frontend-${var.environment}.${var.region}.run.app\""
      duration        = "300s"
      comparison      = "COMPARISON_EQUAL"
      threshold_value = 0

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_monitoring_uptime_check_config.frontend_uptime]
}

# Alert policy for high error rate
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "SMA High Error Rate - ${var.environment}"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "High 5xx error rate"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND metric.labels.response_code_class=\"5xx\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 10

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert policy for high CPU usage
resource "google_monitoring_alert_policy" "high_cpu_usage" {
  display_name = "SMA High CPU Usage - ${var.environment}"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "High CPU utilization"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/cpu/utilizations\" AND resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0.8

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert policy for high memory usage
resource "google_monitoring_alert_policy" "high_memory_usage" {
  display_name = "SMA High Memory Usage - ${var.environment}"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "High memory utilization"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0.9

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert policy for database connection issues
resource "google_monitoring_alert_policy" "database_connection_alert" {
  display_name = "SMA Database Connection Issues - ${var.environment}"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "High database connection count"

    condition_threshold {
      filter          = "metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\" AND resource.type=\"cloudsql_database\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 80

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Custom dashboard
resource "google_monitoring_dashboard" "sma_dashboard" {
  dashboard_json = jsonencode({
    displayName = "SMA Platform Dashboard - ${var.environment}"
    mosaicLayout = {
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Request Count"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["resource.labels.service_name"]
                    }
                  }
                }
                plotType = "LINE"
              }]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Requests/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          xPos   = 6
          widget = {
            title = "Response Latency"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_latencies\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_DELTA"
                      crossSeriesReducer = "REDUCE_PERCENTILE_95"
                      groupByFields      = ["resource.labels.service_name"]
                    }
                  }
                }
                plotType = "LINE"
              }]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Latency (ms)"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          yPos   = 4
          widget = {
            title = "CPU Utilization"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/container/cpu/utilizations\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_MEAN"
                      groupByFields      = ["resource.labels.service_name"]
                    }
                  }
                }
                plotType = "LINE"
              }]
              timeshiftDuration = "0s"
              yAxis = {
                label = "CPU %"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          xPos   = 6
          yPos   = 4
          widget = {
            title = "Memory Utilization"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_MEAN"
                      groupByFields      = ["resource.labels.service_name"]
                    }
                  }
                }
                plotType = "LINE"
              }]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Memory %"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [google_monitoring_workspace.workspace]
}

# Log-based metrics
resource "google_logging_metric" "error_rate_metric" {
  name   = "sma_error_rate_${var.environment}"
  filter = "resource.type=\"cloud_run_revision\" AND severity>=ERROR AND resource.labels.service_name=~\"sma-.*\""

  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "INT64"
    display_name = "SMA Error Rate"
  }

  label_extractors = {
    "service_name" = "EXTRACT(resource.labels.service_name)"
  }
}

# Outputs
output "workspace_name" {
  description = "Monitoring workspace name"
  value       = google_monitoring_workspace.workspace.name
}

output "dashboard_url" {
  description = "Dashboard URL"
  value       = "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.sma_dashboard.id}?project=${var.project_id}"
}

output "uptime_check_ids" {
  description = "Uptime check IDs"
  value = {
    backend  = google_monitoring_uptime_check_config.backend_uptime.uptime_check_id
    frontend = google_monitoring_uptime_check_config.frontend_uptime.uptime_check_id
  }
}