const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Image Upload Route
router.post('/images/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { originalname, filename } = req.file;
  const imageUrl = `/images/${filename}`;

  const query = 'INSERT INTO images (filename, original_name, s3_url) VALUES (?, ?, ?)';
  database.getDb().run(query, [filename, originalname, imageUrl], function(err) {
    if (err) {
      console.error('Error saving image to database:', err.message);
      return res.status(500).json({ error: 'Failed to save image information.' });
    }
    res.status(201).json({ 
      message: 'Image uploaded successfully', 
      image: { 
        id: this.lastID, 
        filename, 
        originalname, 
        url: imageUrl 
      } 
    });
  });
});

// Get dashboard statistics
router.get('/dashboard', (req, res) => {
  const queries = {
    users: 'SELECT COUNT(*) as total FROM users WHERE is_active = 1',
    scorers: "SELECT COUNT(*) as total FROM users WHERE role = 'scorer' AND is_active = 1",
    images: 'SELECT COUNT(*) as total FROM images WHERE is_active = 1',
    scores: 'SELECT COUNT(*) as total FROM scores',
    assignments: 'SELECT COUNT(*) as total FROM assignments',
    completed_assignments: "SELECT COUNT(*) as total FROM assignments WHERE status = 'completed'"
  };

  const stats = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    database.getDb().get(query, [], (err, result) => {
      if (!err && result) {
        stats[key] = result.total;
      } else {
        stats[key] = 0;
      }
      
      completed++;
      if (completed === totalQueries) {
        // Calculate completion rate
        stats.completion_rate = stats.assignments > 0 
          ? Math.round((stats.completed_assignments / stats.assignments) * 100)
          : 0;
        
        res.json({ statistics: stats });
      }
    });
  });
});

// Get all users with their statistics
router.get('/users', (req, res) => {
  const query = `
    SELECT 
      u.id, u.username, u.email, u.role, u.created_at, u.is_active,
      COUNT(DISTINCT a.id) as assigned_images,
      COUNT(DISTINCT s.id) as completed_scores,
      AVG(s.kss_score) as avg_score,
      MAX(s.scored_at) as last_activity
    FROM users u
    LEFT JOIN assignments a ON u.id = a.user_id
    LEFT JOIN scores s ON u.id = s.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `;

  database.getDb().all(query, [], (err, users) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json({ users });
  });
});

// Create new user (admin)
router.post('/users', (req, res) => {
  const { username, email, password, role = 'scorer' } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (!['scorer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either "scorer" or "admin"' });
  }

  const bcrypt = require('bcryptjs');
  
  // Check if user exists
  const checkQuery = 'SELECT id FROM users WHERE username = ? OR email = ?';
  database.getDb().get(checkQuery, [username, email], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password and create user
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
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

        res.status(201).json({
          message: 'User created successfully',
          user: { 
            id: this.lastID, 
            username, 
            email, 
            role 
          }
        });
      });
    });
  });
});

// Update user status (activate/deactivate)
router.patch('/users/:userId/status', (req, res) => {
  const userId = req.params.userId;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be a boolean value' });
  }

  const query = 'UPDATE users SET is_active = ? WHERE id = ?';
  database.getDb().run(query, [is_active ? 1 : 0, userId], function(err) {
    if (err) {
      console.error('Error updating user status:', err.message);
      return res.status(500).json({ error: 'Failed to update user status' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      changes: this.changes
    });
  });
});

// Get scoring analytics
router.get('/analytics/scores', (req, res) => {
  const queries = {
    scoreDistribution: `
      SELECT kss_score, COUNT(*) as count 
      FROM scores 
      GROUP BY kss_score 
      ORDER BY kss_score
    `,
    averageByUser: `
      SELECT u.username, COUNT(s.id) as total_scores, AVG(s.kss_score) as avg_score
      FROM users u
      LEFT JOIN scores s ON u.id = s.user_id
      WHERE u.role = 'scorer' AND u.is_active = 1
      GROUP BY u.id, u.username
      HAVING total_scores > 0
      ORDER BY total_scores DESC
    `,
    recentActivity: `
      SELECT 
        DATE(s.scored_at) as date,
        COUNT(*) as scores_count
      FROM scores s
      WHERE s.scored_at >= date('now', '-30 days')
      GROUP BY DATE(s.scored_at)
      ORDER BY date DESC
    `
  };

  const analytics = {};
  let completed = 0;

  Object.entries(queries).forEach(([key, query]) => {
    database.getDb().all(query, [], (err, results) => {
      if (!err) {
        analytics[key] = results;
      } else {
        console.error(`Error in ${key} query:`, err.message);
        analytics[key] = [];
      }
      
      completed++;
      if (completed === Object.keys(queries).length) {
        res.json({ analytics });
      }
    });
  });
});

