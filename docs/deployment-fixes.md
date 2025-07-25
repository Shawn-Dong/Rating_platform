# EC2 Deployment Login Issues - Complete Fix Guide

## 🚨 The Problem

Your application was getting 404 errors and trying to connect to localhost:3000 instead of your EC2 address because:

1. **Hardcoded localhost URLs** in authentication system
2. **Missing environment variables** for production deployment
3. **Frontend not configured** with correct backend API URL
4. **Google OAuth callback URL** pointing to localhost

## 🔧 Issues Found and Fixed

### 1. Google OAuth Callback URL (✅ FIXED)
**File**: `backend/src/routes/auth.js`
**Problem**: Hardcoded to `http://localhost:3001/api/auth/google/callback`
**Solution**: Now uses environment variable `BACKEND_URL`

### 2. Frontend API Configuration
**File**: `frontend/src/hooks/useAuth.js`
**Problem**: Default API URL is `http://localhost:3001/api`
**Solution**: Must set `REACT_APP_API_URL` environment variable

### 3. Google Login Link
**File**: `frontend/src/pages/LoginPage.js`
**Problem**: Google login button points to localhost
**Solution**: Uses `REACT_APP_API_URL` environment variable

### 4. CORS Configuration
**File**: `backend/src/server.js`
**Problem**: May not allow your EC2 IP address
**Solution**: Must set `CORS_ORIGIN` environment variable

## 🚀 Quick Fix Solution

### Step 1: Run the Fix Script
```bash
# Make sure you're in the project root directory
cd /path/to/Rating_platform

# Run the deployment fix script
./scripts/fix-deployment.sh
```

When prompted, enter your EC2 public IP address (e.g., `3.131.82.28`)

### Step 2: Redeploy Your Application
```bash
# Stop existing containers
docker-compose down

# Rebuild images with new configuration
docker-compose build

# Start with new configuration
docker-compose up -d

# Initialize database (if needed)
docker-compose exec backend npm run init-db
```

### Step 3: Verify the Fix
```bash
# Check if backend is running
curl http://YOUR_EC2_IP:3001/api/health

# Check if frontend is running
curl http://YOUR_EC2_IP/health

# Check container status
docker-compose ps
```

## 🌐 Manual Fix (Alternative)

If you prefer to set up manually:

### Backend Environment (backend/.env.production)
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secret-key-256-bit

# REPLACE YOUR_EC2_IP with actual IP
BACKEND_URL=http://YOUR_EC2_IP:3001
FRONTEND_URL=http://YOUR_EC2_IP
CORS_ORIGIN=http://YOUR_EC2_IP

DB_PATH=/app/database/kss_rating.db
```

### Frontend Environment (frontend/.env.production)
```bash
# REPLACE YOUR_EC2_IP with actual IP
REACT_APP_API_URL=http://YOUR_EC2_IP:3001/api
```

### Docker Compose Environment (.env.production)
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secret-key-256-bit
BACKEND_URL=http://YOUR_EC2_IP:3001
FRONTEND_URL=http://YOUR_EC2_IP
CORS_ORIGIN=http://YOUR_EC2_IP
DB_PATH=/app/database/kss_rating.db
```

## 🔐 Security Group Configuration

Make sure your EC2 security group allows inbound traffic:

| Type | Protocol | Port Range | Source |
|------|----------|------------|--------|
| HTTP | TCP | 80 | 0.0.0.0/0 |
| Custom TCP | TCP | 3001 | 0.0.0.0/0 |
| SSH | TCP | 22 | Your IP |

## 🧪 Testing Your Login System

### 1. Test Default Admin Login
```bash
# Navigate to your EC2 IP
http://YOUR_EC2_IP

# Login with:
# Username: admin
# Password: admin123
```

### 2. Test Scorer Login
```bash
# Login with:
# Username: scorer1
# Password: scorer123
```

### 3. Test API Endpoints
```bash
# Health check
curl http://YOUR_EC2_IP:3001/api/health

# Login test
curl -X POST http://YOUR_EC2_IP:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🚨 Common Issues and Solutions

### Issue: "Cannot connect to backend"
**Solution**: Check if port 3001 is open in security group

### Issue: "CORS error"
**Solution**: Verify `CORS_ORIGIN` is set to your EC2 IP

### Issue: "404 on Google login"
**Solution**: Ensure `BACKEND_URL` environment variable is set

### Issue: "Frontend shows localhost:3001"
**Solution**: Check `REACT_APP_API_URL` in frontend/.env.production

## 📊 Expected Results After Fix

✅ **Frontend loads at**: `http://YOUR_EC2_IP`
✅ **Backend API at**: `http://YOUR_EC2_IP:3001`
✅ **Login works for**: admin/admin123 and scorer1/scorer123
✅ **Google OAuth points to**: Your EC2 IP (not localhost)
✅ **All API calls go to**: Your EC2 backend (not localhost)

## 🔄 If Issues Persist

1. **Check logs**:
   ```bash
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

2. **Verify environment variables**:
   ```bash
   docker-compose exec backend env | grep -E "(BACKEND_URL|FRONTEND_URL|CORS_ORIGIN)"
   ```

3. **Test connectivity**:
   ```bash
   # From inside backend container
   docker-compose exec backend curl http://localhost:3001/api/health
   ```

## 🎯 Next Steps

After fixing the login issues:

1. **Set up SSL/HTTPS** for production security
2. **Configure domain name** instead of IP address
3. **Set up proper Google OAuth** if needed
4. **Configure AWS S3** for image storage
5. **Set up database backups**

---

**Need help?** Check the logs with `docker-compose logs -f` and verify all environment variables are correctly set with your actual EC2 IP address. 