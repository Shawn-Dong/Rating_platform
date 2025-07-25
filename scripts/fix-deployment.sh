#!/bin/bash

# KSS Rating Platform - Deployment Fix Script
# This script fixes the localhost issues for EC2 deployment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}KSS Rating Platform - Deployment Fix Script${NC}"
echo "================================================="

# Get EC2 IP address
read -p "Enter your EC2 public IP address (e.g., 3.131.82.28): " EC2_IP

if [[ -z "$EC2_IP" ]]; then
    echo -e "${RED}Error: EC2 IP address is required${NC}"
    exit 1
fi

echo -e "${YELLOW}Setting up environment for IP: $EC2_IP${NC}"

# Create backend .env.production
echo -e "${GREEN}Creating backend/.env.production...${NC}"
cat > backend/.env.production << EOF
# KSS Rating Platform - Production Environment
NODE_ENV=production
PORT=3001
JWT_SECRET=kss-rating-production-secret-key-256-bit-please-change

# URL Configuration
BACKEND_URL=http://$EC2_IP:3001
FRONTEND_URL=http://$EC2_IP
CORS_ORIGIN=http://$EC2_IP

# Database Configuration
DB_PATH=/app/database/kss_rating.db

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

# Create frontend .env.production
echo -e "${GREEN}Creating frontend/.env.production...${NC}"
cat > frontend/.env.production << EOF
# Frontend Production Environment
REACT_APP_API_URL=http://$EC2_IP:3001/api
EOF

# Create root .env.production for docker-compose
echo -e "${GREEN}Creating .env.production for docker-compose...${NC}"
cat > .env.production << EOF
# KSS Rating Platform - Docker Compose Environment
NODE_ENV=production
PORT=3001
JWT_SECRET=kss-rating-production-secret-key-256-bit-please-change
BACKEND_URL=http://$EC2_IP:3001
FRONTEND_URL=http://$EC2_IP
CORS_ORIGIN=http://$EC2_IP
DB_PATH=/app/database/kss_rating.db
EOF

echo -e "${GREEN}Environment files created successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Stop existing containers: docker-compose down"
echo "2. Rebuild images: docker-compose build"
echo "3. Start with new config: docker-compose up -d"
echo "4. Initialize database: docker-compose exec backend npm run init-db"
echo ""
echo -e "${GREEN}Your application URLs will be:${NC}"
echo "Frontend: http://$EC2_IP"
echo "Backend API: http://$EC2_IP:3001"
echo "Health Check: http://$EC2_IP:3001/api/health"
echo ""
echo -e "${YELLOW}Make sure your EC2 security group allows inbound traffic on ports 80 and 3001${NC}" 