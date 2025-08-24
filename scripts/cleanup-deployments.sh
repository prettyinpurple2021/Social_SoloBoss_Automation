#!/bin/bash

# Deployment Cleanup Script
# Usage: ./cleanup-deployments.sh <keep_count> [environment]

set -euo pipefail

KEEP_COUNT=${1:-5}
ENVIRONMENT=${2:-staging}
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

# Function to get deployment revisions
get_deployment_revisions() {
    local deployment_name=$1
    
    kubectl rollout history deployment/"$deployment_name" -n "$NAMESPACE" --output=json 2>/dev/null | \
        jq -r '.items[] | "\(.metadata.annotations."deployment.kubernetes.io/revision") \(.metadata.creationTimestamp)"' | \
        sort -k2 -r
}

# Function to cleanup old replica sets
cleanup_replica_sets() {
    local deployment_name=$1
    
    log "Cleaning up old replica sets for deployment: $deployment_name"
    
    # Get all replica sets for the deployment
    local replica_sets=$(kubectl get rs -n "$NAMESPACE" -l app="$deployment_name" -o json | \
        jq -r '.items[] | select(.status.replicas == 0) | "\(.metadata.name) \(.metadata.creationTimestamp)"' | \
        sort -k2 | head -n -"$KEEP_COUNT")
    
    if [[ -z "$replica_sets" ]]; then
        log "No old replica sets to cleanup for $deployment_name"
        return 0
    fi
    
    local cleanup_count=0
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local rs_name=$(echo "$line" | awk '{print $1}')
            local creation_time=$(echo "$line" | awk '{print $2}')
            
            log "Deleting replica set: $rs_name (created: $creation_time)"
            
            if kubectl delete rs "$rs_name" -n "$NAMESPACE" --ignore-not-found=true; then
                success "Deleted replica set: $rs_name"
                ((cleanup_count++))
            else
                error "Failed to delete replica set: $rs_name"
            fi
        fi
    done <<< "$replica_sets"
    
    log "Cleaned up $cleanup_count replica sets for $deployment_name"
}

# Function to cleanup old config maps
cleanup_config_maps() {
    log "Cleaning up old config maps..."
    
    # Get config maps with creation timestamp, excluding system ones
    local config_maps=$(kubectl get cm -n "$NAMESPACE" -o json | \
        jq -r '.items[] | select(.metadata.name | test("^sma-config-") and (test("-[0-9]{8}-[0-9]{6}$"))) | "\(.metadata.name) \(.metadata.creationTimestamp)"' | \
        sort -k2 | head -n -"$KEEP_COUNT")
    
    if [[ -z "$config_maps" ]]; then
        log "No old config maps to cleanup"
        return 0
    fi
    
    local cleanup_count=0
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local cm_name=$(echo "$line" | awk '{print $1}')
            local creation_time=$(echo "$line" | awk '{print $2}')
            
            log "Deleting config map: $cm_name (created: $creation_time)"
            
            if kubectl delete cm "$cm_name" -n "$NAMESPACE" --ignore-not-found=true; then
                success "Deleted config map: $cm_name"
                ((cleanup_count++))
            else
                error "Failed to delete config map: $cm_name"
            fi
        fi
    done <<< "$config_maps"
    
    log "Cleaned up $cleanup_count config maps"
}

# Function to cleanup old secrets
cleanup_secrets() {
    log "Cleaning up old secrets..."
    
    # Get secrets with creation timestamp, excluding system ones
    local secrets=$(kubectl get secret -n "$NAMESPACE" -o json | \
        jq -r '.items[] | select(.metadata.name | test("^sma-secret-") and (test("-[0-9]{8}-[0-9]{6}$"))) | "\(.metadata.name) \(.metadata.creationTimestamp)"' | \
        sort -k2 | head -n -"$KEEP_COUNT")
    
    if [[ -z "$secrets" ]]; then
        log "No old secrets to cleanup"
        return 0
    fi
    
    local cleanup_count=0
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local secret_name=$(echo "$line" | awk '{print $1}')
            local creation_time=$(echo "$line" | awk '{print $2}')
            
            log "Deleting secret: $secret_name (created: $creation_time)"
            
            if kubectl delete secret "$secret_name" -n "$NAMESPACE" --ignore-not-found=true; then
                success "Deleted secret: $secret_name"
                ((cleanup_count++))
            else
                error "Failed to delete secret: $secret_name"
            fi
        fi
    done <<< "$secrets"
    
    log "Cleaned up $cleanup_count secrets"
}

# Function to cleanup old persistent volume claims
cleanup_pvcs() {
    log "Cleaning up old persistent volume claims..."
    
    # Get PVCs that are not bound or in use
    local pvcs=$(kubectl get pvc -n "$NAMESPACE" -o json | \
        jq -r '.items[] | select(.status.phase != "Bound" or (.metadata.name | test("^sma-backup-") and (test("-[0-9]{8}-[0-9]{6}$")))) | "\(.metadata.name) \(.metadata.creationTimestamp) \(.status.phase)"' | \
        sort -k2 | head -n -"$KEEP_COUNT")
    
    if [[ -z "$pvcs" ]]; then
        log "No old PVCs to cleanup"
        return 0
    fi
    
    local cleanup_count=0
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local pvc_name=$(echo "$line" | awk '{print $1}')
            local creation_time=$(echo "$line" | awk '{print $2}')
            local phase=$(echo "$line" | awk '{print $3}')
            
            # Only delete unbound PVCs or old backup PVCs
            if [[ "$phase" != "Bound" ]] || [[ "$pvc_name" =~ sma-backup- ]]; then
                log "Deleting PVC: $pvc_name (created: $creation_time, phase: $phase)"
                
                if kubectl delete pvc "$pvc_name" -n "$NAMESPACE" --ignore-not-found=true; then
                    success "Deleted PVC: $pvc_name"
                    ((cleanup_count++))
                else
                    error "Failed to delete PVC: $pvc_name"
                fi
            fi
        fi
    done <<< "$pvcs"
    
    log "Cleaned up $cleanup_count PVCs"
}

