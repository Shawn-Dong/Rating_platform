const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken, requireScorerOrGuest } = require('../middleware/auth');

// Submit a score for an image
router.post('/', authenticateToken, requireScorerOrGuest, (req, res) => {
  const { image_id, kss_score, explanation, time_spent_seconds } = req.body;
  const user_id = req.user.id;

  // Validate required fields
  if (!image_id || kss_score === undefined || kss_score === null) {
    return res.status(400).json({ error: 'image_id and kss_score are required' });
  }

  // Validate KSS score range (0-10)
  if (kss_score < 0 || kss_score > 10) {
    return res.status(400).json({ error: 'kss_score must be between 0 and 10' });
  }

  // Check if user has assignment for this image
  const assignmentQuery = 'SELECT id FROM assignments WHERE user_id = ? AND image_id = ? AND status = "pending"';
  
  database.getDb().get(assignmentQuery, [user_id, image_id], (err, assignment) => {
    if (err) {
      console.error('Assignment check error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!assignment) {
      return res.status(403).json({ error: 'No assignment found for this image' });
    }

    // Check if score already exists
    const existingScoreQuery = 'SELECT id FROM scores WHERE user_id = ? AND image_id = ?';
    
    database.getDb().get(existingScoreQuery, [user_id, image_id], (err, existingScore) => {
      if (err) {
        console.error('Existing score check error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      if (existingScore) {
        return res.status(409).json({ error: 'Score already exists for this image' });
      }

      // Insert new score
      const insertQuery = `
        INSERT INTO scores (user_id, image_id, kss_score, explanation, time_spent_seconds)
        VALUES (?, ?, ?, ?, ?)
      `;

      database.getDb().run(insertQuery, [
        user_id, 
        image_id, 
        kss_score, 
        explanation || null, 
        time_spent_seconds || null
      ], function(err) {
        if (err) {
          console.error('Score insertion error:', err.message);
          return res.status(500).json({ error: 'Failed to save score' });
        }

        // Update assignment status to completed
        const updateAssignmentQuery = 'UPDATE assignments SET status = "completed" WHERE user_id = ? AND image_id = ?';
        
        database.getDb().run(updateAssignmentQuery, [user_id, image_id], (err) => {
          if (err) {
            console.error('Assignment update error:', err.message);
            // Don't fail the request, score was saved successfully
          }

          res.status(201).json({
            message: 'Score submitted successfully',
            score_id: this.lastID,
            score: {
              id: this.lastID,
              user_id,
              image_id,
              kss_score,
              explanation,
              time_spent_seconds
            }
          });
        });
      });
    });
  });
});

// Get user's scores
router.get('/my-scores', authenticateToken, requireScorerOrGuest, (req, res) => {
  const user_id = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      s.*,
      i.filename as image_filename,
      i.original_name as image_original_name
    FROM scores s
    JOIN images i ON s.image_id = i.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = 'SELECT COUNT(*) as total FROM scores WHERE user_id = ?';

  // Get total count
  database.getDb().get(countQuery, [user_id], (err, countResult) => {
    if (err) {
      console.error('Count query error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch score count' });
    }

    // Get scores
    database.getDb().all(query, [user_id, parseInt(limit), offset], (err, scores) => {
      if (err) {
        console.error('Scores query error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch scores' });
      }

      res.json({
        scores,
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

// Get score statistics for a user
router.get('/my-stats', authenticateToken, requireScorerOrGuest, (req, res) => {
  const user_id = req.user.id;

  const statsQuery = `
    SELECT 
      COUNT(*) as total_scores,
      AVG(kss_score) as average_score,
      MIN(kss_score) as min_score,
      MAX(kss_score) as max_score,
      AVG(time_spent_seconds) as avg_time_spent,
      COUNT(CASE WHEN explanation IS NOT NULL AND explanation != '' THEN 1 END) as scores_with_explanation
    FROM scores 
    WHERE user_id = ?
  `;

  database.getDb().get(statsQuery, [user_id], (err, stats) => {
    if (err) {
      console.error('Stats query error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    // Get score distribution
    const distributionQuery = `
      SELECT 
        kss_score,
        COUNT(*) as count
      FROM scores 
      WHERE user_id = ?
      GROUP BY kss_score
      ORDER BY kss_score
    `;

    database.getDb().all(distributionQuery, [user_id], (err, distribution) => {
      if (err) {
        console.error('Distribution query error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch score distribution' });
      }

      res.json({
        statistics: {
          total_scores: stats.total_scores || 0,
          average_score: stats.average_score ? parseFloat(stats.average_score.toFixed(2)) : 0,
          min_score: stats.min_score || 0,
          max_score: stats.max_score || 0,
          avg_time_spent: stats.avg_time_spent ? parseFloat(stats.avg_time_spent.toFixed(1)) : 0,
          scores_with_explanation: stats.scores_with_explanation || 0,
          explanation_rate: stats.total_scores > 0 
            ? parseFloat(((stats.scores_with_explanation / stats.total_scores) * 100).toFixed(1))
            : 0
        },
        score_distribution: distribution
      });
    });
  });
});

module.exports = router; 