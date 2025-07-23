#!/bin/bash

# KSS Rating Platform Backup Script

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
ENVIRONMENT=${1:-production}

echo "Starting backup process..."
echo "Date: ${DATE}"
echo "Environment: ${ENVIRONMENT}"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Database backup
if [ "${ENVIRONMENT}" = "production" ]; then
    # PostgreSQL backup
    echo "Backing up PostgreSQL database..."
    docker-compose exec postgres pg_dump -U ${DB_USER} ${DB_NAME} > ${BACKUP_DIR}/kss_rating_${DATE}.sql
else
    # SQLite backup
    echo "Backing up SQLite database..."
    if [ -f "backend/database/kss_rating.db" ]; then
        cp backend/database/kss_rating.db ${BACKUP_DIR}/kss_rating_${DATE}.db
    fi
fi

# Configuration backup
echo "Backing up configuration files..."
tar -czf ${BACKUP_DIR}/config_${DATE}.tar.gz \
    .env.* \
    docker-compose.yml \
    nginx/ \
    --exclude=".env.example" \
    2>/dev/null || true

# Logs backup
echo "Backing up logs..."
if [ -d "logs" ]; then
    tar -czf ${BACKUP_DIR}/logs_${DATE}.tar.gz logs/
fi

# Clean old backups (keep last 7 days)
echo "Cleaning old backups..."
find ${BACKUP_DIR} -name "*.sql" -mtime +7 -delete 2>/dev/null || true
find ${BACKUP_DIR} -name "*.db" -mtime +7 -delete 2>/dev/null || true
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo "Backup completed successfully!"
echo "Backup files saved to: ${BACKUP_DIR}"
ls -la ${BACKUP_DIR}/ 