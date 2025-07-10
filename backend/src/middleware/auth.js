const jwt = require('jsonwebtoken');
const database = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'kss-rating-platform-secret-key-2024';

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify JWT token middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get user from database by ID
const getUserById = (userId, callback) => {
  const query = 'SELECT id, username, email, role, created_at, is_active FROM users WHERE id = ? AND is_active = 1';
  database.getDb().get(query, [userId], callback);
};

module.exports = {
  generateToken,
  authenticateToken,
  requireAdmin,
  getUserById
}; 