# KSS Rating Platform

A professional web platform for manual scoring of images using the **Karolinska Sleepiness Scale (KSS)** for drowsiness research. Built for research teams to collect objective drowsiness ratings from multiple scorers.

## Project Overview

This platform enables researchers to:
- Upload and manage image datasets for KSS scoring
- Assign images to multiple scorers for inter-rater reliability
- Collect structured ratings with mandatory explanations
- Track progress and export data for analysis
- Manage users and view analytics through admin dashboard

## Tech Stack

### **Frontend**
- **Framework**: React 18.x
- **Language**: JavaScript (ES6+)
- **Styling**: Tailwind CSS 3.x
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Build Tool**: Create React App (CRA)
- **UI Components**: Custom components with Tailwind

### **Backend**
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: JavaScript (ES6+)
- **Database**: SQLite 3 (development) / PostgreSQL (production)
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcrypt, express-rate-limit, CORS
- **File Handling**: Native Node.js fs module
- **Environment**: dotenv for configuration

### **Database Schema**
```sql
-- Core tables
users (id, username, email, password_hash, role, is_active)
images (id, filename, s3_url, original_name, dataset_name, metadata)
scores (id, user_id, image_id, kss_score, explanation, additional_notes, time_spent_seconds)
assignments (id, user_id, image_id, status, assigned_at, completed_at)
```

### **Infrastructure & Deployment**
- **Development**: Local development with npm/nodemon
- **Static Files**: Express.static middleware
- **Image Storage**: Local filesystem (development) / AWS S3 (production)
- **Recommended Production**: AWS (EC2 + RDS + S3) or AWS Lightsail
- **Containerization**: Docker ready (Dockerfile included)

## Features

### **Core Research Features**
- **KSS Scale Implementation** (1-9 scale with descriptions)
- **Mandatory Explanations** (minimum 10 characters for data quality)
- **Time Tracking** (measures time spent per image)
- **Progress Tracking** (visual completion percentages)
- **Multi-scorer Support** (for inter-rater reliability studies)
- **Bulk Assignment System** (distribute work efficiently)

### **User Management**
- **Role-based Access** (admin, scorer roles)
- **JWT Authentication** (secure session management)
- **User Dashboard** (progress overview, recent scores)
- **Admin Panel** (user management, analytics)

### **Data Export & Analytics**
- **CSV Export** (for statistical analysis)
- **Scoring Analytics** (completion rates, time statistics)
- **Admin Dashboard** (real-time progress monitoring)

## Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **SQLite** (included with Node.js)

## Quick Start

### 1. **Clone and Install**
```bash
git clone <repository-url>
cd Rating_platform

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies  
cd ../frontend
npm install
```

### 2. **Environment Setup**
```bash
# Backend environment (.env in backend/)
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-here
DB_PATH=./database/kss_rating.db

# Frontend runs on port 3000 by default
```

### 3. **Initialize Database**
```bash
cd backend
npm run init-db    # Creates tables and sample data
```

### 4. **Start Development Servers**

**Terminal 1 - Backend:**
```bash
cd backend
npm start          # Runs on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start          # Runs on http://localhost:3000
```

### 5. **Access the Platform**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Default Admin**: `admin` / `admin123`
- **Default Scorer**: `scorer1` / `scorer123`

## Project Structure

```
Rating_platform/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── middleware/      # Auth, validation
│   │   ├── models/          # Database models
│   │   ├── routes/          # API endpoints
│   │   └── server.js        # Express app
│   ├── scripts/
│   │   ├── init-db.js       # Database initialization
│   │   └── load-images.js   # Image import utility
│   ├── database/            # SQLite files
│   ├── public/images/       # Local image storage
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks (auth, API)
│   │   ├── pages/           # Route components
│   │   └── styles/          # Tailwind CSS
│   ├── public/              # Static assets
│   └── package.json
└── README.md
```

## API Endpoints

### **Authentication**
```
POST /api/auth/login     # User login
POST /api/auth/register  # User registration
GET  /api/auth/profile   # Get user profile
```

### **Images**
```
GET  /api/images/next       # Get next assigned image
GET  /api/images/progress   # Get user progress
GET  /api/images/:id        # Get specific image
```

### **Scoring**
```
POST /api/scores           # Submit image score
GET  /api/scores/my-scores # Get user's scores
```

### **Admin**
```
GET  /api/admin/dashboard    # Dashboard statistics
GET  /api/admin/users        # User management
POST /api/admin/bulk-assign  # Assign images to users
GET  /api/admin/export/scores # Export CSV data
```

## UI Components

### **Scoring Interface**
- Visual KSS scale (1-9) with descriptions
- Image display with zoom/pan capabilities
- Required explanation text area
- Progress tracking bar
- Time measurement display

### **Admin Dashboard**
- User statistics cards
- Progress charts and analytics
- Bulk operations interface
- CSV export functionality

## Security Features

- **JWT Authentication** with secure token storage
- **Password Hashing** using bcrypt
- **Rate Limiting** to prevent abuse
- **CORS Configuration** for cross-origin requests
- **Input Validation** on all endpoints
- **Role-based Access Control**

## Database Design

The platform uses a relational database design optimized for research data collection:

- **Users table**: Authentication and role management
- **Images table**: Metadata and file references
- **Scores table**: KSS ratings with explanations and timing
- **Assignments table**: Work distribution and progress tracking

## Production Deployment

### **Recommended AWS Setup**
- **EC2 t3.small**: Application server ($15/month)
- **RDS PostgreSQL**: Database ($12/month)  
- **S3**: Image storage ($5/month)
- **CloudFront**: CDN for fast delivery ($5/month)
- **Total**: ~$45-60/month

### **Environment Variables (Production)**
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-production-secret
DATABASE_URL=postgresql://user:pass@host:5432/dbname
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=your-s3-bucket
```

## Scaling Considerations

- **Database**: Migrate SQLite → PostgreSQL for production
- **File Storage**: Move from local files → AWS S3
- **Caching**: Add Redis for session management
- **Load Balancing**: Use AWS ALB for high availability
- **Monitoring**: Implement CloudWatch or similar

## Development Tools

- **Backend Hot Reload**: nodemon
- **Frontend Hot Reload**: React Fast Refresh
- **Database Tool**: sqlite3 CLI or DB Browser
- **API Testing**: Built-in health check endpoint
- **Debugging**: Console logging with timestamps

## Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/your-feature`
3. **Commit changes**: `git commit -am 'Add your feature'`
4. **Push to branch**: `git push origin feature/your-feature`
5. **Create Pull Request**

## License

This project is designed for research use. Please ensure compliance with your institution's data handling and privacy requirements.

## Support

- **Documentation**: This README and inline code comments
- **Issues**: Use GitHub issues for bug reports
- **Research Use**: Contact for academic collaboration

---

**Built for Drowsiness Research**  
*Professional KSS rating platform for objective sleepiness assessment* 