const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const OpenAI = require('openai');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Configure Multer for memory storage (not disk)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Helper function to upload file to S3
const uploadToS3 = (fileBuffer, fileName, mimeType) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `images/${fileName}`,
    Body: fileBuffer,
    ContentType: mimeType
    // Note: Public access is handled by bucket policy, not ACL
  };

  return s3.upload(params).promise();
};

// Image Upload Route (Single)
router.post('/images/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFileName = `${uuidv4()}-${Date.now()}${fileExtension}`;

    // Upload to S3
    const s3Result = await uploadToS3(
      req.file.buffer, 
      uniqueFileName, 
      req.file.mimetype
    );

    // Save to database with S3 URL
    const query = 'INSERT INTO images (filename, original_name, s3_url) VALUES (?, ?, ?)';
    database.getDb().run(query, [uniqueFileName, req.file.originalname, s3Result.Location], function(err) {
      if (err) {
        console.error('Error saving image to database:', err.message);
        return res.status(500).json({ error: 'Failed to save image information.' });
      }
      
      res.status(201).json({ 
        message: 'Image uploaded successfully to S3', 
        image: { 
          id: this.lastID, 
          filename: uniqueFileName, 
          originalname: req.file.originalname, 
          url: s3Result.Location 
        } 
      });
    });

  } catch (error) {
    console.error('S3 upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload image to S3',
      details: error.message 
    });
  }
});

