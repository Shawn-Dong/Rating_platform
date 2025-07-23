#!/bin/bash

# KSS Rating Platform Stop Script

COMPOSE_FILE="docker-compose.yml"

echo "Stopping KSS Rating Platform..."

# Stop all services
docker-compose -f ${COMPOSE_FILE} down

echo "Services stopped successfully!"

# Optionally remove volumes (uncomment if needed)
# echo "Removing volumes..."
# docker-compose -f ${COMPOSE_FILE} down -v

echo ""
echo "To start again: ./scripts/start.sh"
echo "To view logs: docker-compose logs" 