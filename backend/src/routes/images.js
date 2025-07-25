const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken, requireAdmin, requireScorerOrGuest } = require('../middleware/auth');

// Get next image for user to score
router.get('/next', authenticateToken, requireScorerOrGuest, (req, res) => {
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
router.get('/progress', authenticateToken, requireScorerOrGuest, (req, res) => {
  const user_id = req.user.id;
  
  const progressQuery = `
    SELECT 
      COUNT(a.id) as total_assigned,
      COUNT(s.id) as completed,
      (COUNT(a.id) - COUNT(s.id)) as remaining
    FROM assignments a
    LEFT JOIN scores s ON (s.user_id = a.user_id AND s.image_id = a.image_id)
    WHERE a.user_id = ? AND a.status IN ('pending', 'completed')
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

// Get all images (admin only)
router.get('/all', authenticateToken, requireAdmin, (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE i.is_active = 1';
  let queryParams = [];

  if (search) {
    whereClause += ' AND (i.filename LIKE ? OR i.original_name LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  const countQuery = `SELECT COUNT(*) as total FROM images i ${whereClause}`;
  
  const dataQuery = `
    SELECT 
      i.*,
      u.username as uploaded_by_username,
      COUNT(DISTINCT a.user_id) as assigned_users,
      COUNT(DISTINCT s.user_id) as scored_by_users
    FROM images i
    LEFT JOIN users u ON i.uploaded_by = u.id
    LEFT JOIN assignments a ON i.id = a.image_id
    LEFT JOIN scores s ON i.id = s.image_id
    ${whereClause}
    GROUP BY i.id
    ORDER BY i.upload_date DESC
    LIMIT ? OFFSET ?
  `;

  // Get total count
  database.getDb().get(countQuery, queryParams, (err, countResult) => {
    if (err) {
      console.error('Count query error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch image count' });
    }

    // Get data
    database.getDb().all(dataQuery, [...queryParams, parseInt(limit), offset], (err, images) => {
      if (err) {
        console.error('Data query error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch images' });
      }

      res.json({
        images,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(countResult.total / limit),
          total_items: countResult.total,
          items_per_page: parseInt(limit)
        }
      });
    });
  });
});

// Get specific image (for scoring interface)
router.get('/:imageId', authenticateToken, requireScorerOrGuest, (req, res) => {
  const { imageId } = req.params;
  const user_id = req.user.id;

  // Check if user has access to this image (through assignment)
  const accessQuery = `
    SELECT 
      i.*,
      a.assigned_at,
      s.id as score_id,
      s.kss_score,
      s.explanation,
      s.time_spent_seconds,
      s.created_at as scored_at
    FROM images i
    JOIN assignments a ON i.id = a.image_id
    LEFT JOIN scores s ON (s.user_id = a.user_id AND s.image_id = a.image_id)
    WHERE i.id = ? AND a.user_id = ? AND i.is_active = 1
  `;

  database.getDb().get(accessQuery, [imageId, user_id], (err, image) => {
    if (err) {
      console.error('Error fetching image:', err.message);
      return res.status(500).json({ error: 'Failed to fetch image' });
    }

    if (!image) {
      return res.status(404).json({ error: 'Image not found or not assigned to user' });
    }

    res.json({ image });
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
  const getUsersQuery = "SELECT id FROM users WHERE role = 'guest'";
  
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