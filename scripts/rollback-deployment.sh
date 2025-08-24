#!/bin/bash

# Automated Rollback Script for Social Media Automation Platform
# Usage: ./rollback-deployment.sh <environment> [version]

set -euo pipefail

ENVIRONMENT=${1:-staging}
TARGET_VERSION=${2:-}
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

# Function to get deployment history
get_deployment_history() {
    local deployment_name=$1
    kubectl rollout history deployment/"$deployment_name" -n "$NAMESPACE" --output=json
}

# Function to get previous stable version
get_previous_stable_version() {
    local deployment_name=$1
    
    # Get the rollout history and find the previous revision
    local history=$(kubectl rollout history deployment/"$deployment_name" -n "$NAMESPACE" --output=json)
    local current_revision=$(echo "$history" | jq -r '.metadata.generation')
    local previous_revision=$((current_revision - 1))
    
    if [[ $previous_revision -gt 0 ]]; then
        echo "$previous_revision"
    else
        error "No previous revision found for $deployment_name"
        return 1
    fi
}

# Function to create deployment backup
create_deployment_backup() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_dir="backups/deployments/${ENVIRONMENT}/${timestamp}"
    
    log "Creating deployment backup in $backup_dir..."
    mkdir -p "$backup_dir"
    
    # Backup current deployments
    kubectl get deployment sma-backend-blue -n "$NAMESPACE" -o yaml > "$backup_dir/backend-blue.yaml" 2>/dev/null || true
    kubectl get deployment sma-backend-green -n "$NAMESPACE" -o yaml > "$backup_dir/backend-green.yaml" 2>/dev/null || true
    kubectl get deployment sma-frontend-blue -n "$NAMESPACE" -o yaml > "$backup_dir/frontend-blue.yaml" 2>/dev/null || true
    kubectl get deployment sma-frontend-green -n "$NAMESPACE" -o yaml > "$backup_dir/frontend-green.yaml" 2>/dev/null || true
    
    # Backup services
    kubectl get service -n "$NAMESPACE" -o yaml > "$backup_dir/services.yaml"
    
    # Backup configmaps and secrets
    kubectl get configmap -n "$NAMESPACE" -o yaml > "$backup_dir/configmaps.yaml"
    kubectl get secret -n "$NAMESPACE" -o yaml > "$backup_dir/secrets.yaml"
    
    success "Deployment backup created in $backup_dir"
    echo "$backup_dir"
}

# Function to rollback to previous version
rollback_to_previous() {
    local deployment_name=$1
    local target_revision=${2:-}
    
    log "Rolling back $deployment_name..."
    
    if [[ -n "$target_revision" ]]; then
        kubectl rollout undo deployment/"$deployment_name" --to-revision="$target_revision" -n "$NAMESPACE"
    else
        kubectl rollout undo deployment/"$deployment_name" -n "$NAMESPACE"
    fi
    
    # Wait for rollback to complete
    kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout=300s
    
    success "$deployment_name rolled back successfully"
}

# Function to verify rollback health
verify_rollback_health() {
    local max_attempts=30
    local attempt=1
    
    log "Verifying rollback health..."
    
    # Get service endpoints
    local backend_endpoint=$(kubectl get service sma-backend -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    # If load balancer IP is not available, use port-forward
    if [[ -z "$backend_endpoint" ]]; then
        kubectl port-forward service/sma-backend 8080:3001 -n "$NAMESPACE" &
        local port_forward_pid=$!
        sleep 5
        backend_endpoint="localhost:8080"
    fi
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts"
        
        if curl -f -s "http://${backend_endpoint}/health" > /dev/null; then
            success "Rollback health check passed"
            
            # Kill port-forward if it was used
            if [[ -n "${port_forward_pid:-}" ]]; then
                kill $port_forward_pid 2>/dev/null || true
            fi
            
            return 0
        fi
        
        log "Health check failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    # Kill port-forward if it was used
    if [[ -n "${port_forward_pid:-}" ]]; then
        kill $port_forward_pid 2>/dev/null || true
    fi
    
    error "Rollback health checks failed after $max_attempts attempts"
    return 1
}

# Function to send rollback notification
send_rollback_notification() {
    local reason=${1:-"Manual rollback"}
    local webhook_url=${2:-}
    
    if [[ -n "$webhook_url" ]]; then
        curl -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"🔄 Rollback initiated for $ENVIRONMENT environment\",
                \"attachments\": [{
                    \"color\": \"warning\",
                    \"fields\": [{
                        \"title\": \"Environment\",
                        \"value\": \"$ENVIRONMENT\",
                        \"short\": true
                    }, {
                        \"title\": \"Reason\",
                        \"value\": \"$reason\",
                        \"short\": true
                    }, {
                        \"title\": \"Initiated by\",
                        \"value\": \"$(whoami)\",
                        \"short\": true
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                        \"short\": true
                    }]
                }]
            }" || warn "Failed to send rollback notification"
    fi
}

