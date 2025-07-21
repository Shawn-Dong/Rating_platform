# KSS Rating Platform

A professional web platform for manual scoring of images using the **Karolinska Sleepiness Scale (KSS)** for drowsiness research. Built for research teams to collect objective drowsiness ratings from multiple scorers.

## Project Overview

This platform enables researchers to:
- Upload and manage image datasets for KSS scoring with **AWS S3 cloud storage**
- **Bulk upload and delete** images with advanced management features
- Assign images to multiple scorers for inter-rater reliability
- Collect structured ratings with mandatory explanations
- Track progress and export data for analysis
- Manage users and view analytics through **role-optimized admin dashboard**
- **Smart role-based navigation** for streamlined user experience

## Recent Updates (Latest)

### 🆕 **Enhanced Image Management & Cloud Integration**
- **AWS S3 Integration**: Professional cloud storage for scalable image hosting
- **Bulk Image Operations**: Upload and delete multiple images simultaneously (up to 20 at once)
- **Smart Delete System**: Soft delete with automatic assignment cleanup
- **Enhanced UI**: Cleaner interface with improved file name display
- **Selection Mode**: Checkbox-based bulk selection for efficient management

### 🆕 **Role-Based User Experience**
- **Smart Redirects**: Admins go directly to management dashboard, scorers to scoring interface  
- **Optimized Navigation**: Role-aware home pages and navigation flows
- **Streamlined Login**: Automatic role detection and appropriate interface loading

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
- **File Handling**: **AWS S3 SDK** for cloud storage
- **Environment**: dotenv for configuration

### **Database Schema**
```sql
-- Core tables
users (id, username, email, password_hash, role, is_active)
images (id, filename, s3_url, original_name, dataset_name, metadata, is_active)
scores (id, user_id, image_id, kss_score, explanation, additional_notes, time_spent_seconds)
assignments (id, user_id, image_id, status, assigned_at, completed_at)
```

### **Infrastructure & Deployment**
- **Development**: Local development with npm/nodemon
- **Image Storage**: **AWS S3** (cloud-first architecture)
- **File Processing**: Multer with memory storage for cloud uploads
- **CDN**: AWS CloudFront for global image delivery
- **Recommended Production**: AWS (EC2 + RDS + S3) or AWS Lightsail
- **Containerization**: Docker ready (Dockerfile included)

## Features

### **🆕 Enhanced Image Management**
- **Cloud Storage**: AWS S3 integration for professional file management
- **Bulk Upload**: Upload up to 20 images simultaneously with progress tracking
- **Smart Delete System**: 
  - Single image deletion with hover controls
  - Bulk deletion with checkbox selection mode
  - Soft delete preserves data while hiding from active use
  - Automatic cleanup of pending assignments
- **Enhanced UI**: Clean interface prioritizing meaningful file names
- **File Management**: Professional-grade image library with grid view

### **🆕 Role-Based User Experience**
- **Smart Navigation**: Automatic redirection based on user role
  - **Admins**: Direct access to management dashboard
  - **Scorers**: Streamlined scoring interface
- **Optimized Workflows**: Role-appropriate features and navigation
- **Enhanced Login Flow**: OAuth and form login with intelligent redirects

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
- **Training Data Viewer** (individual scores and explanations)
- **Admin Dashboard** (real-time progress monitoring)

## Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **SQLite** (included with Node.js)
- **AWS Account** (for S3 storage - production recommended)

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

#### **Backend Environment (.env in backend/)**
```bash
# Server Configuration
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-here
DB_PATH=./database/kss_rating.db

# AWS S3 Configuration (Required for image uploads)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3000
```

#### **Frontend Environment (.env in frontend/)**
```bash
REACT_APP_API_URL=http://localhost:3001/api
```

### 3. **AWS S3 Setup** 
```bash
# Create S3 bucket and configure IAM permissions
# Bucket policy should allow public read access for images
# IAM user needs s3:PutObject, s3:DeleteObject permissions
```

### 4. **Initialize Database**
```bash
cd backend
npm run init-db    # Creates tables and sample data
```

