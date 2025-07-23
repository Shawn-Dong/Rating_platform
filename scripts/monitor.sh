#!/bin/bash

# KSS Rating Platform Monitoring Script

ALERT_EMAIL=${1:-"admin@example.com"}
LOG_FILE="./logs/monitor.log"
HEALTH_CHECK_INTERVAL=60

# Create logs directory
mkdir -p ./logs

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a ${LOG_FILE}
}

check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "${url}")
    
    if [ "${response}" = "${expected_status}" ]; then
        log "OK: ${service_name} is healthy (${response})"
        return 0
    else
        log "ERROR: ${service_name} is unhealthy (${response})"
        return 1
    fi
}

check_docker_services() {
    log "Checking Docker services..."
    
    services=$(docker-compose ps --services)
    for service in $services; do
        status=$(docker-compose ps -q $service | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null)
        if [ "$status" = "running" ]; then
            log "OK: Docker service ${service} is running"
        else
            log "ERROR: Docker service ${service} is not running (${status})"
            return 1
        fi
    done
    return 0
}

check_disk_space() {
    log "Checking disk space..."
    
    usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $usage -gt 80 ]; then
        log "WARNING: Disk usage is ${usage}%"
        return 1
    else
        log "OK: Disk usage is ${usage}%"
        return 0
    fi
}

check_memory() {
    log "Checking memory usage..."
    
    memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $memory_usage -gt 90 ]; then
        log "WARNING: Memory usage is ${memory_usage}%"
        return 1
    else
        log "OK: Memory usage is ${memory_usage}%"
        return 0
    fi
}

check_database() {
    log "Checking database connection..."
    
    if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        log "OK: PostgreSQL is accepting connections"
        return 0
    else
        log "ERROR: PostgreSQL is not accepting connections"
        return 1
    fi
}

send_alert() {
    local subject="$1"
    local message="$2"
    
    # Log alert
    log "ALERT: ${subject}"
    
    # Send email if mail command is available
    if command -v mail >/dev/null 2>&1; then
        echo "${message}" | mail -s "${subject}" "${ALERT_EMAIL}"
        log "Alert email sent to ${ALERT_EMAIL}"
    fi
    
    # Could also integrate with Slack, Discord, etc.
}

perform_health_checks() {
    local failed_checks=0
    local check_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    log "Starting health checks at ${check_time}"
    
    # Check web services
    if ! check_service "Backend API" "http://localhost:3001/api/health"; then
        failed_checks=$((failed_checks + 1))
    fi
    
    if ! check_service "Frontend" "http://localhost/health"; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check Docker services
    if ! check_docker_services; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check database
    if ! check_database; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check system resources
    if ! check_disk_space; then
        failed_checks=$((failed_checks + 1))
    fi
    
    if ! check_memory; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Send alerts if there are failures
    if [ $failed_checks -gt 0 ]; then
        send_alert "KSS Platform Health Check Failed" "
Health check failed at ${check_time}
Failed checks: ${failed_checks}

Please check the logs at ${LOG_FILE} for more details.

Service status:
$(docker-compose ps)
"
    fi
    
    log "Health check completed. Failed checks: ${failed_checks}"
    return $failed_checks
}

show_status_dashboard() {
    clear
    echo "=============================================="
    echo "KSS Rating Platform - System Status"
    echo "=============================================="
    echo "Last updated: $(date)"
    echo ""
    
    echo "Services Status:"
    docker-compose ps
    echo ""
    
    echo "System Resources:"
    echo "  CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "  Memory Usage: $(free | awk 'NR==2{printf "%.0f%%", $3*100/$2}')"
    echo "  Disk Usage: $(df / | awk 'NR==2 {print $5}')"
    echo ""
    
    echo "Recent Log Entries:"
    tail -n 5 ${LOG_FILE} 2>/dev/null || echo "No logs available"
    echo ""
    
    echo "Press Ctrl+C to exit monitoring mode"
}

# Main execution
case "${1:-monitor}" in
    "monitor")
        log "Starting monitoring mode..."
        while true; do
            show_status_dashboard
            sleep 30
        done
        ;;
    "check")
        perform_health_checks
        exit $?
        ;;
    "logs")
        tail -f ${LOG_FILE}
        ;;
    "status")
        show_status_dashboard
        read -p "Press Enter to continue..."
        ;;
    *)
        echo "Usage: $0 [monitor|check|logs|status]"
        echo "  monitor - Real-time monitoring dashboard"
        echo "  check   - Perform one-time health check"
        echo "  logs    - Follow monitoring logs"
        echo "  status  - Show current status"
        exit 1
        ;;
esac 