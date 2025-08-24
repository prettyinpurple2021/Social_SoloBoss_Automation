#!/bin/bash

# Blue-Green Deployment Script for Social Media Automation Platform
# Usage: ./blue-green-deploy.sh <environment> <backend-image> <frontend-image>

set -euo pipefail

ENVIRONMENT=${1:-staging}
BACKEND_IMAGE=${2:-}
FRONTEND_IMAGE=${3:-}
NAMESPACE="sma-${ENVIRONMENT}"
TIMEOUT=300 # 5 minutes timeout

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

# Validate inputs
if [[ -z "$BACKEND_IMAGE" || -z "$FRONTEND_IMAGE" ]]; then
    error "Backend and frontend images are required"
    echo "Usage: $0 <environment> <backend-image> <frontend-image>"
    exit 1
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    error "kubectl is not configured or cluster is not accessible"
    exit 1
fi

# Create namespace if it doesn't exist
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Function to get current active color
get_active_color() {
    local service_name=$1
    local active_selector=$(kubectl get service "$service_name" -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "")
    
    if [[ "$active_selector" == "blue" ]]; then
        echo "blue"
    elif [[ "$active_selector" == "green" ]]; then
        echo "green"
    else
        echo "blue" # Default to blue if no active deployment
    fi
}

# Function to get inactive color
get_inactive_color() {
    local active_color=$1
    if [[ "$active_color" == "blue" ]]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local deployment_name=$1
    local timeout=$2
    
    log "Waiting for deployment $deployment_name to be ready..."
    
    if kubectl wait --for=condition=available --timeout="${timeout}s" deployment/"$deployment_name" -n "$NAMESPACE"; then
        success "Deployment $deployment_name is ready"
        return 0
    else
        error "Deployment $deployment_name failed to become ready within ${timeout}s"
        return 1
    fi
}