### 5. **Start Development Servers**

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev        # Runs on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start          # Runs on http://localhost:3000
```

### 6. **Access the Platform**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Default Admin**: `admin` / `admin123` (redirects to admin dashboard)
- **Default Scorer**: `scorer1` / `scorer123` (redirects to scoring interface)

## Project Structure

```
Rating_platform/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── middleware/      # Auth, validation
│   │   ├── models/          # Database models
│   │   ├── routes/          # API endpoints
│   │   │   ├── admin.js     # 🆕 Enhanced with S3 & bulk operations
│   │   │   ├── auth.js      # 🆕 Role-based redirects
│   │   │   ├── images.js    # Image management
│   │   │   └── scores.js    # Scoring endpoints
│   │   └── server.js        # Express app
│   ├── scripts/
│   │   ├── init-db.js       # Database initialization
│   │   └── load-images.js   # Image import utility
│   ├── database/            # SQLite files
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      
│   │   │   ├── ImageList.js     # 🆕 Bulk selection & delete
│   │   │   ├── ImageUpload.js   # 🆕 Bulk upload support
│   │   │   ├── Analytics.js     # 🆕 Training data viewer
│   │   │   └── ...
│   │   ├── hooks/           # Custom hooks (auth, API)
│   │   ├── pages/           
│   │   │   ├── AdminDashboard.js # 🆕 Enhanced management
│   │   │   ├── LoginPage.js      # 🆕 Role-based redirects
│   │   │   └── ...
│   │   └── styles/          # Tailwind CSS
│   ├── public/              # Static assets
│   └── package.json
└── README.md
```

## API Endpoints

### **Authentication**
```
POST /api/auth/login     # User login (🆕 role-based redirects)
POST /api/auth/register  # User registration
GET  /api/auth/profile   # Get user profile
GET  /api/auth/google    # 🆕 Google OAuth login
```

### **Images**
```
GET  /api/images/next       # Get next assigned image
GET  /api/images/progress   # Get user progress
GET  /api/images/:id        # Get specific image
GET  /api/images/all        # Get all images (admin)
```

### **🆕 Enhanced Image Management (Admin)**
```
POST   /api/admin/images/upload      # Single image upload to S3
POST   /api/admin/images/bulk-upload # Bulk image upload (up to 20)
DELETE /api/admin/images/:id         # Single image delete (soft delete)
DELETE /api/admin/images/bulk-delete # Bulk image delete
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

## 🆕 Enhanced UI Components

### **Image Management Interface**
- **Bulk Upload**: Drag & drop or multi-select up to 20 images
- **Selection Mode**: Checkbox-based bulk operations
- **Smart Display**: Prioritizes meaningful file names over system names
- **Delete Controls**: Hover-based single delete + bulk delete options
- **Confirmation Dialogs**: Safety checks for destructive operations

### **Role-Based Navigation**
- **Admin Dashboard**: Direct access to management tools
- **Scorer Interface**: Streamlined scoring workflow
- **Smart Redirects**: Automatic role detection and routing

### **Scoring Interface**
- Visual KSS scale (1-9) with descriptions
- Image display with zoom/pan capabilities
- Required explanation text area
- Progress tracking bar
- Time measurement display

## Security Features

- **JWT Authentication** with secure token storage
- **Password Hashing** using bcrypt
- **Rate Limiting** to prevent abuse
- **CORS Configuration** for cross-origin requests
- **Input Validation** on all endpoints
- **Role-based Access Control**
- **🆕 S3 Security**: Secure file uploads with signed URLs

## Database Design

The platform uses a relational database design optimized for research data collection:

- **Users table**: Authentication and role management
- **Images table**: Metadata with S3 URLs and soft delete support
- **Scores table**: KSS ratings with explanations and timing
- **Assignments table**: Work distribution and progress tracking

## Production Deployment

### **🆕 Enhanced AWS Setup**
- **EC2 t3.small**: Application server ($15/month)
- **RDS PostgreSQL**: Database ($12/month)  
- **S3**: Image storage with CloudFront CDN ($5-15/month)
- **CloudFront**: Fast global image delivery (included)
- **Total**: ~$45-60/month

### **🆕 Environment Variables (Production)**
```bash
# Server
NODE_ENV=production
PORT=3001
JWT_SECRET=your-production-secret-256-bit

# Database  
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# AWS S3 (Required)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-production-bucket

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-production-google-id
GOOGLE_CLIENT_SECRET=your-production-google-secret
FRONTEND_URL=https://yourdomain.com
```

## Scaling Considerations

- **Database**: Migrate SQLite → PostgreSQL for production
- **File Storage**: ✅ **Already using AWS S3** for cloud-scale storage
- **CDN**: Use AWS CloudFront for global delivery
- **Caching**: Add Redis for session management
- **Load Balancing**: Use AWS ALB for high availability
- **Monitoring**: Implement CloudWatch or similar

## Development Tools

- **Backend Hot Reload**: nodemon
- **Frontend Hot Reload**: React Fast Refresh
- **Database Tool**: sqlite3 CLI or DB Browser
- **API Testing**: Built-in health check endpoint
- **AWS CLI**: For S3 bucket management
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
*Professional KSS rating platform for objective sleepiness assessment with enterprise-grade image management* 