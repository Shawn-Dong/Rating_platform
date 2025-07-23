# KSS Rating Platform Deployment Guide

## Prerequisites

### System Requirements
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended  
- **Storage**: 20GB minimum
- **OS**: Ubuntu 20.04+, CentOS 8+, or similar Linux distribution

### Required Software
- Docker 20.10+
- Docker Compose 2.0+
- Git
- curl (for health checks)

### AWS Services (Production)
- **S3 Bucket**: For image storage
- **IAM User**: With S3 permissions
- **CloudFront** (optional): For CDN
- **EC2 Instance**: For hosting
- **RDS PostgreSQL** (optional): For managed database

## Quick Start (Local Development)

```bash
# Clone repository
git clone <repository-url>
cd Rating_platform

# Create environment file
cp .env.example .env.development

# Edit environment variables
nano .env.development

# Start development servers
cd backend && npm install && npm run dev &
cd frontend && npm install && npm start
```

## Production Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

### 2. Application Deployment

```bash
# Clone application
git clone <repository-url>
cd Rating_platform

# Create production environment file
cp .env.example .env.production

# Configure environment variables
nano .env.production
```

### 3. Environment Configuration

#### Required Variables (.env.production)
```bash
# Server
NODE_ENV=production
PORT=3001
JWT_SECRET=your-256-bit-secret-key

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/kss_rating

# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket

# Domain
FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
```

### 4. SSL Certificate Setup

```bash
# Create SSL directory
mkdir -p nginx/ssl

# For Let's Encrypt (recommended)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
sudo chown -R $USER:$USER nginx/ssl/
```

### 5. Deploy Application

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy with automated script
./scripts/deploy.sh production

# Or manual deployment
docker-compose up -d
```

### 6. Verify Deployment

```bash
# Check service status
docker-compose ps

# Check logs
docker-compose logs -f

# Test endpoints
curl http://localhost:3001/api/health
curl http://localhost/health
```

## Database Management

### Initialize Database
```bash
# Run database initialization
docker-compose exec backend npm run init-db

# Or manually
docker-compose exec postgres psql -U postgres -d kss_rating -f /docker-entrypoint-initdb.d/init.sql
```

### Backup Database
```bash
# Automated backup
./scripts/backup.sh production

# Manual PostgreSQL backup
docker-compose exec postgres pg_dump -U postgres kss_rating > backup.sql

# Manual SQLite backup (development)
cp backend/database/kss_rating.db backup_$(date +%Y%m%d).db
```

### Restore Database
```bash
# PostgreSQL restore
docker-compose exec -T postgres psql -U postgres kss_rating < backup.sql

# SQLite restore
cp backup.db backend/database/kss_rating.db
```

## Monitoring and Maintenance

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Scale Services (if needed)
```bash
# Scale backend instances
docker-compose up -d --scale backend=3
```

## Security Checklist

### Server Security
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] SSH key-based authentication
- [ ] Regular security updates
- [ ] Non-root user for application

### Application Security  
- [ ] Strong JWT secret (256-bit minimum)
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Rate limiting configured
- [ ] Security headers implemented
- [ ] CORS properly configured
- [ ] Database credentials secured

### AWS Security
- [ ] S3 bucket properly configured
- [ ] IAM user with minimal permissions
- [ ] S3 bucket policy restricts public access
- [ ] CloudFront configured (if used)

## Performance Optimization

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_scores_user_image ON scores(user_id, image_id);
CREATE INDEX CONCURRENTLY idx_assignments_status ON assignments(status);
```

### Nginx Optimization
```nginx
# In nginx.conf
worker_processes auto;
worker_connections 1024;

# Enable gzip compression
gzip on;
gzip_types text/css application/javascript image/svg+xml;

# Enable caching
location ~* \.(css|js|img|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Troubleshooting

### Common Issues

#### Container won't start
```bash
# Check logs
docker-compose logs backend

# Check environment variables
docker-compose config

# Restart services
docker-compose restart
```

#### Database connection failed
```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready

# Check environment variables
echo $DATABASE_URL

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

#### SSL certificate issues
```bash
# Verify certificate
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew
```

#### High memory usage
```bash
# Check resource usage
docker stats

# Restart services
docker-compose restart

# Clean up unused images
docker system prune -a
```

### Health Checks

#### Automated Monitoring
```bash
#!/bin/bash
# health-check.sh
curl -f http://localhost/api/health || echo "Backend down"
curl -f http://localhost/health || echo "Frontend down"
```

#### Log Monitoring
```bash
# Watch for errors
docker-compose logs -f | grep -i error

# Monitor response times
docker-compose logs nginx | grep "request_time"
```

## Scaling Considerations

### Horizontal Scaling
- Multiple backend instances behind load balancer
- Redis for session management
- CDN for static assets

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Implement caching

### Database Scaling
- Read replicas for PostgreSQL
- Connection pooling
- Query optimization

## Backup Strategy

### Automated Backups
```bash
# Setup cron job for daily backups
0 2 * * * /path/to/Rating_platform/scripts/backup.sh production
```

### Backup Verification
```bash
# Test backup integrity
./scripts/backup.sh development
# Restore to test environment
# Verify data integrity
```

## Support and Resources

### Logs Location
- Application logs: `docker-compose logs`
- Nginx logs: `logs/nginx/`
- Database logs: `docker-compose logs postgres`

### Configuration Files
- Docker: `docker-compose.yml`
- Nginx: `nginx/nginx.conf`
- Database: `database/init.sql`
- Environment: `.env.production`

### Useful Commands
```bash
# View running containers
docker ps

# Enter container shell
docker-compose exec backend bash

# View container resources
docker stats

# Clean up
docker system prune
``` 