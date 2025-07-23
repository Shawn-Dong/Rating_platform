#!/bin/bash

# KSS Rating Platform - AWS免费套餐部署脚本
# 针对t2.micro (1GB RAM)优化

set -e

echo "Starting KSS Rating Platform deployment for AWS Free Tier..."

# Configuration
ENVIRONMENT=${1:-free}
COMPOSE_FILE="docker-compose.free.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查系统资源
check_system_resources() {
    log_info "Checking system resources for Free Tier compatibility..."
    
    # 检查内存
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    if [ $TOTAL_MEM -lt 900 ]; then
        log_warn "Low memory detected: ${TOTAL_MEM}MB. This deployment is optimized for t2.micro."
    else
        log_info "Memory: ${TOTAL_MEM}MB available"
    fi
    
    # 检查磁盘空间
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 70 ]; then
        log_warn "Disk usage is ${DISK_USAGE}%. Consider cleaning up space."
    else
        log_info "Disk usage: ${DISK_USAGE}%"
    fi
}

# 检查先决条件
check_prerequisites() {
    log_info "Checking prerequisites for Free Tier deployment..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        log_info "Install with: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        log_info "Install with: sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose"
        exit 1
    fi
    
    if [ ! -f ".env.${ENVIRONMENT}" ] && [ ! -f ".env.production" ]; then
        log_error "Environment file not found"
        log_info "Please create .env.free based on .env.free.example"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# 优化系统设置
optimize_system() {
    log_info "Optimizing system for Free Tier..."
    
    # 启用swap (如果没有)
    if [ ! -f /swapfile ]; then
        log_info "Creating swap file for better memory management..."
        sudo fallocate -l 1G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    
    # 设置swap优先级
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    
    log_info "System optimization completed"
}

# 清理旧容器和镜像
cleanup_docker() {
    log_info "Cleaning up Docker resources..."
    
    # 停止现有容器
    docker-compose -f ${COMPOSE_FILE} down 2>/dev/null || true
    
    # 清理未使用的镜像和容器
    docker system prune -f
    
    log_info "Docker cleanup completed"
}

# 构建镜像
build_images() {
    log_info "Building optimized Docker images for Free Tier..."
    
    # 使用构建缓存和多阶段构建
    docker-compose -f ${COMPOSE_FILE} build --parallel
    
    log_info "Images built successfully"
}

# 部署服务
deploy_services() {
    log_info "Deploying services with Free Tier configuration..."
    
    # 复制环境文件
    if [ -f ".env.${ENVIRONMENT}" ]; then
        cp .env.${ENVIRONMENT} .env.production
    fi
    
    # 启动服务
    docker-compose -f ${COMPOSE_FILE} up -d
    
    log_info "Services deployed successfully"
}

# 健康检查
health_check() {
    log_info "Performing health checks..."
    
    # 等待服务启动
    sleep 30
    
    # 检查后端
    for i in {1..10}; do
        if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
            log_info "Backend health check passed"
            break
        else
            log_warn "Backend not ready, attempt $i/10..."
            sleep 10
        fi
    done
    
    # 检查前端
    for i in {1..5}; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log_info "Frontend health check passed"
            break
        else
            log_warn "Frontend not ready, attempt $i/5..."
            sleep 10
        fi
    done
    
    log_info "Health checks completed"
}

# 初始化数据库
init_database() {
    log_info "Initializing database..."
    
    # 等待后端完全启动
    sleep 10
    
    # 运行数据库初始化
    docker-compose -f ${COMPOSE_FILE} exec -T backend npm run init-db || {
        log_error "Database initialization failed"
        docker-compose -f ${COMPOSE_FILE} logs backend
        exit 1
    }
    
    log_info "Database initialized successfully"
}

# 显示部署状态
show_status() {
    log_info "Free Tier Deployment Status:"
    docker-compose -f ${COMPOSE_FILE} ps
    
    echo ""
    log_info "System Resources:"
    echo "  Memory Usage: $(free -h | awk 'NR==2{printf "%.1f/%.1f GB (%.0f%%)", $3/1024/1024, $2/1024/1024, $3*100/$2}')"
    echo "  Disk Usage: $(df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}')"
    echo "  Swap Usage: $(free -h | awk 'NR==3{print $3"/"$2}')"
    
    echo ""
    log_info "Access URLs:"
    
    # 获取公网IP
    PUBLIC_IP=$(curl -s http://checkip.amazonaws.com/ || echo "your-ec2-public-ip")
    echo "  Frontend: http://${PUBLIC_IP}"
    echo "  Backend API: http://${PUBLIC_IP}:3001"
    echo "  Health Check: http://${PUBLIC_IP}:3001/api/health"
    
    echo ""
    log_info "Default Credentials:"
    echo "  Admin: admin / admin123"
    echo "  Scorer: scorer1 / scorer123"
    
    echo ""
    log_info "Free Tier Monitoring:"
    echo "  Monitor usage: aws.amazon.com/console > Billing > Free Tier"
    echo "  Current month usage stays within free limits"
}

# 设置监控
setup_monitoring() {
    log_info "Setting up Free Tier monitoring..."
    
    # 创建监控脚本
    cat > free-tier-monitor.sh << 'EOF'
#!/bin/bash
# Free Tier Resource Monitor

echo "=== AWS Free Tier Resource Usage ==="
echo "Date: $(date)"
echo ""

echo "Memory Usage:"
free -h

echo ""
echo "Disk Usage:"
df -h /

echo ""
echo "Docker Container Status:"
docker-compose -f docker-compose.free.yml ps

echo ""
echo "Network Usage (approximate):"
cat /proc/net/dev | awk 'NR>2 {print $1 " RX: " $2/1024/1024 "MB TX: " $10/1024/1024 "MB"}'
EOF
    
    chmod +x free-tier-monitor.sh
    
    log_info "Monitoring setup completed. Run ./free-tier-monitor.sh to check usage"
}

# 主部署流程
main() {
    echo "KSS Rating Platform - AWS Free Tier Deployment"
    echo "Environment: ${ENVIRONMENT}"
    echo "Optimized for: t2.micro (1GB RAM, 1 vCPU)"
    echo "==============================================="
    
    check_system_resources
    check_prerequisites
    optimize_system
    cleanup_docker
    build_images
    deploy_services
    health_check
    init_database
    setup_monitoring
    show_status
    
    log_info "Free Tier deployment completed successfully!"
    log_warn "Remember to monitor your AWS Free Tier usage at aws.amazon.com/console"
}

# 运行主函数
main "$@" 