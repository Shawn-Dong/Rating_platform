# AWS免费套餐部署指南 - KSS评分平台

## AWS免费套餐详情

### EC2免费套餐
```
✅ 免费内容：
- 实例类型：t2.micro (1 vCPU, 1GB RAM)
- 免费时长：每月750小时 (相当于24/7运行)
- 有效期：注册后12个月
- 存储：30GB EBS存储
- 数据传输：15GB出站流量/月
```

### 其他免费AWS服务
```
✅ S3存储：
- 存储：5GB标准存储
- 请求：20,000个GET请求，2,000个PUT请求
- 数据传输：15GB/月

✅ RDS数据库：
- 类型：db.t2.micro
- 存储：20GB
- 时长：750小时/月，12个月

✅ Route 53：
- 托管区域：1个
- 查询：100万次/月
```

## 快速免费部署步骤

### 1. 创建AWS账户
```bash
# 访问 aws.amazon.com
# 点击"创建免费账户"
# 需要信用卡验证（不会扣费）
# 验证手机号码
```

### 2. 启动免费EC2实例
```bash
# AWS控制台 > EC2 > 启动实例
配置选择：
- AMI: Ubuntu Server 22.04 LTS (免费套餐符合条件)
- 实例类型: t2.micro (免费套餐符合条件)
- 存储: 30GB gp2 (免费套餐符合条件)
- 安全组: 开放端口 22, 80, 443
```

### 3. 连接和部署
```bash
# 下载密钥对文件 (例如: kss-platform.pem)
chmod 400 kss-platform.pem

# SSH连接
ssh -i kss-platform.pem ubuntu@your-ec2-public-ip

# 服务器初始化
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 重新登录以应用docker组权限
exit
ssh -i kss-platform.pem ubuntu@your-ec2-public-ip
```

### 4. 部署KSS平台
```bash
# 克隆项目
git clone https://github.com/your-username/Rating_platform.git
cd Rating_platform

# 配置环境变量
cp .env.example .env.production

# 编辑配置（针对免费套餐优化）
nano .env.production
```

### 5. 免费套餐优化配置
```bash
# .env.production 配置示例
NODE_ENV=production
PORT=3001
JWT_SECRET=your-256-bit-secret-key

# 使用SQLite而不是PostgreSQL（节省内存）
DB_PATH=/app/database/kss_rating.db

# 如果使用S3（可选，有免费额度）
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=kss-platform-free

# 域名配置
FRONTEND_URL=http://your-ec2-public-ip
CORS_ORIGIN=http://your-ec2-public-ip
```

### 6. 针对t2.micro的优化部署
```bash
# 创建优化版docker-compose
cp docker-compose.yml docker-compose.free.yml

# 编辑优化配置
nano docker-compose.free.yml
```

## 免费套餐优化的Docker配置

### docker-compose.free.yml
```yaml
version: '3.8'

services:
  # 后端API
  backend:
    build: .
    container_name: kss-backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/database/kss_rating.db
    env_file:
      - .env.production
    volumes:
      - db_data:/app/database
      - ./logs:/app/logs
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 400M
        reservations:
          memory: 200M

  # 前端 (简化配置)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: kss-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 200M
        reservations:
          memory: 100M

  # 使用SQLite而不是PostgreSQL (节省内存)
  # PostgreSQL配置已注释掉

volumes:
  db_data:

networks:
  default:
    driver: bridge
```

### 7. 启动优化版本
```bash
# 使用优化配置启动
docker-compose -f docker-compose.free.yml up -d

# 初始化数据库
docker-compose -f docker-compose.free.yml exec backend npm run init-db

# 检查状态
docker-compose -f docker-compose.free.yml ps
```

## 免费套餐限制和建议

### 性能限制
```bash
⚠️ t2.micro限制:
- CPU: 1 vCPU (突发性能)
- 内存: 1GB RAM
- 网络: 低到中等
- 存储: 30GB

✅ 适合场景:
- 10-20个并发用户
- 小型研究团队
- 原型验证
- 学习和测试
```

### 成本控制建议
```bash
# 1. 设置计费警报
AWS控制台 > Billing > Billing preferences
设置: $1 警报阈值

# 2. 监控使用量
AWS控制台 > Billing > Free Tier
查看免费套餐使用情况

# 3. 自动停止实例（可选）
# 设置CloudWatch规则在非工作时间停止EC2
```

### 扩展路径
```bash
# 当需要更多性能时:
1. 升级到 t3.small ($15/月)
2. 添加PostgreSQL RDS
3. 使用S3 + CloudFront
4. 设置负载均衡器
```

## 监控免费额度

### 检查剩余额度
```bash
# AWS控制台监控
1. Billing Dashboard > Free Tier
2. 查看各服务使用百分比
3. 设置接近限额时的通知

# 命令行监控
aws ce get-rightsizing-recommendation
aws budgets describe-budgets
```

### 成本优化
```bash
# 停止不必要的服务
docker-compose -f docker-compose.free.yml stop

# 清理未使用的镜像
docker system prune -a

# 监控资源使用
docker stats
free -h
df -h
```

## 完全免费的12个月

### 第一年完全免费
```bash
✅ 0费用包含:
- EC2 t2.micro: 750小时/月 (24/7运行)
- 30GB存储
- 1GB内存
- S3: 5GB存储
- 数据传输: 15GB/月

🎯 适合用途:
- 研究原型
- 小团队评分
- 功能验证
- 用户培训
```

### 12个月后的选择
```bash
# 选项1: 升级付费 (~$15/月)
- 更好性能
- 更多存储
- 技术支持

# 选项2: 迁移到其他平台
- 导出数据
- 迁移到DigitalOcean
- 或其他云服务商

# 选项3: 本地部署
- 使用Docker在本地服务器
- 适合长期研究项目
```

## 立即开始免费部署

```bash
# 1分钟行动计划:
1. 访问 aws.amazon.com/free
2. 创建免费账户
3. 启动 t2.micro EC2实例
4. 使用我们的脚本一键部署
5. 分享IP给研究团队

# 完全免费运行12个月！
``` 