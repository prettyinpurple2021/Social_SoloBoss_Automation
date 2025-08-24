#!/bin/bash

# Smoke Tests Script for Social Media Automation Platform
# Usage: ./smoke-tests.sh <base_url> [--comprehensive]

set -euo pipefail

BASE_URL=${1:-}
COMPREHENSIVE=${2:-}

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

# Test results tracking
declare -A test_results=(
    ["total"]=0
    ["passed"]=0
    ["failed"]=0
    ["skipped"]=0
)

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=${3:-0}
    local timeout=${4:-30}
    
    test_results["total"]=$((test_results["total"] + 1))
    
    log "Running test: $test_name"
    
    if timeout "$timeout" bash -c "$test_command" &>/dev/null; then
        local result=$?
        if [[ $result -eq $expected_result ]]; then
            success "✓ $test_name"
            test_results["passed"]=$((test_results["passed"] + 1))
            return 0
        else
            error "✗ $test_name (unexpected result: $result)"
            test_results["failed"]=$((test_results["failed"] + 1))
            return 1
        fi
    else
        error "✗ $test_name (timeout or execution error)"
        test_results["failed"]=$((test_results["failed"] + 1))
        return 1
    fi
}

# Function to skip a test
skip_test() {
    local test_name=$1
    local reason=$2
    
    test_results["total"]=$((test_results["total"] + 1))
    test_results["skipped"]=$((test_results["skipped"] + 1))
    
    warn "⊘ $test_name (skipped: $reason)"
}

# Basic health check tests
test_health_endpoints() {
    log "=== Health Endpoint Tests ==="
    
    run_test "Backend health endpoint" \
        "curl -f -s '$BASE_URL/api/health' | jq -e '.status == \"ok\"'"
    
    run_test "Backend health endpoint response time" \
        "curl -f -s -w '%{time_total}' -o /dev/null '$BASE_URL/api/health' | awk '{exit (\$1 > 2.0)}'"
    
    run_test "Frontend root endpoint" \
        "curl -f -s '$BASE_URL/' | grep -q 'Social Media Automation'"
    
    run_test "API documentation endpoint" \
        "curl -f -s '$BASE_URL/api/docs' | grep -q 'swagger'"
}

# Authentication tests
test_authentication() {
    log "=== Authentication Tests ==="
    
    # Test registration endpoint
    run_test "Registration endpoint availability" \
        "curl -f -s -X POST '$BASE_URL/api/auth/register' -H 'Content-Type: application/json' -d '{}' | jq -e '.error'"
    
    # Test login endpoint
    run_test "Login endpoint availability" \
        "curl -f -s -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{}' | jq -e '.error'"
    
    # Test JWT validation endpoint
    run_test "JWT validation endpoint" \
        "curl -f -s '$BASE_URL/api/auth/validate' -H 'Authorization: Bearer invalid_token' | jq -e '.error'"
}

# API endpoint tests
test_api_endpoints() {
    log "=== API Endpoint Tests ==="
    
    # Test posts endpoint (should require authentication)
    run_test "Posts endpoint (unauthorized)" \
        "curl -s '$BASE_URL/api/posts' | jq -e '.error' | grep -q 'Unauthorized'" 1
    
    # Test platforms endpoint
    run_test "Platforms endpoint availability" \
        "curl -f -s '$BASE_URL/api/platforms' | jq -e 'type == \"array\"'"
    
    # Test analytics endpoint (should require authentication)
    run_test "Analytics endpoint (unauthorized)" \
        "curl -s '$BASE_URL/api/analytics' | jq -e '.error' | grep -q 'Unauthorized'" 1
    
    # Test scheduler endpoint
    run_test "Scheduler health endpoint" \
        "curl -f -s '$BASE_URL/api/scheduler/health' | jq -e '.status == \"ok\"'"
}

# Database connectivity tests
test_database_connectivity() {
    log "=== Database Connectivity Tests ==="
    
    # Test database health through API
    run_test "Database connectivity via API" \
        "curl -f -s '$BASE_URL/api/health/database' | jq -e '.database.status == \"connected\"'"
    
    # Test Redis connectivity through API
    run_test "Redis connectivity via API" \
        "curl -f -s '$BASE_URL/api/health/redis' | jq -e '.redis.status == \"connected\"'"
}

