const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const database = require('../models/database');
const { generateToken, authenticateToken, getUserById } = require('../middleware/auth');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Passport.js Google OAuth2 Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    const db = database.getDb();
    db.get('SELECT * FROM users WHERE google_id = ?', [profile.id], (err, user) => {
      if (err) { return cb(err); }
      if (user) { return cb(null, user); }

      // Create a new user if not found
      const newUser = {
        google_id: profile.id,
        username: profile.displayName,
        email: profile.emails[0].value,
        avatar_url: profile.photos[0].value
      };

      db.run('INSERT INTO users (google_id, username, email, avatar_url) VALUES (?, ?, ?, ?)',
        [newUser.google_id, newUser.username, newUser.email, newUser.avatar_url],
        function(err) {
          if (err) { return cb(err); }
          newUser.id = this.lastID;
          return cb(null, newUser);
        }
      );
    });
  }
));

// Google Auth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }),
  function(req, res) {
    // Successful authentication, generate a JWT
    const token = generateToken(req.user);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// Register new user
router.post('/register', (req, res) => {
  const { username, email, password, role = 'scorer' } = req.body;

  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Check if user already exists
  const checkQuery = 'SELECT id FROM users WHERE username = ? OR email = ?';
  database.getDb().get(checkQuery, [username, email], (err, row) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (row) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password and create user
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Password hashing error:', err.message);
        return res.status(500).json({ error: 'Failed to process password' });
      }

      const insertQuery = `
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `;

      database.getDb().run(insertQuery, [username, email, hashedPassword, role], function(err) {
        if (err) {
          console.error('User creation error:', err.message);
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const user = {
          id: this.lastID,
          username,
          email,
          role
        };

        const token = generateToken(user);

        res.status(201).json({
          message: 'User created successfully',
          user: { id: user.id, username, email, role },
          token
        });
      });
    });
  });
});

// Login user
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Find user by username or email
  const query = 'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1';
  database.getDb().get(query, [username, username], (err, user) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err) {
        console.error('Password comparison error:', err.message);
        return res.status(500).json({ error: 'Authentication error' });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user);

      res.json({
        message: 'Login successful',
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          role: user.role 
        },
        token
      });
    });
  });
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
  getUserById(req.user.id, (err, user) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  });
});

// Refresh token
router.post('/refresh', authenticateToken, (req, res) => {
  getUserById(req.user.id, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const newToken = generateToken(user);
    res.json({ token: newToken });
  });
});

// Change password
router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  // Get current user with password
  const query = 'SELECT * FROM users WHERE id = ?';
  database.getDb().get(query, [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Verify current password
    bcrypt.compare(currentPassword, user.password_hash, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to process new password' });
        }

        // Update password
        const updateQuery = 'UPDATE users SET password_hash = ? WHERE id = ?';
        database.getDb().run(updateQuery, [hashedPassword, req.user.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update password' });
          }

          res.json({ message: 'Password updated successfully' });
        });
      });
    });
  });
});

module.exports = router; 