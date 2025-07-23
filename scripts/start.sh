#!/bin/bash

# KSS Rating Platform Start Script

set -e

ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.yml"

echo "Starting KSS Rating Platform..."
echo "Environment: ${ENVIRONMENT}"

# Check if environment file exists
if [ ! -f ".env.${ENVIRONMENT}" ]; then
    echo "Error: .env.${ENVIRONMENT} file not found"
    echo "Please create .env.${ENVIRONMENT} based on .env.example"
    exit 1
fi

# Copy environment file
cp .env.${ENVIRONMENT} .env.production

# Start services
echo "Starting Docker containers..."
docker-compose -f ${COMPOSE_FILE} up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 15

# Check service status
echo "Service Status:"
docker-compose ps

echo ""
echo "KSS Rating Platform started successfully!"
echo ""
echo "Access URLs:"
echo "  Frontend: http://localhost"
echo "  Backend API: http://localhost:3001"
echo "  Health Check: http://localhost:3001/api/health"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: ./scripts/stop.sh" 