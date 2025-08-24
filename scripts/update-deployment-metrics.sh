#!/bin/bash

# Deployment Metrics Update Script
# Usage: ./update-deployment-metrics.sh [environment] [version]

set -euo pipefail

ENVIRONMENT=${1:-staging}
VERSION=${2:-$(git rev-parse --short HEAD)}
NAMESPACE="sma-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Function to collect deployment metrics
collect_deployment_metrics() {
    log "Collecting deployment metrics for environment: $ENVIRONMENT"
    
    local metrics="{}"
    
    # Basic deployment info
    metrics=$(echo "$metrics" | jq --arg env "$ENVIRONMENT" --arg ver "$VERSION" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '. + {
        environment: $env,
        version: $ver,
        timestamp: $ts
    }')
    
    # Collect pod metrics
    local pod_metrics=$(collect_pod_metrics)
    metrics=$(echo "$metrics" | jq --argjson pods "$pod_metrics" '. + {pods: $pods}')
    
    # Collect service metrics
    local service_metrics=$(collect_service_metrics)
    metrics=$(echo "$metrics" | jq --argjson services "$service_metrics" '. + {services: $services}')
    
    # Collect resource usage
    local resource_metrics=$(collect_resource_metrics)
    metrics=$(echo "$metrics" | jq --argjson resources "$resource_metrics" '. + {resources: $resources}')
    
    # Collect deployment status
    local deployment_status=$(collect_deployment_status)
    metrics=$(echo "$metrics" | jq --argjson deployments "$deployment_status" '. + {deployments: $deployments}')
    
    echo "$metrics"
}

# Function to collect pod metrics
collect_pod_metrics() {
    log "Collecting pod metrics..."
    
    local pod_data=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    local total_pods=$(echo "$pod_data" | jq '.items | length')
    local running_pods=$(echo "$pod_data" | jq '[.items[] | select(.status.phase == "Running")] | length')
    local pending_pods=$(echo "$pod_data" | jq '[.items[] | select(.status.phase == "Pending")] | length')
    local failed_pods=$(echo "$pod_data" | jq '[.items[] | select(.status.phase == "Failed")] | length')
    
    # Calculate restart counts
    local total_restarts=$(echo "$pod_data" | jq '[.items[].status.containerStatuses[]?.restartCount // 0] | add // 0')
    
    # Get pod ages
    local pod_ages=$(echo "$pod_data" | jq -r '.items[] | select(.status.phase == "Running") | .metadata.creationTimestamp' | \
        while read -r timestamp; do
            if [[ -n "$timestamp" ]]; then
                local age_seconds=$(( $(date +%s) - $(date -d "$timestamp" +%s) ))
                echo "$age_seconds"
            fi
        done | jq -s 'if length > 0 then {min: min, max: max, avg: (add / length)} else {min: 0, max: 0, avg: 0} end')
    
    jq -n --argjson total "$total_pods" \
          --argjson running "$running_pods" \
          --argjson pending "$pending_pods" \
          --argjson failed "$failed_pods" \
          --argjson restarts "$total_restarts" \
          --argjson ages "$pod_ages" \
          '{
              total: $total,
              running: $running,
              pending: $pending,
              failed: $failed,
              total_restarts: $restarts,
              ages_seconds: $ages
          }'
}

# Function to collect service metrics
collect_service_metrics() {
    log "Collecting service metrics..."
    
    local service_data=$(kubectl get services -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    local total_services=$(echo "$service_data" | jq '.items | length')
    local loadbalancer_services=$(echo "$service_data" | jq '[.items[] | select(.spec.type == "LoadBalancer")] | length')
    local clusterip_services=$(echo "$service_data" | jq '[.items[] | select(.spec.type == "ClusterIP")] | length')
    
    # Get external IPs
    local external_ips=$(echo "$service_data" | jq -r '.items[] | select(.status.loadBalancer.ingress[]?) | .status.loadBalancer.ingress[].ip' | jq -R . | jq -s .)
    
    jq -n --argjson total "$total_services" \
          --argjson lb "$loadbalancer_services" \
          --argjson cluster "$clusterip_services" \
          --argjson ips "$external_ips" \
          '{
              total: $total,
              load_balancer: $lb,
              cluster_ip: $cluster,
              external_ips: $ips
          }'
}

