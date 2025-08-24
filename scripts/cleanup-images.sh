#!/bin/bash

# Container Image Cleanup Script
# Usage: ./cleanup-images.sh <keep_count>

set -euo pipefail

KEEP_COUNT=${1:-10}
REGISTRY="ghcr.io"
REPOSITORY="social-media-automation"

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

# Function to get image tags sorted by creation date
get_image_tags() {
    local image_name=$1
    
    # Use GitHub CLI to get package versions
    if command -v gh &> /dev/null; then
        gh api "/orgs/$(echo $REPOSITORY | cut -d'/' -f1)/packages/container/${image_name}/versions" \
            --jq '.[] | select(.metadata.container.tags | length > 0) | {id: .id, tags: .metadata.container.tags, created: .created_at}' \
            | jq -s 'sort_by(.created) | reverse'
    else
        error "GitHub CLI (gh) is required for image cleanup"
        exit 1
    fi
}

# Function to delete image version
delete_image_version() {
    local image_name=$1
    local version_id=$2
    local tags=$3
    
    log "Deleting image version: $image_name:$tags (ID: $version_id)"
    
    if gh api -X DELETE "/orgs/$(echo $REPOSITORY | cut -d'/' -f1)/packages/container/${image_name}/versions/${version_id}"; then
        success "Deleted image version: $image_name:$tags"
        return 0
    else
        error "Failed to delete image version: $image_name:$tags"
        return 1
    fi
}

# Function to cleanup images for a specific service
cleanup_service_images() {
    local service_name=$1
    
    log "Cleaning up images for service: $service_name"
    
    # Get all image versions
    local versions=$(get_image_tags "$service_name")
    
    if [[ -z "$versions" || "$versions" == "null" ]]; then
        warn "No images found for service: $service_name"
        return 0
    fi
    
    # Count total versions
    local total_count=$(echo "$versions" | jq length)
    
    if [[ $total_count -le $KEEP_COUNT ]]; then
        log "Service $service_name has $total_count images, keeping all (threshold: $KEEP_COUNT)"
        return 0
    fi
    
    # Get versions to delete (skip the first KEEP_COUNT)
    local versions_to_delete=$(echo "$versions" | jq ".[$KEEP_COUNT:]")
    local delete_count=$(echo "$versions_to_delete" | jq length)
    
    log "Service $service_name: keeping $KEEP_COUNT images, deleting $delete_count images"
    
    # Delete old versions
    local deleted_count=0
    local failed_count=0
    
    echo "$versions_to_delete" | jq -c '.[]' | while read -r version; do
        local version_id=$(echo "$version" | jq -r '.id')
        local tags=$(echo "$version" | jq -r '.tags | join(", ")')
        
        if delete_image_version "$service_name" "$version_id" "$tags"; then
            ((deleted_count++))
        else
            ((failed_count++))
        fi
        
        # Add small delay to avoid rate limiting
        sleep 1
    done
    
    success "Cleanup completed for $service_name: $deleted_count deleted, $failed_count failed"
}

# Function to cleanup dangling images
cleanup_dangling_images() {
    log "Cleaning up dangling images..."
    
    # This would require additional API calls to identify untagged images
    # For now, we'll focus on tagged images cleanup
    warn "Dangling image cleanup not implemented yet"
}

# Function to display storage usage
display_storage_usage() {
    log "Calculating storage usage..."
    
    # This would require API calls to get package sizes
    # GitHub Packages API doesn't provide size information directly
    warn "Storage usage calculation not available via API"
}

# Main cleanup function
main() {
    log "Starting container image cleanup"
    log "Registry: $REGISTRY"
    log "Repository: $REPOSITORY"
    log "Keep count: $KEEP_COUNT"
    
    # Check if GitHub CLI is authenticated
    if ! gh auth status &>/dev/null; then
        error "GitHub CLI is not authenticated. Please run 'gh auth login'"
        exit 1
    fi
    
    # Services to cleanup
    local services=("backend" "frontend")
    
    for service in "${services[@]}"; do
        cleanup_service_images "$service"
        echo ""
    done
    
    # Cleanup dangling images
    cleanup_dangling_images
    
    # Display storage usage
    display_storage_usage
    
    success "Image cleanup completed"
}

# Show usage if no arguments provided
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <keep_count>"
    echo ""
    echo "Arguments:"
    echo "  keep_count    Number of recent images to keep per service"
    echo ""
    echo "Examples:"
    echo "  $0 10         # Keep 10 most recent images per service"
    echo "  $0 5          # Keep 5 most recent images per service"
    echo ""
    echo "Requirements:"
    echo "  - GitHub CLI (gh) must be installed and authenticated"
    echo "  - Appropriate permissions to manage packages"
    exit 1
fi

# Validate keep count
if ! [[ "$KEEP_COUNT" =~ ^[0-9]+$ ]] || [[ "$KEEP_COUNT" -lt 1 ]]; then
    error "Keep count must be a positive integer"
    exit 1
fi

# Run main function
main "$@"