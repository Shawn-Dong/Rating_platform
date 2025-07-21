const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get next image for user to score
router.get('/next', authenticateToken, (req, res) => {
  const user_id = req.user.id;
  
  // Find next unscored assigned image
  const query = `
    SELECT i.*, a.assigned_at 
    FROM assignments a
    JOIN images i ON a.image_id = i.id
    LEFT JOIN scores s ON (s.user_id = a.user_id AND s.image_id = a.image_id)
    WHERE a.user_id = ? 
      AND a.status = 'pending' 
      AND i.is_active = 1 
      AND s.id IS NULL
    ORDER BY a.assigned_at ASC
    LIMIT 1
  `;

  database.getDb().get(query, [user_id], (err, image) => {
    if (err) {
      console.error('Error fetching next image:', err.message);
      return res.status(500).json({ error: 'Failed to fetch next image' });
    }

    if (!image) {
      return res.json({ 
        image: null, 
        message: 'No more images assigned to score' 
      });
    }

    res.json({ image });
  });
});

// Get user's scoring progress
router.get('/progress', authenticateToken, (req, res) => {
  const user_id = req.user.id;
  
  const progressQuery = `
    SELECT 
      COUNT(a.id) as total_assigned,
      COUNT(s.id) as completed,
      COUNT(a.id) - COUNT(s.id) as remaining
    FROM assignments a
    LEFT JOIN scores s ON (s.user_id = a.user_id AND s.image_id = a.image_id)
    WHERE a.user_id = ?
  `;

  database.getDb().get(progressQuery, [user_id], (err, progress) => {
    if (err) {
      console.error('Error fetching progress:', err.message);
      return res.status(500).json({ error: 'Failed to fetch progress' });
    }

    res.json({ 
      progress: {
        total_assigned: progress.total_assigned || 0,
        completed: progress.completed || 0,
        remaining: progress.remaining || 0,
        completion_percentage: progress.total_assigned > 0 
          ? Math.round((progress.completed / progress.total_assigned) * 100) 
          : 0
      }
    });
  });
});

// Get list of images with scoring status (admin only)
router.get('/all', authenticateToken, requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      i.*,
      COUNT(DISTINCT a.user_id) as assigned_to,
      COUNT(DISTINCT s.user_id) as scored_by,
      AVG(s.kss_score) as avg_score
    FROM images i
    LEFT JOIN assignments a ON i.id = a.image_id
    LEFT JOIN scores s ON i.id = s.image_id
    WHERE i.is_active = 1
    GROUP BY i.id
    ORDER BY i.upload_date DESC
    LIMIT ? OFFSET ?
  `;

  database.getDb().all(query, [limit, offset], (err, images) => {
    if (err) {
      console.error('Error fetching images:', err.message);
      return res.status(500).json({ error: 'Failed to fetch images' });
    }

    // Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM images WHERE is_active = 1';
    database.getDb().get(countQuery, [], (err, countResult) => {
      if (err) {
        console.error('Error counting images:', err.message);
        return res.status(500).json({ error: 'Failed to count images' });
      }

      res.json({
        images,
        pagination: {
          page,
          limit,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Get specific image details (for admin or if user has access)
router.get('/:imageId', authenticateToken, (req, res) => {
  const imageId = req.params.imageId;
  const user_id = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Check if user has access to this image
  let accessQuery;
  let queryParams;

  if (isAdmin) {
    accessQuery = 'SELECT * FROM images WHERE id = ? AND is_active = 1';
    queryParams = [imageId];
  } else {
    accessQuery = `
      SELECT i.* FROM images i
      JOIN assignments a ON i.id = a.image_id
      WHERE i.id = ? AND a.user_id = ? AND i.is_active = 1
    `;
    queryParams = [imageId, user_id];
  }

  database.getDb().get(accessQuery, queryParams, (err, image) => {
    if (err) {
      console.error('Error fetching image:', err.message);
      return res.status(500).json({ error: 'Failed to fetch image' });
    }

    if (!image) {
      return res.status(404).json({ error: 'Image not found or access denied' });
    }

    // If admin, include scoring statistics and all individual scores
    if (isAdmin) {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_scores,
          AVG(kss_score) as avg_score,
          MIN(kss_score) as min_score,
          MAX(kss_score) as max_score
        FROM scores 
        WHERE image_id = ?
      `;

      const individualScoresQuery = `
        SELECT 
          s.id as score_id,
          u.username as scorer_username,
          s.kss_score,
          s.explanation,
          s.additional_notes,
          s.time_spent_seconds,
          s.scored_at
        FROM scores s
        JOIN users u ON s.user_id = u.id
        WHERE s.image_id = ?
        ORDER BY s.scored_at DESC
      `;

      database.getDb().get(statsQuery, [imageId], (err, stats) => {
        if (err) {
          console.error('Error fetching image stats:', err.message);
          return res.json({ image });
        }

        database.getDb().all(individualScoresQuery, [imageId], (err, individualScores) => {
          if (err) {
            console.error('Error fetching individual scores:', err.message);
            return res.json({ image, statistics: stats });
          }

          res.json({ 
            image, 
            statistics: stats,
            individual_scores: individualScores
          });
        });
      });
    } else {
      res.json({ image });
    }
  });
});

