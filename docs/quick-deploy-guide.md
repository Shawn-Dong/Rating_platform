# 快速部署指南 - 让所有人访问您的KSS评分平台

## 方案一：DigitalOcean 一键部署 (最简单)

### 1. 创建云服务器
```bash
# 在 DigitalOcean 创建 Droplet
- 选择: Ubuntu 22.04 LTS
- 配置: Basic, $12/月 (2GB RAM, 1 CPU)
- 数据中心: 选择离用户最近的
- 添加SSH密钥 (推荐) 或设置root密码
```

### 2. 连接到服务器
```bash
# 使用SSH连接 (替换为您的服务器IP)
ssh root@your-server-ip

# 或使用密码登录
ssh root@your-server-ip
```

### 3. 服务器初始化
```bash
# 更新系统
apt update && apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 安装Git
apt install git -y
```

### 4. 部署应用
```bash
# 克隆项目
git clone https://github.com/your-username/Rating_platform.git
cd Rating_platform

# 创建生产环境配置
cp .env.example .env.production

# 编辑配置文件
nano .env.production
```

### 5. 配置环境变量
```bash
# 在 .env.production 中设置:
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-256-bit-key-here

# 数据库配置
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_NAME=kss_rating

# AWS S3 (如果有的话)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket

# 域名配置 (暂时用IP)
FRONTEND_URL=http://your-server-ip
CORS_ORIGIN=http://your-server-ip
```

### 6. 启动应用
```bash
# 一键部署
./scripts/deploy.sh production

# 或手动启动
docker-compose up -d
```

### 7. 验证部署
```bash
# 检查服务状态
docker-compose ps

# 测试健康检查
curl http://localhost:3001/api/health

# 检查前端
curl http://localhost/health
```

## 方案二：AWS EC2 部署

### 1. 创建EC2实例
```bash
# AWS控制台创建EC2
- AMI: Ubuntu Server 22.04 LTS
- 实例类型: t3.small ($15/月)
- 安全组: 开放端口 22, 80, 443
- 密钥对: 下载.pem文件
```

### 2. 连接服务器
```bash
# 使用SSH连接
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 3. 继续执行方案一的步骤3-7

## 配置域名 (可选但推荐)

### 1. 购买域名
- Namecheap, GoDaddy, 或 AWS Route 53
- 例如: kss-platform.com

### 2. 配置DNS
```bash
# 在域名提供商控制台添加A记录:
Type: A
Name: @ (根域名) 或 www
Value: your-server-ip
TTL: 300
```

### 3. 配置SSL证书
```bash
# 在服务器上安装Certbot
apt install certbot -y

# 获取SSL证书
certbot certonly --standalone -d your-domain.com

# 更新nginx配置
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# 更新环境变量
sed -i 's/http:/https:/g' .env.production
sed -i 's/your-server-ip/your-domain.com/g' .env.production

# 重启服务
docker-compose down && docker-compose up -d
```

## 开放服务器端口

### 配置防火墙
```bash
# Ubuntu UFW防火墙
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable

# 检查端口开放状态
ufw status
netstat -tulpn | grep LISTEN
```

## 用户访问指南

### 访问地址
```bash
# 使用IP访问 (临时)
http://your-server-ip

# 使用域名访问 (推荐)
https://your-domain.com
```

### 默认账户
```bash
# 管理员账户
用户名: admin
密码: admin123
访问: https://your-domain.com (自动跳转到管理面板)

# 评分员账户
用户名: scorer1  
密码: scorer123
访问: https://your-domain.com (自动跳转到评分界面)
```

## 监控和维护

### 查看服务状态
```bash
# 实时监控
./scripts/monitor.sh monitor

# 检查日志
docker-compose logs -f

# 备份数据
./scripts/backup.sh production
```

### 更新应用
```bash
# 拉取最新代码
git pull origin main

# 重新部署
docker-compose down
docker-compose build
docker-compose up -d
```

## 成本估算

### 基础配置 (月费用)
- **DigitalOcean Droplet**: $12/月
- **域名**: $10-15/年
- **SSL证书**: 免费 (Let's Encrypt)
- **总计**: ~$12/月

### 含AWS S3的配置
- **服务器**: $12/月  
- **S3存储**: $5-10/月
- **域名**: $10-15/年
- **总计**: ~$17-22/月

## 故障排除

### 常见问题
```bash
# 服务无法启动
docker-compose logs backend

# 端口被占用
sudo lsof -i :80
sudo lsof -i :443

# SSL证书问题
certbot certificates
openssl x509 -in nginx/ssl/cert.pem -text -noout

# 数据库连接失败
docker-compose exec postgres pg_isready
```

### 获取帮助
- 检查日志: `docker-compose logs -f`
- 监控状态: `./scripts/monitor.sh status`
- 健康检查: `curl http://your-domain.com/api/health`

## 安全建议

### 基本安全设置
```bash
# 更改默认密码
# 登录后立即在界面中更改admin和scorer1密码

# 设置强JWT密钥
# 在.env.production中使用256位随机密钥

# 定期备份
# 设置cron任务每日备份
0 2 * * * /path/to/Rating_platform/scripts/backup.sh production

# 更新系统
apt update && apt upgrade -y
``` 