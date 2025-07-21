const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const passport = require('passport');
require('dotenv').config();

const database = require('./models/database');
const authRoutes = require('./routes/auth');
const imageRoutes = require('./routes/images');
const scoreRoutes = require('./routes/scores');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Serve static images (legacy - now using S3)
// app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'KSS Rating Platform API'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  database.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`KSS Rating Platform API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
}); 