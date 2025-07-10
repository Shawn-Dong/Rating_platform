# Environment Configuration

## Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```bash
# KSS Rating Platform Environment Configuration

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production

# Database Configuration (SQLite - path is relative to backend folder)
DATABASE_PATH=./database/kss_rating.db

# AWS S3 Configuration (for image storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=your-kss-rating-bucket

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration (optional - for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Quick Setup for Development

For development, you can use these minimal settings:

```bash
PORT=3001
NODE_ENV=development
JWT_SECRET=dev-secret-key-please-change-in-production
CORS_ORIGIN=http://localhost:3000
```

## Production Considerations

1. **JWT_SECRET**: Generate a strong, random secret key
2. **AWS S3**: Set up proper S3 bucket with correct permissions
3. **Database**: Consider migrating to PostgreSQL for production
4. **CORS**: Set proper domain origins
5. **Rate Limiting**: Adjust based on expected traffic

## Database Initialization

The SQLite database will be automatically created when you first run the backend server. The database file will be created at `backend/database/kss_rating.db`.

## S3 Setup (Optional)

If you want to use S3 for image storage:

1. Create an S3 bucket
2. Set up IAM user with S3 permissions
3. Configure bucket CORS policy
4. Add credentials to .env file

For development, you can initially store images locally and add S3 integration later. 