# Function to collect resource usage metrics
collect_resource_metrics() {
    log "Collecting resource usage metrics..."
    
    # Get resource usage using kubectl top
    local pod_metrics=$(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null || echo "")
    
    local cpu_usage=0
    local memory_usage=0
    local pod_count=0
    
    if [[ -n "$pod_metrics" ]]; then
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                local cpu=$(echo "$line" | awk '{print $2}' | sed 's/m$//')
                local memory=$(echo "$line" | awk '{print $3}' | sed 's/Mi$//')
                
                cpu_usage=$((cpu_usage + cpu))
                memory_usage=$((memory_usage + memory))
                ((pod_count++))
            fi
        done <<< "$pod_metrics"
    fi
    
    # Get node information
    local node_info=$(kubectl get nodes -o json 2>/dev/null | jq '{
        total_nodes: (.items | length),
        ready_nodes: ([.items[] | select(.status.conditions[] | select(.type == "Ready" and .status == "True"))] | length)
    }')
    
    jq -n --argjson cpu "$cpu_usage" \
          --argjson memory "$memory_usage" \
          --argjson pods "$pod_count" \
          --argjson nodes "$node_info" \
          '{
              cpu_millicores: $cpu,
              memory_mb: $memory,
              monitored_pods: $pods,
              nodes: $nodes
          }'
}