// Assign images to users (admin only)
router.post('/assign', authenticateToken, requireAdmin, (req, res) => {
  const { user_ids, image_ids } = req.body;

  if (!user_ids || !image_ids || !Array.isArray(user_ids) || !Array.isArray(image_ids)) {
    return res.status(400).json({ 
      error: 'user_ids and image_ids must be provided as arrays' 
    });
  }

  const assignments = [];
  user_ids.forEach(user_id => {
    image_ids.forEach(image_id => {
      assignments.push([user_id, image_id]);
    });
  });

  if (assignments.length === 0) {
    return res.status(400).json({ error: 'No assignments to create' });
  }

  const query = `
    INSERT OR IGNORE INTO assignments (user_id, image_id)
    VALUES (?, ?)
  `;

  let completed = 0;
  let errors = 0;

  assignments.forEach(([user_id, image_id]) => {
    database.getDb().run(query, [user_id, image_id], function(err) {
      completed++;
      if (err) {
        console.error('Assignment error:', err.message);
        errors++;
      }

      // Send response when all assignments are processed
      if (completed === assignments.length) {
        res.json({
          message: 'Assignment process completed',
          total_attempted: assignments.length,
          successful: assignments.length - errors,
          failed: errors
        });
      }
    });
  });
});

// Auto-assign images to all active scorers (admin only)
router.post('/auto-assign', authenticateToken, requireAdmin, (req, res) => {
  const { image_ids, images_per_scorer = 1 } = req.body;

  if (!image_ids || !Array.isArray(image_ids)) {
    return res.status(400).json({ error: 'image_ids array is required' });
  }

  // Get all active scorers
  const getUsersQuery = "SELECT id FROM users WHERE role = 'scorer' AND is_active = 1";
  
  database.getDb().all(getUsersQuery, [], (err, users) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    if (users.length === 0) {
      return res.status(400).json({ error: 'No active scorers found' });
    }

    const assignments = [];
    
    // For each image, assign to all users (or limit per images_per_scorer)
    image_ids.forEach(image_id => {
      users.forEach(user => {
        assignments.push([user.id, image_id]);
      });
    });

    // Insert assignments
    const query = 'INSERT OR IGNORE INTO assignments (user_id, image_id) VALUES (?, ?)';
    let completed = 0;
    let successful = 0;

    if (assignments.length === 0) {
      return res.json({ message: 'No assignments created', successful: 0, total: 0 });
    }

    assignments.forEach(([user_id, image_id]) => {
      database.getDb().run(query, [user_id, image_id], function(err) {
        completed++;
        if (!err && this.changes > 0) {
          successful++;
        }

        if (completed === assignments.length) {
          res.json({
            message: 'Auto-assignment completed',
            successful,
            total_attempted: assignments.length,
            users_count: users.length,
            images_count: image_ids.length
          });
        }
      });
    });
  });
});

module.exports = router; 