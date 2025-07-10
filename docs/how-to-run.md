# 🚀 How to Run the KSS Rating Platform

## Prerequisites
- **Node.js** (version 14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

## Step 1: Start the Backend Server

Open a terminal and navigate to the backend directory:

```bash
cd backend
```

Install dependencies (first time only):
```bash
npm install
```

Create environment file (if not exists):
```bash
echo "PORT=3001
NODE_ENV=development  
JWT_SECRET=dev-secret-key-please-change-in-production
CORS_ORIGIN=http://localhost:3000" > .env
```

Start the backend server:
```bash
npm start
```

You should see:
```
Connected to SQLite database
KSS Rating Platform API running on port 3001
Health check: http://localhost:3001/api/health
```

**Keep this terminal open!** The backend server needs to keep running.

## Step 2: Start the Frontend Application

Open a **NEW terminal** and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies (first time only):
```bash
npm install
```

Start the frontend development server:
```bash
npm start
```

You should see:
```
Compiled successfully!

You can now view kss-rating-frontend in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.1.x:3000
```

The browser should automatically open to http://localhost:3000

## Step 3: Create Your First Admin User

Since this is a fresh install, you need to create an admin user. Use this curl command in a **third terminal**:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@yourproject.com",
    "password": "password123",
    "role": "admin"
  }'
```

You should get a response like:
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@yourproject.com",
    "role": "admin"
  },
  "token": "..."
}
```

## Step 4: Log In and Test

1. Go to http://localhost:3000 in your browser
2. You'll be redirected to the login page
3. Log in with:
   - **Username:** admin
   - **Password:** password123

## Step 5: Add Test Data (Optional)

To test the scoring functionality, you'll need to:

1. **Add images to the database** (via SQL or API)
2. **Create scorer users** (via admin panel or API)
3. **Assign images to scorers** (via admin panel or API)

### Quick Test with API:

Create a scorer user:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "scorer1",
    "email": "scorer1@test.com",
    "password": "password123",
    "role": "scorer"
  }'
```

## 🎯 What You Should See

### ✅ Backend Working (http://localhost:3001)
- Health check endpoint: http://localhost:3001/api/health
- Returns: `{"status":"ok","timestamp":"...","service":"KSS Rating Platform API"}`

### ✅ Frontend Working (http://localhost:3000)
- Login page with KSS Rating Platform branding
- Clean, professional interface
- Form validation and error handling

### ✅ Authentication Working
- Can create users via API
- Can log in through the web interface
- JWT tokens are properly managed

### ✅ Core Features Ready
- **Scoring Interface** - Full KSS scale with explanations
- **Progress Tracking** - Visual progress bars
- **Dashboard** - User progress and recent scores
- **Navigation** - Header with links and logout

## 🔧 Troubleshooting

### Backend Issues
```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Check backend logs
cd backend && npm start
```

### Frontend Issues
```bash
# Clear cache and restart
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

### Database Issues
- The SQLite database is created automatically in `backend/database/kss_rating.db`
- If you need to reset the database, just delete this file and restart the backend

### Port Conflicts
- If port 3001 is busy, change `PORT=3002` in `backend/.env`
- If port 3000 is busy, React will ask if you want to use a different port

## 📊 Next Steps

1. **Add Images**: Upload images to score via the admin API
2. **Create Scorers**: Add multiple scorer accounts
3. **Assign Work**: Distribute images to scorers for rating
4. **Monitor Progress**: Use the dashboard to track completion
5. **Export Data**: Use the analytics API to export results

## 🔒 Security Notes

- Change the `JWT_SECRET` in production
- Use strong passwords for all accounts
- Consider adding HTTPS for production deployment
- Review the rate limiting settings

## 📱 Ready for Research!

Your KSS Rating Platform is now ready for real research use:
- ✅ Professional scoring interface
- ✅ Required explanations for quality control
- ✅ Progress tracking and completion monitoring
- ✅ Time tracking for research analysis
- ✅ Export capabilities for data analysis

Happy scoring! 🎉 