# Function to update monitoring and alerting
update_monitoring() {
    log "Updating monitoring dashboards..."
    
    # Update deployment status in monitoring system
    curl -X POST "${MONITORING_WEBHOOK:-}" \
        -H "Content-Type: application/json" \
        -d "{
            \"environment\": \"$ENVIRONMENT\",
            \"status\": \"rolled_back\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"version\": \"previous\"
        }" 2>/dev/null || warn "Failed to update monitoring system"
    
    success "Monitoring dashboards updated"
}

# Function to perform emergency rollback
emergency_rollback() {
    warn "Performing emergency rollback..."
    
    # Get current active color
    local active_color=$(kubectl get service sma-backend -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "")
    
    if [[ -z "$active_color" ]]; then
        error "Cannot determine active deployment color"
        return 1
    fi
    
    # Determine inactive color
    local inactive_color
    if [[ "$active_color" == "blue" ]]; then
        inactive_color="green"
    else
        inactive_color="blue"
    fi
    
    log "Current active: $active_color, switching to: $inactive_color"
    
    # Check if inactive deployment exists and is healthy
    if kubectl get deployment "sma-backend-${inactive_color}" -n "$NAMESPACE" &>/dev/null; then
        local replicas=$(kubectl get deployment "sma-backend-${inactive_color}" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        
        if [[ "$replicas" -gt 0 ]]; then
            log "Switching traffic to $inactive_color deployment..."
            
            # Switch traffic
            kubectl patch service sma-backend -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"version\":\"$inactive_color\"}}}"
            kubectl patch service sma-frontend -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"version\":\"$inactive_color\"}}}"
            
            success "Emergency rollback completed - traffic switched to $inactive_color"
            return 0
        fi
    fi
    
    # If blue-green rollback is not possible, try standard rollback
    warn "Blue-green rollback not possible, attempting standard rollback..."
    rollback_to_previous "sma-backend"
    rollback_to_previous "sma-frontend"
}

# Main rollback logic
main() {
    log "Starting rollback for environment: $ENVIRONMENT"
    
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
    
    # Create backup before rollback
    local backup_dir=$(create_deployment_backup)
    
    # Send rollback notification
    send_rollback_notification "Automated rollback initiated" "${SLACK_WEBHOOK:-}"
    
    # Perform rollback based on deployment strategy
    if kubectl get deployment sma-backend-blue -n "$NAMESPACE" &>/dev/null && kubectl get deployment sma-backend-green -n "$NAMESPACE" &>/dev/null; then
        log "Blue-green deployment detected, performing blue-green rollback..."
        emergency_rollback
    else
        log "Standard deployment detected, performing standard rollback..."
        
        if [[ -n "$TARGET_VERSION" ]]; then
            rollback_to_previous "sma-backend" "$TARGET_VERSION"
            rollback_to_previous "sma-frontend" "$TARGET_VERSION"
        else
            rollback_to_previous "sma-backend"
            rollback_to_previous "sma-frontend"
        fi
    fi
    
    # Verify rollback health
    if ! verify_rollback_health; then
        error "Rollback health verification failed"
        warn "Manual intervention may be required"
        exit 1
    fi
    
    # Update monitoring
    update_monitoring
    
    success "Rollback completed successfully!"
    success "Backup location: $backup_dir"
    
    # Final notification
    send_rollback_notification "Rollback completed successfully" "${SLACK_WEBHOOK:-}"
    
    log "Rollback Summary:"
    log "  Environment: $ENVIRONMENT"
    log "  Target Version: ${TARGET_VERSION:-previous}"
    log "  Backup Location: $backup_dir"
    log "  Status: Success"
}

# Show usage if no arguments provided
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <environment> [version]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (staging, production)"
    echo "  version        Optional: specific version to rollback to"
    echo ""
    echo "Examples:"
    echo "  $0 staging                    # Rollback to previous version"
    echo "  $0 production 123             # Rollback to specific revision"
    echo ""
    echo "Environment Variables:"
    echo "  SLACK_WEBHOOK                 # Slack webhook for notifications"
    echo "  MONITORING_WEBHOOK            # Monitoring system webhook"
    exit 1
fi

# Trap to handle cleanup on script exit
cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Rollback failed with exit code $exit_code"
        send_rollback_notification "Rollback failed" "${SLACK_WEBHOOK:-}"
    fi
}

trap cleanup_on_exit EXIT

# Run main function
main "$@"