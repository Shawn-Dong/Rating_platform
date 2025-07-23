#!/bin/bash

# KSS Rating Platform Deployment Script
# This script handles production deployment with Docker

set -e

echo "Starting KSS Rating Platform deployment..."

# Configuration
ENVIRONMENT=${1:-production}
IMAGE_TAG=${2:-latest}
COMPOSE_FILE="docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        log_error ".env.${ENVIRONMENT} file not found"
        log_info "Please create .env.${ENVIRONMENT} based on .env.example"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Build images
build_images() {
    log_info "Building Docker images..."
    
    # Build backend
    docker build -t kss-backend:${IMAGE_TAG} .
    
    # Build frontend
    docker build -t kss-frontend:${IMAGE_TAG} ./frontend
    
    log_info "Images built successfully"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    
    # Copy environment file
    cp .env.${ENVIRONMENT} .env.production
    
    # Stop existing services
    docker-compose -f ${COMPOSE_FILE} down
    
    # Start services
    docker-compose -f ${COMPOSE_FILE} up -d
    
    log_info "Services deployed successfully"
}

# Health check
health_check() {
    log_info "Performing health checks..."
    
    # Wait for services to start
    sleep 30
    
    # Check backend health
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        log_info "Backend health check passed"
    else
        log_error "Backend health check failed"
        exit 1
    fi
    
    # Check frontend
    if curl -f http://localhost:80/health > /dev/null 2>&1; then
        log_info "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        exit 1
    fi
    
    log_info "All health checks passed"
}

# Initialize database
init_database() {
    log_info "Initializing database..."
    
    # Run database initialization
    docker-compose exec backend npm run init-db
    
    log_info "Database initialized"
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    docker-compose ps
    
    echo ""
    log_info "Access URLs:"
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost:3001"
    echo "  Health Check: http://localhost:3001/api/health"
    echo ""
    log_info "Default Credentials:"
    echo "  Admin: admin / admin123"
    echo "  Scorer: scorer1 / scorer123"
}

# Main deployment process
main() {
    echo "KSS Rating Platform Deployment"
    echo "Environment: ${ENVIRONMENT}"
    echo "Image Tag: ${IMAGE_TAG}"
    echo "==============================================="
    
    check_prerequisites
    build_images
    deploy_services
    health_check
    init_database
    show_status
    
    log_info "Deployment completed successfully!"
}

# Run main function
main "$@" 