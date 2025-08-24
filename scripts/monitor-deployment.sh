#!/bin/bash

# Deployment Monitoring Script for Social Media Automation Platform
# Usage: ./monitor-deployment.sh <environment> <duration_seconds> [alert_threshold]

set -euo pipefail

ENVIRONMENT=${1:-staging}
DURATION=${2:-300}  # Default 5 minutes
ALERT_THRESHOLD=${3:-0.95}  # 95% success rate threshold
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

# Monitoring metrics
declare -A metrics=(
    ["total_requests"]=0
    ["successful_requests"]=0
    ["failed_requests"]=0
    ["response_time_sum"]=0
    ["error_5xx"]=0
    ["error_4xx"]=0
    ["cpu_usage_sum"]=0
    ["memory_usage_sum"]=0
    ["pod_restarts"]=0
)

# Function to get service endpoint
get_service_endpoint() {
    local service_name=$1
    local endpoint=$(kubectl get service "$service_name" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [[ -z "$endpoint" ]]; then
        # Try to get cluster IP if load balancer is not available
        endpoint=$(kubectl get service "$service_name" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    fi
    
    echo "$endpoint"
}

# Function to check application health
check_application_health() {
    local endpoint=$1
    local port=$2
    local path=${3:-/health}
    
    local start_time=$(date +%s.%N)
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://${endpoint}:${port}${path}" 2>/dev/null || echo "000")
    local end_time=$(date +%s.%N)
    local response_time=$(echo "$end_time - $start_time" | bc -l)
    
    metrics["total_requests"]=$((metrics["total_requests"] + 1))
    metrics["response_time_sum"]=$(echo "${metrics["response_time_sum"]} + $response_time" | bc -l)
    
    if [[ "$response_code" == "200" ]]; then
        metrics["successful_requests"]=$((metrics["successful_requests"] + 1))
        return 0
    elif [[ "$response_code" =~ ^4[0-9][0-9]$ ]]; then
        metrics["error_4xx"]=$((metrics["error_4xx"] + 1))
        metrics["failed_requests"]=$((metrics["failed_requests"] + 1))
        return 1
    elif [[ "$response_code" =~ ^5[0-9][0-9]$ ]]; then
        metrics["error_5xx"]=$((metrics["error_5xx"] + 1))
        metrics["failed_requests"]=$((metrics["failed_requests"] + 1))
        return 1
    else
        metrics["failed_requests"]=$((metrics["failed_requests"] + 1))
        return 1
    fi
}

# Function to get pod metrics
get_pod_metrics() {
    local app_label=$1
    
    # Get CPU and memory usage
    local pod_metrics=$(kubectl top pods -n "$NAMESPACE" -l app="$app_label" --no-headers 2>/dev/null || echo "")
    
    if [[ -n "$pod_metrics" ]]; then
        while IFS= read -r line; do
            local cpu=$(echo "$line" | awk '{print $2}' | sed 's/m$//')
            local memory=$(echo "$line" | awk '{print $3}' | sed 's/Mi$//')
            
            metrics["cpu_usage_sum"]=$((metrics["cpu_usage_sum"] + cpu))
            metrics["memory_usage_sum"]=$((metrics["memory_usage_sum"] + memory))
        done <<< "$pod_metrics"
    fi
    
    # Get pod restart count
    local restart_count=$(kubectl get pods -n "$NAMESPACE" -l app="$app_label" -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}' 2>/dev/null || echo "0")
    for count in $restart_count; do
        metrics["pod_restarts"]=$((metrics["pod_restarts"] + count))
    done
}

# Function to check database connectivity
check_database_health() {
    log "Checking database connectivity..."
    
    # Get database pod
    local db_pod=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$db_pod" ]]; then
        if kubectl exec "$db_pod" -n "$NAMESPACE" -- pg_isready -U "${DB_USER:-app_user}" &>/dev/null; then
            success "Database connectivity check passed"
            return 0
        else
            error "Database connectivity check failed"
            return 1
        fi
    else
        warn "Database pod not found in namespace $NAMESPACE"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis_health() {
    log "Checking Redis connectivity..."
    
    # Get Redis pod
    local redis_pod=$(kubectl get pods -n "$NAMESPACE" -l app=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$redis_pod" ]]; then
        if kubectl exec "$redis_pod" -n "$NAMESPACE" -- redis-cli ping | grep -q "PONG"; then
            success "Redis connectivity check passed"
            return 0
        else
            error "Redis connectivity check failed"
            return 1
        fi
    else
        warn "Redis pod not found in namespace $NAMESPACE"
        return 1
    fi
}

# Function to check external API connectivity
check_external_apis() {
    log "Checking external API connectivity..."
    
    local apis=(
        "https://graph.facebook.com/v18.0/me"
        "https://api.twitter.com/2/users/me"
        "https://api.pinterest.com/v5/user_account"
    )
    
    local failed_apis=0
    
    for api in "${apis[@]}"; do
        if ! curl -s --max-time 10 "$api" &>/dev/null; then
            warn "Failed to connect to $api"
            ((failed_apis++))
        fi
    done
    
    if [[ $failed_apis -eq 0 ]]; then
        success "All external APIs are reachable"
        return 0
    else
        warn "$failed_apis external APIs are unreachable"
        return 1
    fi
}

# Function to send alert
send_alert() {
    local severity=$1
    local message=$2
    local webhook_url=${3:-$ALERT_WEBHOOK}
    
    if [[ -n "$webhook_url" ]]; then
        local color="warning"
        local emoji="⚠️"
        
        case "$severity" in
            "critical")
                color="danger"
                emoji="🚨"
                ;;
            "warning")
                color="warning"
                emoji="⚠️"
                ;;
            "info")
                color="good"
                emoji="ℹ️"
                ;;
        esac
        
        curl -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"$emoji Deployment Monitor Alert\",
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"fields\": [{
                        \"title\": \"Environment\",
                        \"value\": \"$ENVIRONMENT\",
                        \"short\": true
                    }, {
                        \"title\": \"Severity\",
                        \"value\": \"$severity\",
                        \"short\": true
                    }, {
                        \"title\": \"Message\",
                        \"value\": \"$message\",
                        \"short\": false
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                        \"short\": true
                    }]
                }]
            }" &>/dev/null || warn "Failed to send alert"
    fi
}