// Bulk Image Upload Route (Multiple)
router.post('/images/bulk-upload', upload.array('images', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const results = {
    successful: [],
    failed: [],
    total: req.files.length
  };

  // Process each file
  for (const file of req.files) {
    try {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFileName = `${uuidv4()}-${Date.now()}${fileExtension}`;

      // Upload to S3
      const s3Result = await uploadToS3(
        file.buffer, 
        uniqueFileName, 
        file.mimetype
      );

      // Save to database with S3 URL
      await new Promise((resolve, reject) => {
        const query = 'INSERT INTO images (filename, original_name, s3_url) VALUES (?, ?, ?)';
        database.getDb().run(query, [uniqueFileName, file.originalname, s3Result.Location], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
      });

      results.successful.push({
        originalname: file.originalname,
        filename: uniqueFileName,
        url: s3Result.Location
      });

    } catch (error) {
      console.error('Error uploading file:', file.originalname, error.message);
      results.failed.push({
        originalname: file.originalname,
        error: error.message
      });
    }
  }

  res.json({
    message: `Bulk upload completed: ${results.successful.length} successful, ${results.failed.length} failed`,
    results
  });
});

// Delete Image Route (Soft Delete)
router.delete('/images/:imageId', async (req, res) => {
  const imageId = req.params.imageId;

  if (!imageId || isNaN(imageId)) {
    return res.status(400).json({ error: 'Valid image ID is required' });
  }

  try {
    // First check if image exists and is active
    const checkQuery = 'SELECT * FROM images WHERE id = ? AND is_active = 1';
    
    database.getDb().get(checkQuery, [imageId], (err, image) => {
      if (err) {
        console.error('Error checking image:', err.message);
        return res.status(500).json({ error: 'Failed to check image' });
      }

      if (!image) {
        return res.status(404).json({ error: 'Image not found or already deleted' });
      }

      // Soft delete: set is_active = 0
      const deleteQuery = 'UPDATE images SET is_active = 0 WHERE id = ?';
      
      database.getDb().run(deleteQuery, [imageId], function(err) {
        if (err) {
          console.error('Error deleting image:', err.message);
          return res.status(500).json({ error: 'Failed to delete image' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Image not found' });
        }

        // Also update any pending assignments for this image to 'cancelled'
        const updateAssignmentsQuery = `
          UPDATE assignments 
          SET status = 'cancelled' 
          WHERE image_id = ? AND status = 'pending'
        `;
        
        database.getDb().run(updateAssignmentsQuery, [imageId], (err) => {
          if (err) {
            console.error('Error updating assignments:', err.message);
            // Don't fail the main operation, just log the error
          }
        });

        res.json({ 
          message: 'Image deleted successfully',
          imageId: parseInt(imageId),
          deletedImageInfo: {
            filename: image.filename,
            originalName: image.original_name
          }
        });
      });
    });

  } catch (error) {
    console.error('Error in delete image route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk Delete Images Route
router.delete('/images/bulk-delete', async (req, res) => {
  const { imageIds } = req.body;

  if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({ error: 'imageIds array is required and cannot be empty' });
  }

  // Validate all IDs are numbers
  const invalidIds = imageIds.filter(id => isNaN(id));
  if (invalidIds.length > 0) {
    return res.status(400).json({ error: 'All image IDs must be valid numbers' });
  }

  try {
    const results = {
      successful: [],
      failed: [],
      total: imageIds.length
    };

    // Process each image ID
    for (const imageId of imageIds) {
      try {
        // Check if image exists and is active
        const image = await new Promise((resolve, reject) => {
          database.getDb().get('SELECT * FROM images WHERE id = ? AND is_active = 1', [imageId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!image) {
          results.failed.push({
            imageId: parseInt(imageId),
            error: 'Image not found or already deleted'
          });
          continue;
        }

        // Soft delete the image
        const deleteResult = await new Promise((resolve, reject) => {
          database.getDb().run('UPDATE images SET is_active = 0 WHERE id = ?', [imageId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          });
        });

        if (deleteResult === 0) {
          results.failed.push({
            imageId: parseInt(imageId),
            error: 'Failed to delete image'
          });
          continue;
        }

        // Update assignments for this image
        database.getDb().run(
          'UPDATE assignments SET status = "cancelled" WHERE image_id = ? AND status = "pending"',
          [imageId],
          (err) => {
            if (err) {
              console.error(`Error updating assignments for image ${imageId}:`, err.message);
            }
          }
        );

        results.successful.push({
          imageId: parseInt(imageId),
          filename: image.filename,
          originalName: image.original_name
        });

      } catch (error) {
        console.error(`Error processing image ${imageId}:`, error.message);
        results.failed.push({
          imageId: parseInt(imageId),
          error: error.message
        });
      }
    }

    res.json({
      message: `Bulk delete completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      results
    });

  } catch (error) {
    console.error('Error in bulk delete route:', error);
    res.status(500).json({ error: 'Internal server error during bulk delete' });
  }
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

// Export as Excel
router.get('/export/excel', (req, res) => {
  const workbook = new ExcelJS.Workbook();
  
  // Get comprehensive scoring data
  const query = `
    SELECT 
      u.username,
      u.email,
      u.role,
      i.filename,
      i.original_name,
      i.dataset_name,
      s.kss_score,
      s.explanation,
      s.additional_notes,
      s.time_spent_seconds,
      s.scored_at,
      i.upload_date
    FROM scores s
    JOIN users u ON s.user_id = u.id
    JOIN images i ON s.image_id = i.id
    WHERE i.is_active = 1
    ORDER BY s.scored_at DESC
  `;

  database.getDb().all(query, [], (err, scores) => {
    if (err) {
      console.error('Error fetching scores for export:', err.message);
      return res.status(500).json({ error: 'Failed to export data' });
    }

    // Create worksheet
    const worksheet = workbook.addWorksheet('KSS Scores');
    
    // Add headers
    worksheet.columns = [
      { header: 'Username', key: 'username', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Image Filename', key: 'filename', width: 20 },
      { header: 'Original Name', key: 'original_name', width: 25 },
      { header: 'Dataset', key: 'dataset_name', width: 15 },
      { header: 'KSS Score', key: 'kss_score', width: 12 },
      { header: 'Explanation', key: 'explanation', width: 50 },
      { header: 'Additional Notes', key: 'additional_notes', width: 30 },
      { header: 'Time Spent (seconds)', key: 'time_spent_seconds', width: 18 },
      { header: 'Scored At', key: 'scored_at', width: 20 },
      { header: 'Image Upload Date', key: 'upload_date', width: 20 }
    ];

    // Add data
    scores.forEach(score => {
      worksheet.addRow(score);
    });

    // Style the header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=kss_scores_${new Date().toISOString().split('T')[0]}.xlsx`);

    // Write to response
    workbook.xlsx.write(res).then(() => {
      res.end();
    }).catch(err => {
      console.error('Error writing Excel file:', err);
      res.status(500).json({ error: 'Failed to generate Excel file' });
    });
  });
});

// Export with LLM formatting
router.post('/export/llm-json', async (req, res) => {
  const { apiKey, sampleFormat, includeExplanations = true } = req.body;

  if (!apiKey || !sampleFormat) {
    return res.status(400).json({ 
      error: 'API key and sample format are required' 
    });
  }

  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });

    // Get scoring data
    const query = `
      SELECT 
        u.username,
        i.filename,
        i.original_name,
        i.dataset_name,
        s.kss_score,
        s.explanation,
        s.additional_notes,
        s.time_spent_seconds,
        s.scored_at
      FROM scores s
      JOIN users u ON s.user_id = u.id
      JOIN images i ON s.image_id = i.id
      WHERE i.is_active = 1
      ORDER BY i.id, s.scored_at
    `;

    database.getDb().all(query, [], async (err, scores) => {
      if (err) {
        console.error('Error fetching scores for LLM export:', err.message);
        return res.status(500).json({ error: 'Failed to fetch data' });
      }

      // Group scores by image
      const groupedScores = {};
      scores.forEach(score => {
        if (!groupedScores[score.filename]) {
          groupedScores[score.filename] = {
            filename: score.filename,
            original_name: score.original_name,
            dataset_name: score.dataset_name,
            scores: []
          };
        }
        groupedScores[score.filename].scores.push({
          username: score.username,
          kss_score: score.kss_score,
          explanation: includeExplanations ? score.explanation : undefined,
          additional_notes: score.additional_notes,
          time_spent_seconds: score.time_spent_seconds,
          scored_at: score.scored_at
        });
      });

      // Create prompt for LLM
      const dataForLLM = Object.values(groupedScores).slice(0, 5); // First 5 images as sample
      
      const prompt = `You are a data analyst tasked with reformatting KSS (Karolinska Sleepiness Scale) scoring data into a specific JSON format.

Here is the raw data from our rating platform:
${JSON.stringify(dataForLLM, null, 2)}

Please reformat ALL the provided data according to this exact sample format:
${sampleFormat}

Requirements:
1. Follow the sample format structure EXACTLY
2. Include all images and their associated scores
3. Maintain data integrity - don't modify the actual scores or explanations
4. If the sample format requires additional calculated fields (like averages, statistics), compute them accurately
5. Return only the formatted JSON without any explanations

Format ALL the data provided, not just a sample.`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a data formatting assistant. Return only valid JSON without any markdown formatting or explanations."
            },
            {
              role: "user", 
              content: prompt
            }
          ],
          temperature: 0
        });

        const formattedData = completion.choices[0].message.content;
        
        // Try to parse to ensure valid JSON
        let jsonData;
        try {
          jsonData = JSON.parse(formattedData);
        } catch (parseErr) {
          console.error('LLM returned invalid JSON:', parseErr);
          return res.status(500).json({ 
            error: 'LLM returned invalid JSON format',
            raw_response: formattedData
          });
        }

        // Set response headers for JSON file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=kss_scores_formatted_${new Date().toISOString().split('T')[0]}.json`);
        
        res.json(jsonData);

      } catch (llmError) {
        console.error('OpenAI API error:', llmError);
        return res.status(500).json({ 
          error: 'Failed to process data with LLM',
          details: llmError.message
        });
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Failed to process export request',
      details: error.message
    });
  }
});

module.exports = router; 