// Get inter-rater reliability for specific images
router.get('/analytics/reliability', (req, res) => {
  const query = `
    SELECT 
      i.id as image_id,
      i.filename,
      COUNT(s.id) as scorer_count,
      AVG(s.kss_score) as mean_score,
      MIN(s.kss_score) as min_score,
      MAX(s.kss_score) as max_score,
      (MAX(s.kss_score) - MIN(s.kss_score)) as score_range
    FROM images i
    LEFT JOIN scores s ON i.id = s.image_id
    WHERE i.is_active = 1
    GROUP BY i.id, i.filename
    HAVING scorer_count > 1
    ORDER BY score_range DESC, scorer_count DESC
  `;

  database.getDb().all(query, [], (err, results) => {
    if (err) {
      console.error('Error fetching reliability data:', err.message);
      return res.status(500).json({ error: 'Failed to fetch reliability data' });
    }

    res.json({ reliability_analysis: results });
  });
});

// Export scoring data (CSV format)
router.get('/export/scores', (req, res) => {
  const query = `
    SELECT 
      s.id as score_id,
      u.username as scorer,
      i.filename as image_file,
      i.original_name,
      s.kss_score,
      s.explanation,
      s.additional_notes,
      s.time_spent_seconds,
      s.scored_at
    FROM scores s
    JOIN users u ON s.user_id = u.id
    JOIN images i ON s.image_id = i.id
    ORDER BY s.scored_at DESC
  `;

  database.getDb().all(query, [], (err, scores) => {
    if (err) {
      console.error('Error exporting scores:', err.message);
      return res.status(500).json({ error: 'Failed to export scores' });
    }

    // Convert to CSV
    if (scores.length === 0) {
      return res.json({ message: 'No scores to export', data: [] });
    }

    const headers = Object.keys(scores[0]);
    const csvHeaders = headers.join(',');
    const csvRows = scores.map(score => 
      headers.map(header => {
        const value = score[header];
        // Escape commas and quotes in text fields
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    );

    const csv = [csvHeaders, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="kss_scores_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  });
});

// Bulk assign images to users
router.post('/bulk-assign', (req, res) => {
  const { assignment_type, user_ids, image_ids } = req.body;

  if (!assignment_type || !['specific', 'all_to_all'].includes(assignment_type)) {
    return res.status(400).json({ 
      error: 'assignment_type must be "specific" or "all_to_all"' 
    });
  }

  if (assignment_type === 'specific' && (!user_ids || !image_ids)) {
    return res.status(400).json({ 
      error: 'user_ids and image_ids are required for specific assignments' 
    });
  }

  if (assignment_type === 'all_to_all') {
    // Assign all available images to all active scorers
    const getUsersQuery = "SELECT id FROM users WHERE role = 'scorer' AND is_active = 1";
    const getImagesQuery = "SELECT id FROM images WHERE is_active = 1";

    database.getDb().all(getUsersQuery, [], (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch users' });
      }

      database.getDb().all(getImagesQuery, [], (err, images) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch images' });
        }

        // Create all assignments
        const assignments = [];
        users.forEach(user => {
          images.forEach(image => {
            assignments.push([user.id, image.id]);
          });
        });

        assignmentsBulkInsert(assignments, res);
      });
    });
  } else {
    // Specific assignments
    const assignments = [];
    user_ids.forEach(user_id => {
      image_ids.forEach(image_id => {
        assignments.push([user_id, image_id]);
      });
    });

    assignmentsBulkInsert(assignments, res);
  }
});

// Helper function for bulk assignment insertion
function assignmentsBulkInsert(assignments, res) {
  if (assignments.length === 0) {
    return res.json({ message: 'No assignments to create', successful: 0 });
  }

  const query = 'INSERT OR IGNORE INTO assignments (user_id, image_id) VALUES (?, ?)';
  let completed = 0;
  let successful = 0;

  assignments.forEach(([user_id, image_id]) => {
    database.getDb().run(query, [user_id, image_id], function(err) {
      completed++;
      if (!err && this.changes > 0) {
        successful++;
      }

      if (completed === assignments.length) {
        res.json({
          message: 'Bulk assignment completed',
          successful,
          total_attempted: assignments.length,
          skipped: assignments.length - successful
        });
      }
    });
  });
}

module.exports = router; 