# Function to calculate and display metrics
display_metrics() {
    local total_requests=${metrics["total_requests"]}
    local successful_requests=${metrics["successful_requests"]}
    local failed_requests=${metrics["failed_requests"]}
    local response_time_sum=${metrics["response_time_sum"]}
    
    if [[ $total_requests -gt 0 ]]; then
        local success_rate=$(echo "scale=4; $successful_requests / $total_requests" | bc -l)
        local avg_response_time=$(echo "scale=4; $response_time_sum / $total_requests" | bc -l)
        
        log "=== Monitoring Summary ==="
        log "Total Requests: $total_requests"
        log "Successful Requests: $successful_requests"
        log "Failed Requests: $failed_requests"
        log "Success Rate: $(echo "scale=2; $success_rate * 100" | bc -l)%"
        log "Average Response Time: ${avg_response_time}s"
        log "4xx Errors: ${metrics["error_4xx"]}"
        log "5xx Errors: ${metrics["error_5xx"]}"
        log "Pod Restarts: ${metrics["pod_restarts"]}"
        
        # Check if success rate is below threshold
        if (( $(echo "$success_rate < $ALERT_THRESHOLD" | bc -l) )); then
            local success_percentage=$(echo "scale=2; $success_rate * 100" | bc -l)
            send_alert "critical" "Success rate ($success_percentage%) is below threshold ($(echo "scale=2; $ALERT_THRESHOLD * 100" | bc -l)%)"
            return 1
        fi
    else
        warn "No requests monitored during the monitoring period"
        return 1
    fi
    
    return 0
}