# Security tests
test_security_headers() {
    log "=== Security Headers Tests ==="
    
    run_test "HTTPS redirect" \
        "curl -s -I 'http://$(echo $BASE_URL | sed 's|https://||')' | grep -q 'Location: https://'"
    
    run_test "Security headers present" \
        "curl -s -I '$BASE_URL' | grep -q 'X-Content-Type-Options: nosniff'"
    
    run_test "HSTS header present" \
        "curl -s -I '$BASE_URL' | grep -q 'Strict-Transport-Security'"
    
    run_test "CSP header present" \
        "curl -s -I '$BASE_URL' | grep -q 'Content-Security-Policy'"
    
    run_test "X-Frame-Options header present" \
        "curl -s -I '$BASE_URL' | grep -q 'X-Frame-Options'"
}

# Performance tests
test_performance() {
    log "=== Performance Tests ==="
    
    run_test "Frontend load time under 3 seconds" \
        "curl -s -w '%{time_total}' -o /dev/null '$BASE_URL/' | awk '{exit (\$1 > 3.0)}'"
    
    run_test "API response time under 1 second" \
        "curl -s -w '%{time_total}' -o /dev/null '$BASE_URL/api/health' | awk '{exit (\$1 > 1.0)}'"
    
    run_test "Concurrent requests handling" \
        "for i in {1..10}; do curl -f -s '$BASE_URL/api/health' & done; wait"
}

# Integration tests (comprehensive mode only)
test_integrations() {
    log "=== Integration Tests ==="
    
    # Test OAuth endpoints
    run_test "Facebook OAuth endpoint" \
        "curl -f -s '$BASE_URL/api/auth/facebook' | jq -e '.authUrl' | grep -q 'facebook.com'"
    
    run_test "Instagram OAuth endpoint" \
        "curl -f -s '$BASE_URL/api/auth/instagram' | jq -e '.authUrl' | grep -q 'instagram.com'"
    
    run_test "Pinterest OAuth endpoint" \
        "curl -f -s '$BASE_URL/api/auth/pinterest' | jq -e '.authUrl' | grep -q 'pinterest.com'"
    
    run_test "X (Twitter) OAuth endpoint" \
        "curl -f -s '$BASE_URL/api/auth/twitter' | jq -e '.authUrl' | grep -q 'twitter.com'"
}

# Content management tests (comprehensive mode only)
test_content_management() {
    log "=== Content Management Tests ==="
    
    # Test content templates endpoint
    run_test "Content templates endpoint" \
        "curl -s '$BASE_URL/api/templates' | jq -e '.error' | grep -q 'Unauthorized'" 1
    
    # Test content categories endpoint
    run_test "Content categories endpoint" \
        "curl -f -s '$BASE_URL/api/categories' | jq -e 'type == \"array\"'"
    
    # Test webhook endpoints
    run_test "Blogger webhook endpoint" \
        "curl -s -X POST '$BASE_URL/api/webhooks/blogger' -H 'Content-Type: application/json' -d '{}' | jq -e '.error'"
    
    run_test "SoloBoss webhook endpoint" \
        "curl -s -X POST '$BASE_URL/api/webhooks/soloboss' -H 'Content-Type: application/json' -d '{}' | jq -e '.error'"
}

# Mobile and PWA tests (comprehensive mode only)
test_mobile_pwa() {
    log "=== Mobile and PWA Tests ==="
    
    run_test "PWA manifest availability" \
        "curl -f -s '$BASE_URL/manifest.json' | jq -e '.name'"
    
    run_test "Service worker availability" \
        "curl -f -s '$BASE_URL/sw.js' | grep -q 'self.addEventListener'"
    
    run_test "Mobile viewport meta tag" \
        "curl -f -s '$BASE_URL/' | grep -q 'viewport.*width=device-width'"
    
    run_test "Responsive design CSS" \
        "curl -f -s '$BASE_URL/' | grep -q '@media.*max-width'"
}

# Monitoring and metrics tests
test_monitoring() {
    log "=== Monitoring and Metrics Tests ==="
    
    run_test "Metrics endpoint availability" \
        "curl -f -s '$BASE_URL/api/metrics' | jq -e '.uptime'"
    
    run_test "System status endpoint" \
        "curl -f -s '$BASE_URL/api/status' | jq -e '.system.status == \"healthy\"'"
    
    if [[ "$COMPREHENSIVE" == "--comprehensive" ]]; then
        run_test "Prometheus metrics endpoint" \
            "curl -f -s '$BASE_URL/metrics' | grep -q 'http_requests_total'"
    fi
}