# Function to run health checks
run_health_checks() {
    local color=$1
    local max_attempts=30
    local attempt=1
    
    log "Running health checks for $color deployment..."
    
    # Get service endpoints
    local backend_endpoint=$(kubectl get service "sma-backend-${color}" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    local frontend_endpoint=$(kubectl get service "sma-frontend-${color}" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    # If load balancer IPs are not available, use port-forward for testing
    if [[ -z "$backend_endpoint" ]]; then
        log "Load balancer IP not available, using port-forward for health checks"
        kubectl port-forward service/"sma-backend-${color}" 8080:3001 -n "$NAMESPACE" &
        local port_forward_pid=$!
        sleep 5
        backend_endpoint="localhost:8080"
    fi
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts"
        
        # Backend health check
        if curl -f -s "http://${backend_endpoint}/health" > /dev/null; then
            success "Backend health check passed"
            
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
    
    error "Health checks failed after $max_attempts attempts"
    return 1
}

# Function to switch traffic
switch_traffic() {
    local new_color=$1
    
    log "Switching traffic to $new_color deployment..."
    
    # Update backend service
    kubectl patch service sma-backend -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$new_color'"}}}'
    
    # Update frontend service
    kubectl patch service sma-frontend -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$new_color'"}}}'
    
    success "Traffic switched to $new_color deployment"
}

# Function to rollback traffic
rollback_traffic() {
    local old_color=$1
    
    warn "Rolling back traffic to $old_color deployment..."
    
    # Rollback backend service
    kubectl patch service sma-backend -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$old_color'"}}}'
    
    # Rollback frontend service
    kubectl patch service sma-frontend -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$old_color'"}}}'
    
    warn "Traffic rolled back to $old_color deployment"
}

# Function to cleanup old deployment
cleanup_old_deployment() {
    local old_color=$1
    
    log "Cleaning up old $old_color deployment..."
    
    # Scale down old deployments
    kubectl scale deployment "sma-backend-${old_color}" --replicas=0 -n "$NAMESPACE" 2>/dev/null || true
    kubectl scale deployment "sma-frontend-${old_color}" --replicas=0 -n "$NAMESPACE" 2>/dev/null || true
    
    success "Old $old_color deployment scaled down"
}

# Main deployment logic
main() {
    log "Starting blue-green deployment for environment: $ENVIRONMENT"
    log "Backend image: $BACKEND_IMAGE"
    log "Frontend image: $FRONTEND_IMAGE"
    
    # Get current active color
    local active_color=$(get_active_color "sma-backend")
    local inactive_color=$(get_inactive_color "$active_color")
    
    log "Current active color: $active_color"
    log "Deploying to inactive color: $inactive_color"
    
    # Apply Kubernetes manifests for the inactive color
    log "Applying Kubernetes manifests for $inactive_color deployment..."
    
    # Create backend deployment
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sma-backend-${inactive_color}
  namespace: ${NAMESPACE}
  labels:
    app: sma-backend
    version: ${inactive_color}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sma-backend
      version: ${inactive_color}
  template:
    metadata:
      labels:
        app: sma-backend
        version: ${inactive_color}
    spec:
      containers:
      - name: backend
        image: ${BACKEND_IMAGE}
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "${ENVIRONMENT}"
        - name: PORT
          value: "3001"
        envFrom:
        - secretRef:
            name: sma-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
EOF

    # Create frontend deployment
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sma-frontend-${inactive_color}
  namespace: ${NAMESPACE}
  labels:
    app: sma-frontend
    version: ${inactive_color}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sma-frontend
      version: ${inactive_color}
  template:
    metadata:
      labels:
        app: sma-frontend
        version: ${inactive_color}
    spec:
      containers:
      - name: frontend
        image: ${FRONTEND_IMAGE}
        ports:
        - containerPort: 80
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
EOF

    # Create services if they don't exist
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: sma-backend-${inactive_color}
  namespace: ${NAMESPACE}
spec:
  selector:
    app: sma-backend
    version: ${inactive_color}
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: sma-frontend-${inactive_color}
  namespace: ${NAMESPACE}
spec:
  selector:
    app: sma-frontend
    version: ${inactive_color}
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
EOF

    # Create main services if they don't exist
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: sma-backend
  namespace: ${NAMESPACE}
spec:
  selector:
    app: sma-backend
    version: ${active_color}
  ports:
  - port: 3001
    targetPort: 3001
  type: LoadBalancer
---
apiVersion: v1
kind: Service
metadata:
  name: sma-frontend
  namespace: ${NAMESPACE}
spec:
  selector:
    app: sma-frontend
    version: ${active_color}
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
EOF

    # Wait for deployments to be ready
    if ! wait_for_deployment "sma-backend-${inactive_color}" $TIMEOUT; then
        error "Backend deployment failed"
        exit 1
    fi
    
    if ! wait_for_deployment "sma-frontend-${inactive_color}" $TIMEOUT; then
        error "Frontend deployment failed"
        exit 1
    fi
    
    # Run health checks on the new deployment
    if ! run_health_checks "$inactive_color"; then
        error "Health checks failed for $inactive_color deployment"
        exit 1
    fi
    
    # Switch traffic to the new deployment
    switch_traffic "$inactive_color"
    
    # Wait a bit and run health checks on the live traffic
    log "Waiting 30 seconds before final health check..."
    sleep 30
    
    if ! run_health_checks "$inactive_color"; then
        error "Final health check failed, rolling back..."
        rollback_traffic "$active_color"
        exit 1
    fi
    
    # Cleanup old deployment
    cleanup_old_deployment "$active_color"
    
    success "Blue-green deployment completed successfully!"
    success "New active color: $inactive_color"
    
    # Output deployment information
    log "Deployment Summary:"
    log "  Environment: $ENVIRONMENT"
    log "  Backend Image: $BACKEND_IMAGE"
    log "  Frontend Image: $FRONTEND_IMAGE"
    log "  Active Color: $inactive_color"
    log "  Previous Color: $active_color (scaled down)"
}

# Trap to handle cleanup on script exit
cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Deployment failed with exit code $exit_code"
        # Additional cleanup if needed
    fi
}

trap cleanup_on_exit EXIT

# Run main function
main "$@"