# Function to save metrics to file
save_metrics() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local metrics_file="monitoring-results-${ENVIRONMENT}-${timestamp}.json"
    
    cat > "$metrics_file" <<EOF
{
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $DURATION,
    "metrics": {
        "total_requests": ${metrics["total_requests"]},
        "successful_requests": ${metrics["successful_requests"]},
        "failed_requests": ${metrics["failed_requests"]},
        "success_rate": $(echo "scale=4; ${metrics["successful_requests"]} / ${metrics["total_requests"]}" | bc -l 2>/dev/null || echo "0"),
        "average_response_time": $(echo "scale=4; ${metrics["response_time_sum"]} / ${metrics["total_requests"]}" | bc -l 2>/dev/null || echo "0"),
        "error_4xx": ${metrics["error_4xx"]},
        "error_5xx": ${metrics["error_5xx"]},
        "cpu_usage_sum": ${metrics["cpu_usage_sum"]},
        "memory_usage_sum": ${metrics["memory_usage_sum"]},
        "pod_restarts": ${metrics["pod_restarts"]}
    }
}
EOF
    
    log "Metrics saved to $metrics_file"
}

# Main monitoring function
main() {
    log "Starting deployment monitoring for environment: $ENVIRONMENT"
    log "Duration: ${DURATION}s, Alert threshold: $(echo "scale=2; $ALERT_THRESHOLD * 100" | bc -l)%"
    
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
    
    # Get service endpoints
    local backend_endpoint=$(get_service_endpoint "sma-backend")
    local frontend_endpoint=$(get_service_endpoint "sma-frontend")
    
    if [[ -z "$backend_endpoint" ]]; then
        error "Cannot get backend service endpoint"
        exit 1
    fi
    
    log "Backend endpoint: $backend_endpoint"
    log "Frontend endpoint: $frontend_endpoint"
    
    # Initial health checks
    log "Performing initial health checks..."
    
    if ! check_database_health; then
        send_alert "critical" "Database health check failed"
    fi
    
    if ! check_redis_health; then
        send_alert "warning" "Redis health check failed"
    fi
    
    if ! check_external_apis; then
        send_alert "warning" "Some external APIs are unreachable"
    fi
    
    # Start monitoring loop
    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION))
    local check_interval=10  # Check every 10 seconds
    
    log "Starting monitoring loop for ${DURATION}s..."
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # Check application health
        check_application_health "$backend_endpoint" "3001" "/health"
        
        if [[ -n "$frontend_endpoint" ]]; then
            check_application_health "$frontend_endpoint" "80" "/"
        fi
        
        # Get pod metrics
        get_pod_metrics "sma-backend"
        get_pod_metrics "sma-frontend"
        
        # Check for pod restarts
        local current_restarts=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}' 2>/dev/null | tr ' ' '\n' | awk '{sum+=$1} END {print sum+0}')
        
        if [[ $current_restarts -gt ${metrics["pod_restarts"]} ]]; then
            local new_restarts=$((current_restarts - metrics["pod_restarts"]))
            send_alert "warning" "$new_restarts pod restart(s) detected"
            metrics["pod_restarts"]=$current_restarts
        fi
        
        # Progress indicator
        local elapsed=$(($(date +%s) - start_time))
        local progress=$((elapsed * 100 / DURATION))
        echo -ne "\rMonitoring progress: ${progress}% (${elapsed}/${DURATION}s)"
        
        sleep $check_interval
    done
    
    echo "" # New line after progress indicator
    
    # Display final metrics
    if display_metrics; then
        success "Monitoring completed successfully"
        save_metrics
        send_alert "info" "Deployment monitoring completed successfully"
        return 0
    else
        error "Monitoring detected issues"
        save_metrics
        return 1
    fi
}

# Show usage if no arguments provided
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <environment> <duration_seconds> [alert_threshold]"
    echo ""
    echo "Arguments:"
    echo "  environment       Target environment (staging, production)"
    echo "  duration_seconds  Monitoring duration in seconds"
    echo "  alert_threshold   Success rate threshold (0.0-1.0, default: 0.95)"
    echo ""
    echo "Examples:"
    echo "  $0 staging 300           # Monitor staging for 5 minutes"
    echo "  $0 production 600 0.99   # Monitor production for 10 minutes with 99% threshold"
    echo ""
    echo "Environment Variables:"
    echo "  ALERT_WEBHOOK            # Webhook URL for alerts"
    echo "  DB_USER                  # Database user for health checks"
    exit 1
fi

# Trap to handle cleanup on script exit
cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Monitoring failed with exit code $exit_code"
        save_metrics
        send_alert "critical" "Deployment monitoring failed"
    fi
}

trap cleanup_on_exit EXIT

# Run main function
main "$@"