# Function to create test report
create_test_report() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local report_file="smoke-test-report-${timestamp}.json"
    
    local success_rate=0
    if [[ ${test_results["total"]} -gt 0 ]]; then
        success_rate=$(echo "scale=4; ${test_results["passed"]} / ${test_results["total"]}" | bc -l)
    fi
    
    cat > "$report_file" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "base_url": "$BASE_URL",
    "comprehensive": $(if [[ "$COMPREHENSIVE" == "--comprehensive" ]]; then echo "true"; else echo "false"; fi),
    "results": {
        "total_tests": ${test_results["total"]},
        "passed": ${test_results["passed"]},
        "failed": ${test_results["failed"]},
        "skipped": ${test_results["skipped"]},
        "success_rate": $success_rate
    },
    "status": "$(if [[ ${test_results["failed"]} -eq 0 ]]; then echo "PASSED"; else echo "FAILED"; fi)"
}
EOF
    
    log "Test report saved to $report_file"
}

# Function to send test results notification
send_test_notification() {
    local webhook_url=${SLACK_WEBHOOK:-}
    
    if [[ -n "$webhook_url" ]]; then
        local success_rate=$(echo "scale=2; ${test_results["passed"]} * 100 / ${test_results["total"]}" | bc -l)
        local status_emoji="✅"
        local color="good"
        
        if [[ ${test_results["failed"]} -gt 0 ]]; then
            status_emoji="❌"
            color="danger"
        fi
        
        curl -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"$status_emoji Smoke Tests Completed\",
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"fields\": [{
                        \"title\": \"Environment\",
                        \"value\": \"$BASE_URL\",
                        \"short\": false
                    }, {
                        \"title\": \"Total Tests\",
                        \"value\": \"${test_results["total"]}\",
                        \"short\": true
                    }, {
                        \"title\": \"Passed\",
                        \"value\": \"${test_results["passed"]}\",
                        \"short\": true
                    }, {
                        \"title\": \"Failed\",
                        \"value\": \"${test_results["failed"]}\",
                        \"short\": true
                    }, {
                        \"title\": \"Success Rate\",
                        \"value\": \"${success_rate}%\",
                        \"short\": true
                    }]
                }]
            }" &>/dev/null || warn "Failed to send test notification"
    fi
}

# Main function
main() {
    if [[ -z "$BASE_URL" ]]; then
        error "Base URL is required"
        echo "Usage: $0 <base_url> [--comprehensive]"
        echo ""
        echo "Examples:"
        echo "  $0 https://staging.sma-platform.com"
        echo "  $0 https://sma-platform.com --comprehensive"
        exit 1
    fi
    
    log "Starting smoke tests for: $BASE_URL"
    if [[ "$COMPREHENSIVE" == "--comprehensive" ]]; then
        log "Running comprehensive test suite"
    else
        log "Running basic test suite"
    fi
    
    # Check if required tools are available
    for tool in curl jq bc; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Run test suites
    test_health_endpoints
    test_authentication
    test_api_endpoints
    test_database_connectivity
    test_security_headers
    test_performance
    test_monitoring
    
    # Run comprehensive tests if requested
    if [[ "$COMPREHENSIVE" == "--comprehensive" ]]; then
        test_integrations
        test_content_management
        test_mobile_pwa
    fi
    
    # Display results
    log "=== Test Results Summary ==="
    log "Total Tests: ${test_results["total"]}"
    log "Passed: ${test_results["passed"]}"
    log "Failed: ${test_results["failed"]}"
    log "Skipped: ${test_results["skipped"]}"
    
    if [[ ${test_results["total"]} -gt 0 ]]; then
        local success_rate=$(echo "scale=2; ${test_results["passed"]} * 100 / ${test_results["total"]}" | bc -l)
        log "Success Rate: ${success_rate}%"
    fi
    
    # Create test report
    create_test_report
    
    # Send notification
    send_test_notification
    
    # Exit with appropriate code
    if [[ ${test_results["failed"]} -eq 0 ]]; then
        success "All smoke tests passed!"
        return 0
    else
        error "${test_results["failed"]} test(s) failed"
        return 1
    fi
}

# Run main function
main "$@"