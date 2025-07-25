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
      role: user.role,
      guest_name: user.guest_name || null,
      is_guest: user.is_guest || false
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

// Get user by ID (supporting guest users)
const getUserById = (userId, callback) => {
  const query = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
  database.getDb().get(query, [userId], callback);
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
};

// Scorer or Guest middleware (allows both roles)
const requireScorerOrGuest = (req, res, next) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'This endpoint is for guest users only' });
  }
  next();
};

module.exports = {
  generateToken,
  authenticateToken,
  getUserById,
  requireAdmin,
  requireScorerOrGuest
}; 