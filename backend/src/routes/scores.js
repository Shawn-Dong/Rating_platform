const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

// Submit a new score with explanation
router.post('/', authenticateToken, (req, res) => {
  const { image_id, kss_score, explanation, additional_notes, time_spent_seconds } = req.body;
  const user_id = req.user.id;

  // Validation
  if (!image_id || !kss_score || !explanation) {
    return res.status(400).json({ 
      error: 'Missing required fields: image_id, kss_score, and explanation are required' 
    });
  }

  if (kss_score < 1 || kss_score > 9) {
    return res.status(400).json({ 
      error: 'KSS score must be between 1 and 9' 
    });
  }

  if (explanation.trim().length < 10) {
    return res.status(400).json({ 
      error: 'Explanation must be at least 10 characters long' 
    });
  }

  const query = `
    INSERT OR REPLACE INTO scores 
    (user_id, image_id, kss_score, explanation, additional_notes, time_spent_seconds)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  database.getDb().run(query, [
    user_id, 
    image_id, 
    kss_score, 
    explanation.trim(), 
    additional_notes?.trim() || null,
    time_spent_seconds || null
  ], function(err) {
    if (err) {
      console.error('Error saving score:', err.message);
      return res.status(500).json({ error: 'Failed to save score' });
    }

    // Update assignment status
    const updateAssignment = `
      UPDATE assignments 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND image_id = ?
    `;
    
    database.getDb().run(updateAssignment, [user_id, image_id], (err) => {
      if (err) {
        console.error('Error updating assignment:', err.message);
      }
    });

    res.json({ 
      success: true, 
      score_id: this.lastID,
      message: 'Score and explanation saved successfully'
    });
  });
});

// Get user's scores with explanations
router.get('/my-scores', authenticateToken, (req, res) => {
  const user_id = req.user.id;
  
  const query = `
    SELECT s.*, i.filename, i.original_name 
    FROM scores s
    JOIN images i ON s.image_id = i.id
    WHERE s.user_id = ?
    ORDER BY s.scored_at DESC
  `;

  database.getDb().all(query, [user_id], (err, rows) => {
    if (err) {
      console.error('Error fetching scores:', err.message);
      return res.status(500).json({ error: 'Failed to fetch scores' });
    }

    res.json({ scores: rows });
  });
});

// Get all scores for an image (admin only)
router.get('/image/:imageId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const imageId = req.params.imageId;
  
  const query = `
    SELECT s.*, u.username 
    FROM scores s
    JOIN users u ON s.user_id = u.id
    WHERE s.image_id = ?
    ORDER BY s.scored_at DESC
  `;

  database.getDb().all(query, [imageId], (err, rows) => {
    if (err) {
      console.error('Error fetching image scores:', err.message);
      return res.status(500).json({ error: 'Failed to fetch image scores' });
    }

    // Calculate statistics
    const scores = rows.map(r => r.kss_score);
    const stats = {
      count: scores.length,
      average: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0,
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0
    };

    res.json({ 
      scores: rows,
      statistics: stats
    });
  });
});

module.exports = router; 