# Function to collect deployment status
collect_deployment_status() {
    log "Collecting deployment status..."
    
    local deployment_data=$(kubectl get deployments -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    local deployments=$(echo "$deployment_data" | jq '[.items[] | {
        name: .metadata.name,
        replicas: .spec.replicas,
        ready_replicas: (.status.readyReplicas // 0),
        available_replicas: (.status.availableReplicas // 0),
        updated_replicas: (.status.updatedReplicas // 0),
        conditions: [.status.conditions[]? | {type: .type, status: .status, reason: .reason}]
    }]')
    
    local total_deployments=$(echo "$deployments" | jq 'length')
    local healthy_deployments=$(echo "$deployments" | jq '[.[] | select(.replicas == .ready_replicas and .replicas == .available_replicas)] | length')
    
    jq -n --argjson deps "$deployments" \
          --argjson total "$total_deployments" \
          --argjson healthy "$healthy_deployments" \
          '{
              total: $total,
              healthy: $healthy,
              details: $deps
          }'
}

# Function to send metrics to monitoring system
send_metrics_to_monitoring() {
    local metrics=$1
    
    log "Sending metrics to monitoring system..."
    
    # Send to Prometheus pushgateway if configured
    if [[ -n "${PROMETHEUS_PUSHGATEWAY_URL:-}" ]]; then
        log "Sending metrics to Prometheus pushgateway..."
        
        # Convert metrics to Prometheus format
        local prom_metrics=$(echo "$metrics" | jq -r '
            "# HELP sma_deployment_pods_total Total number of pods\n# TYPE sma_deployment_pods_total gauge\nsma_deployment_pods_total{environment=\"" + .environment + "\",version=\"" + .version + "\"} " + (.pods.total | tostring) + "\n" +
            "# HELP sma_deployment_pods_running Number of running pods\n# TYPE sma_deployment_pods_running gauge\nsma_deployment_pods_running{environment=\"" + .environment + "\",version=\"" + .version + "\"} " + (.pods.running | tostring) + "\n" +
            "# HELP sma_deployment_pods_failed Number of failed pods\n# TYPE sma_deployment_pods_failed gauge\nsma_deployment_pods_failed{environment=\"" + .environment + "\",version=\"" + .version + "\"} " + (.pods.failed | tostring) + "\n" +
            "# HELP sma_deployment_cpu_millicores Total CPU usage in millicores\n# TYPE sma_deployment_cpu_millicores gauge\nsma_deployment_cpu_millicores{environment=\"" + .environment + "\",version=\"" + .version + "\"} " + (.resources.cpu_millicores | tostring) + "\n" +
            "# HELP sma_deployment_memory_mb Total memory usage in MB\n# TYPE sma_deployment_memory_mb gauge\nsma_deployment_memory_mb{environment=\"" + .environment + "\",version=\"" + .version + "\"} " + (.resources.memory_mb | tostring)
        ')
        
        if curl -X POST "$PROMETHEUS_PUSHGATEWAY_URL/metrics/job/sma-deployment/instance/$ENVIRONMENT" \
                -H "Content-Type: text/plain" \
                --data-binary "$prom_metrics" &>/dev/null; then
            success "Metrics sent to Prometheus pushgateway"
        else
            warn "Failed to send metrics to Prometheus pushgateway"
        fi
    fi
    
    # Send to custom webhook if configured
    if [[ -n "${METRICS_WEBHOOK_URL:-}" ]]; then
        log "Sending metrics to custom webhook..."
        
        if curl -X POST "$METRICS_WEBHOOK_URL" \
                -H "Content-Type: application/json" \
                -d "$metrics" &>/dev/null; then
            success "Metrics sent to custom webhook"
        else
            warn "Failed to send metrics to custom webhook"
        fi
    fi
    
    # Send to Google Cloud Monitoring if configured
    if [[ -n "${GOOGLE_CLOUD_PROJECT:-}" ]] && command -v gcloud &>/dev/null; then
        log "Sending metrics to Google Cloud Monitoring..."
        
        # Create custom metrics (simplified example)
        local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        
        # This would require more complex implementation with gcloud monitoring API
        warn "Google Cloud Monitoring integration not fully implemented"
    fi
}

# Function to save metrics locally
save_metrics_locally() {
    local metrics=$1
    
    log "Saving metrics locally..."
    
    # Create metrics directory if it doesn't exist
    mkdir -p "deployment-metrics"
    
    # Save current metrics
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local filename="deployment-metrics/metrics-${ENVIRONMENT}-${timestamp}.json"
    
    echo "$metrics" | jq . > "$filename"
    success "Metrics saved to: $filename"
    
    # Update latest metrics file
    echo "$metrics" | jq . > "deployment-metrics/latest-${ENVIRONMENT}.json"
    
    # Cleanup old metrics files (keep last 50)
    find "deployment-metrics" -name "metrics-${ENVIRONMENT}-*.json" -type f | \
        sort | head -n -50 | xargs -r rm -f
    
    log "Old metrics files cleaned up"
}

# Function to generate metrics summary
generate_metrics_summary() {
    local metrics=$1
    
    log "Generating metrics summary..."
    
    echo ""
    echo "=== Deployment Metrics Summary ==="
    echo "Environment: $(echo "$metrics" | jq -r '.environment')"
    echo "Version: $(echo "$metrics" | jq -r '.version')"
    echo "Timestamp: $(echo "$metrics" | jq -r '.timestamp')"
    echo ""
    
    echo "Pods:"
    echo "  Total: $(echo "$metrics" | jq -r '.pods.total')"
    echo "  Running: $(echo "$metrics" | jq -r '.pods.running')"
    echo "  Pending: $(echo "$metrics" | jq -r '.pods.pending')"
    echo "  Failed: $(echo "$metrics" | jq -r '.pods.failed')"
    echo "  Total Restarts: $(echo "$metrics" | jq -r '.pods.total_restarts')"
    echo ""
    
    echo "Services:"
    echo "  Total: $(echo "$metrics" | jq -r '.services.total')"
    echo "  Load Balancer: $(echo "$metrics" | jq -r '.services.load_balancer')"
    echo "  Cluster IP: $(echo "$metrics" | jq -r '.services.cluster_ip')"
    echo ""
    
    echo "Resources:"
    echo "  CPU (millicores): $(echo "$metrics" | jq -r '.resources.cpu_millicores')"
    echo "  Memory (MB): $(echo "$metrics" | jq -r '.resources.memory_mb')"
    echo "  Monitored Pods: $(echo "$metrics" | jq -r '.resources.monitored_pods')"
    echo ""
    
    echo "Deployments:"
    echo "  Total: $(echo "$metrics" | jq -r '.deployments.total')"
    echo "  Healthy: $(echo "$metrics" | jq -r '.deployments.healthy')"
    echo ""
    
    echo "================================="
}

# Main function
main() {
    log "Starting deployment metrics update"
    log "Environment: $ENVIRONMENT"
    log "Version: $VERSION"
    log "Namespace: $NAMESPACE"
    
    # Check if kubectl is configured
    if ! kubectl cluster-info &> /dev/null; then
        error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    # Collect metrics
    local metrics=$(collect_deployment_metrics)
    
    # Generate summary
    generate_metrics_summary "$metrics"
    
    # Save metrics locally
    save_metrics_locally "$metrics"
    
    # Send metrics to monitoring systems
    send_metrics_to_monitoring "$metrics"
    
    success "Deployment metrics update completed"
}

# Show usage if help is requested
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: $0 [environment] [version]"
    echo ""
    echo "Arguments:"
    echo "  environment   Target environment (default: staging)"
    echo "  version       Deployment version (default: current git commit)"
    echo ""
    echo "Examples:"
    echo "  $0                      # Update metrics for staging with current commit"
    echo "  $0 production           # Update metrics for production"
    echo "  $0 staging v1.2.3       # Update metrics with specific version"
    echo ""
    echo "Environment Variables:"
    echo "  PROMETHEUS_PUSHGATEWAY_URL    # Prometheus pushgateway URL"
    echo "  METRICS_WEBHOOK_URL           # Custom metrics webhook URL"
    echo "  GOOGLE_CLOUD_PROJECT          # Google Cloud project for monitoring"
    exit 0
fi

# Run main function
main "$@"