# Function to cleanup old jobs
cleanup_jobs() {
    log "Cleaning up old jobs..."
    
    # Get completed jobs older than 24 hours
    local jobs=$(kubectl get jobs -n "$NAMESPACE" -o json | \
        jq -r '.items[] | select(.status.conditions[]? | select(.type == "Complete" and .status == "True")) | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 86400)) | "\(.metadata.name) \(.metadata.creationTimestamp)"' | \
        sort -k2)
    
    if [[ -z "$jobs" ]]; then
        log "No old jobs to cleanup"
        return 0
    fi
    
    local cleanup_count=0
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local job_name=$(echo "$line" | awk '{print $1}')
            local creation_time=$(echo "$line" | awk '{print $2}')
            
            log "Deleting job: $job_name (created: $creation_time)"
            
            if kubectl delete job "$job_name" -n "$NAMESPACE" --ignore-not-found=true; then
                success "Deleted job: $job_name"
                ((cleanup_count++))
            else
                error "Failed to delete job: $job_name"
            fi
        fi
    done <<< "$jobs"
    
    log "Cleaned up $cleanup_count jobs"
}

# Function to cleanup old pods
cleanup_old_pods() {
    log "Cleaning up old pods..."
    
    # Get pods that are completed or failed and older than 1 hour
    local pods=$(kubectl get pods -n "$NAMESPACE" -o json | \
        jq -r '.items[] | select(.status.phase == "Succeeded" or .status.phase == "Failed") | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | "\(.metadata.name) \(.metadata.creationTimestamp) \(.status.phase)"' | \
        sort -k2)
    
    if [[ -z "$pods" ]]; then
        log "No old pods to cleanup"
        return 0
    fi
    
    local cleanup_count=0
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local pod_name=$(echo "$line" | awk '{print $1}')
            local creation_time=$(echo "$line" | awk '{print $2}')
            local phase=$(echo "$line" | awk '{print $3}')
            
            log "Deleting pod: $pod_name (created: $creation_time, phase: $phase)"
            
            if kubectl delete pod "$pod_name" -n "$NAMESPACE" --ignore-not-found=true; then
                success "Deleted pod: $pod_name"
                ((cleanup_count++))
            else
                error "Failed to delete pod: $pod_name"
            fi
        fi
    done <<< "$pods"
    
    log "Cleaned up $cleanup_count pods"
}

# Function to display resource usage
display_resource_usage() {
    log "Displaying resource usage summary..."
    
    echo ""
    echo "=== Resource Usage Summary ==="
    
    # Deployments
    local deployment_count=$(kubectl get deployments -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "Deployments: $deployment_count"
    
    # Replica Sets
    local rs_count=$(kubectl get rs -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "Replica Sets: $rs_count"
    
    # Pods
    local pod_count=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "Pods: $pod_count"
    
    # Services
    local service_count=$(kubectl get services -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "Services: $service_count"
    
    # Config Maps
    local cm_count=$(kubectl get cm -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "Config Maps: $cm_count"
    
    # Secrets
    local secret_count=$(kubectl get secrets -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "Secrets: $secret_count"
    
    # PVCs
    local pvc_count=$(kubectl get pvc -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "PVCs: $pvc_count"
    
    # Jobs
    local job_count=$(kubectl get jobs -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    echo "Jobs: $job_count"
    
    echo "=============================="
}

# Main cleanup function
main() {
    log "Starting deployment cleanup for environment: $ENVIRONMENT"
    log "Namespace: $NAMESPACE"
    log "Keep count: $KEEP_COUNT"
    
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
    
    # Display current resource usage
    display_resource_usage
    
    echo ""
    log "Starting cleanup operations..."
    
    # Cleanup different resource types
    local deployments=("sma-backend-blue" "sma-backend-green" "sma-frontend-blue" "sma-frontend-green")
    
    for deployment in "${deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &>/dev/null; then
            cleanup_replica_sets "$deployment"
        fi
    done
    
    cleanup_config_maps
    cleanup_secrets
    cleanup_pvcs
    cleanup_jobs
    cleanup_old_pods
    
    echo ""
    log "Cleanup completed"
    
    # Display final resource usage
    display_resource_usage
    
    success "Deployment cleanup completed successfully"
}

# Show usage if no arguments provided
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <keep_count> [environment]"
    echo ""
    echo "Arguments:"
    echo "  keep_count    Number of recent deployments to keep"
    echo "  environment   Target environment (default: staging)"
    echo ""
    echo "Examples:"
    echo "  $0 5                    # Keep 5 recent deployments in staging"
    echo "  $0 10 production        # Keep 10 recent deployments in production"
    echo ""
    echo "Requirements:"
    echo "  - kubectl must be configured and authenticated"
    echo "  - Appropriate permissions to manage resources in the namespace"
    exit 1
fi

# Validate keep count
if ! [[ "$KEEP_COUNT" =~ ^[0-9]+$ ]] || [[ "$KEEP_COUNT" -lt 1 ]]; then
    error "Keep count must be a positive integer"
    exit 1
fi

# Run main function
main "$@"