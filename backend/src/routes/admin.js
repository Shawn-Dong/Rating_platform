const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const OpenAI = require('openai');

// Configure AWS S3 (only if not using local storage)
const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';
let s3;
if (!useLocalStorage) {
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });
}

// Create uploads directory for local storage
const uploadsDir = path.join(__dirname, '../../public/images');
if (useLocalStorage && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
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

// Helper function to save file locally
const saveFileLocally = (fileBuffer, fileName) => {
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, fileBuffer);
  return `/images/${fileName}`;
};

// Image Upload Route (Single)
router.post('/images/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { folder_id } = req.body;

  try {
    // Validate folder if provided
    if (folder_id) {
      const folderExists = await new Promise((resolve, reject) => {
        database.getDb().get('SELECT id FROM folders WHERE id = ? AND is_active = 1', [folder_id], (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        });
      });

      if (!folderExists) {
        return res.status(400).json({ error: 'Invalid folder ID' });
      }
    }

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFileName = `${uuidv4()}-${Date.now()}${fileExtension}`;

    let imageUrl;
    if (useLocalStorage) {
      // Save locally for development
      imageUrl = saveFileLocally(req.file.buffer, uniqueFileName);
    } else {
      // Upload to S3 for production
      const s3Result = await uploadToS3(
        req.file.buffer, 
        uniqueFileName, 
        req.file.mimetype
      );
      imageUrl = s3Result.Location;
    }

    // Save to database with folder_id
    const query = 'INSERT INTO images (filename, original_name, s3_url, file_path, uploaded_by, folder_id) VALUES (?, ?, ?, ?, ?, ?)';
    database.getDb().run(query, [uniqueFileName, req.file.originalname, imageUrl, imageUrl, req.user.id || 1, folder_id || null], function(err) {
      if (err) {
        console.error('Error saving image to database:', err.message);
        return res.status(500).json({ error: 'Failed to save image information.' });
      }
      
      res.status(201).json({ 
        message: useLocalStorage ? 'Image uploaded successfully (local)' : 'Image uploaded successfully to S3', 
        image: { 
          id: this.lastID, 
          filename: uniqueFileName, 
          originalname: req.file.originalname, 
          url: imageUrl,
          folder_id: folder_id || null
        } 
      });
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: useLocalStorage ? 'Failed to upload image locally' : 'Failed to upload image to S3',
      details: error.message 
    });
  }
});

// Bulk Image Upload Route (Multiple)
router.post('/images/bulk-upload', upload.array('images', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const { folder_id } = req.body;

  // Validate folder if provided
  if (folder_id) {
    try {
      const folderExists = await new Promise((resolve, reject) => {
        database.getDb().get('SELECT id FROM folders WHERE id = ? AND is_active = 1', [folder_id], (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        });
      });

      if (!folderExists) {
        return res.status(400).json({ error: 'Invalid folder ID' });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Database error while validating folder' });
    }
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

      let imageUrl;
      if (useLocalStorage) {
        // Save locally for development
        imageUrl = saveFileLocally(file.buffer, uniqueFileName);
      } else {
        // Upload to S3 for production
        const s3Result = await uploadToS3(
          file.buffer, 
          uniqueFileName, 
          file.mimetype
        );
        imageUrl = s3Result.Location;
      }

      // Save to database with folder_id
      await new Promise((resolve, reject) => {
        const query = 'INSERT INTO images (filename, original_name, s3_url, file_path, uploaded_by, folder_id) VALUES (?, ?, ?, ?, ?, ?)';
        database.getDb().run(query, [uniqueFileName, file.originalname, imageUrl, imageUrl, req.user.id || 1, folder_id || null], function(err) {
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
        url: imageUrl,
        folder_id: folder_id || null
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
    message: `Bulk upload completed: ${results.successful.length} successful, ${results.failed.length} failed (${useLocalStorage ? 'local storage' : 'S3'})`,
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
            guests: "SELECT COUNT(*) as total FROM users WHERE role = 'guest'",
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
      u.id, u.username, u.email, u.role, u.is_active,
      COUNT(DISTINCT a.id) as assigned_images,
      COUNT(DISTINCT s.id) as completed_scores,
      AVG(s.kss_score) as avg_score,
      MAX(s.scored_at) as last_activity
    FROM users u
    LEFT JOIN assignments a ON u.id = a.user_id
    LEFT JOIN scores s ON u.id = s.user_id
    GROUP BY u.id
    ORDER BY u.id ASC
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
  const { username, email, password, role = 'admin' } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (role !== 'admin') {
    return res.status(400).json({ error: 'Only admin users can be created through this endpoint' });
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

// Delete user (admin only)
router.delete('/users/:userId', (req, res) => {
  const { userId } = req.params;

  // Prevent admin from deleting themselves
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  // Check if user exists and get their info first
  const getUserQuery = 'SELECT id, username, role, is_guest FROM users WHERE id = ?';
  database.getDb().get(getUserQuery, [userId], (err, user) => {
    if (err) {
      console.error('User lookup error:', err.message);
      return res.status(500).json({ error: 'Failed to lookup user' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Start transaction to delete user and related data
    database.getDb().serialize(() => {
      database.getDb().run('BEGIN TRANSACTION');

      // Delete user's scores
      database.getDb().run('DELETE FROM scores WHERE user_id = ?', [userId], (err) => {
        if (err) {
          console.error('Error deleting user scores:', err.message);
          database.getDb().run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to delete user data' });
        }

        // Delete user's assignments
        database.getDb().run('DELETE FROM assignments WHERE user_id = ?', [userId], (err) => {
          if (err) {
            console.error('Error deleting user assignments:', err.message);
            database.getDb().run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to delete user data' });
          }

          // Finally delete the user
          database.getDb().run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
              console.error('Error deleting user:', err.message);
              database.getDb().run('ROLLBACK');
              return res.status(500).json({ error: 'Failed to delete user' });
            }

            database.getDb().run('COMMIT');
            res.json({ 
              message: `User "${user.username}" deleted successfully`,
              deletedUser: {
                id: user.id,
                username: user.username,
                role: user.role,
                was_guest: user.is_guest
              }
            });
          });
        });
      });
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
      WHERE u.role = 'guest'
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

// Get analytics data grouped by folders
router.get('/analytics/folders', (req, res) => {
  const query = `
    SELECT 
      f.id as folder_id,
      f.name as folder_name,
      f.description as folder_description,
      COUNT(DISTINCT i.id) as total_images,
      COUNT(DISTINCT a.user_id) as assigned_users,
      COUNT(DISTINCT s.user_id) as scored_users,
      COUNT(s.id) as total_scores,
      AVG(s.kss_score) as avg_score,
      MIN(s.kss_score) as min_score,
      MAX(s.kss_score) as max_score
    FROM folders f
    LEFT JOIN images i ON f.id = i.folder_id AND i.is_active = 1
    LEFT JOIN assignments a ON i.id = a.image_id
    LEFT JOIN scores s ON i.id = s.image_id
    WHERE f.is_active = 1
    GROUP BY f.id, f.name, f.description
    ORDER BY f.name ASC
  `;

  database.getDb().all(query, [], (err, folderStats) => {
    if (err) {
      console.error('Error fetching folder analytics:', err.message);
      return res.status(500).json({ error: 'Failed to fetch folder analytics' });
    }

    // For each folder, get the detailed image data
    const foldersWithImages = [];
    let completedFolders = 0;

    if (folderStats.length === 0) {
      return res.json({ folders: [] });
    }

    folderStats.forEach(folder => {
      const imageQuery = `
        SELECT 
          i.id,
          i.filename,
          i.original_name,
          i.s3_url,
          i.upload_date,
          COUNT(DISTINCT a.user_id) as assigned_to,
          COUNT(DISTINCT s.user_id) as scored_by,
          AVG(s.kss_score) as avg_score,
          COUNT(s.id) as total_individual_scores
        FROM images i
        LEFT JOIN assignments a ON i.id = a.image_id
        LEFT JOIN scores s ON i.id = s.image_id
        WHERE i.folder_id = ? AND i.is_active = 1
        GROUP BY i.id, i.filename, i.original_name, i.s3_url, i.upload_date
        ORDER BY i.upload_date DESC
      `;

      database.getDb().all(imageQuery, [folder.folder_id], (err, images) => {
        completedFolders++;
        
        if (!err) {
          foldersWithImages.push({
            ...folder,
            images: images || []
          });
        } else {
          console.error(`Error fetching images for folder ${folder.folder_id}:`, err.message);
          foldersWithImages.push({
            ...folder,
            images: []
          });
        }

        if (completedFolders === folderStats.length) {
          // Sort folders by name
          foldersWithImages.sort((a, b) => a.folder_name.localeCompare(b.folder_name));
          res.json({ folders: foldersWithImages });
        }
      });
    });
  });
});

// Get detailed analytics for a specific folder
router.get('/analytics/folders/:folderId', (req, res) => {
  const { folderId } = req.params;

  const folderQuery = `
    SELECT 
      f.id as folder_id,
      f.name as folder_name,
      f.description as folder_description,
      COUNT(DISTINCT i.id) as total_images,
      COUNT(DISTINCT a.user_id) as assigned_users,
      COUNT(DISTINCT s.user_id) as scored_users,
      COUNT(s.id) as total_scores,
      AVG(s.kss_score) as avg_score,
      MIN(s.kss_score) as min_score,
      MAX(s.kss_score) as max_score
    FROM folders f
    LEFT JOIN images i ON f.id = i.folder_id AND i.is_active = 1
    LEFT JOIN assignments a ON i.id = a.image_id
    LEFT JOIN scores s ON i.id = s.image_id
    WHERE f.id = ? AND f.is_active = 1
    GROUP BY f.id, f.name, f.description
  `;

  database.getDb().get(folderQuery, [folderId], (err, folder) => {
    if (err) {
      console.error('Error fetching folder:', err.message);
      return res.status(500).json({ error: 'Failed to fetch folder' });
    }

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Get detailed image data with individual scores
    const imageQuery = `
      SELECT 
        i.id,
        i.filename,
        i.original_name,
        i.s3_url,
        i.upload_date,
        COUNT(DISTINCT a.user_id) as assigned_to,
        COUNT(DISTINCT s.user_id) as scored_by,
        AVG(s.kss_score) as avg_score
      FROM images i
      LEFT JOIN assignments a ON i.id = a.image_id
      LEFT JOIN scores s ON i.id = s.image_id
      WHERE i.folder_id = ? AND i.is_active = 1
      GROUP BY i.id, i.filename, i.original_name, i.s3_url, i.upload_date
      ORDER BY i.upload_date DESC
    `;

    database.getDb().all(imageQuery, [folderId], (err, images) => {
      if (err) {
        console.error('Error fetching images:', err.message);
        return res.status(500).json({ error: 'Failed to fetch images' });
      }

      res.json({
        folder: {
          ...folder,
          images: images || []
        }
      });
    });
  });
});

// Get detailed scores for a specific image (admin only)
router.get('/images/:imageId/scores', (req, res) => {
  const { imageId } = req.params;

  // Get image basic info
  const imageQuery = `
    SELECT 
      i.*,
      u.username as uploaded_by_username,
      f.name as folder_name
    FROM images i
    LEFT JOIN users u ON i.uploaded_by = u.id
    LEFT JOIN folders f ON i.folder_id = f.id
    WHERE i.id = ? AND i.is_active = 1
  `;

  database.getDb().get(imageQuery, [imageId], (err, image) => {
    if (err) {
      console.error('Error fetching image:', err.message);
      return res.status(500).json({ error: 'Failed to fetch image' });
    }

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get all scores for this image
    const scoresQuery = `
      SELECT 
        s.*,
        u.username as scorer_username,
        u.guest_name,
        u.role,
        u.is_guest
      FROM scores s
      JOIN users u ON s.user_id = u.id
      WHERE s.image_id = ?
      ORDER BY s.scored_at DESC
    `;

    database.getDb().all(scoresQuery, [imageId], (err, scores) => {
      if (err) {
        console.error('Error fetching scores:', err.message);
        return res.status(500).json({ error: 'Failed to fetch scores' });
      }

      // Calculate statistics
      const statistics = scores.length > 0 ? {
        total_scores: scores.length,
        avg_score: scores.reduce((sum, score) => sum + score.kss_score, 0) / scores.length,
        min_score: Math.min(...scores.map(s => s.kss_score)),
        max_score: Math.max(...scores.map(s => s.kss_score)),
        score_variance: Math.max(...scores.map(s => s.kss_score)) - Math.min(...scores.map(s => s.kss_score))
      } : null;

      // Format the individual scores
      const individual_scores = scores.map(score => ({
        score_id: score.id,
        scorer_username: score.is_guest ? score.guest_name : score.username,
        user_type: score.is_guest ? 'guest' : score.role,
        kss_score: score.kss_score,
        explanation: score.explanation,
        additional_notes: score.additional_notes,
        time_spent_seconds: score.time_spent_seconds,
        scored_at: score.scored_at
      }));

      res.json({
        image,
        individual_scores,
        statistics
      });
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
    const getUsersQuery = "SELECT id FROM users WHERE role = 'guest'";
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

// Export Excel
router.get('/export/excel', (req, res) => {
  const query = `
    SELECT 
      s.*,
      u.username,
      u.email,
      u.role,
      u.guest_name,
      u.is_guest,
      u.guest_access_code_id,
      i.filename as image_filename,
      i.original_name as image_original_name,
      gac.name as access_code_name,
      gac.description as access_code_description
    FROM scores s
    JOIN users u ON s.user_id = u.id
    JOIN images i ON s.image_id = i.id
    LEFT JOIN guest_access_codes gac ON u.guest_access_code_id = gac.id
    WHERE u.is_active = 1
    ORDER BY s.scored_at DESC
  `;

  database.getDb().all(query, [], async (err, scores) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch scores for export' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KSS Scores');

    // Define columns
    worksheet.columns = [
      { header: 'Score ID', key: 'id', width: 10 },
      { header: 'User Type', key: 'user_type', width: 12 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Display Name', key: 'display_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Access Code', key: 'access_code', width: 20 },
      { header: 'Image Filename', key: 'image_filename', width: 30 },
      { header: 'Original Name', key: 'image_original_name', width: 30 },
      { header: 'KSS Score', key: 'kss_score', width: 12 },
      { header: 'Explanation', key: 'explanation', width: 50 },
      { header: 'Time Spent (sec)', key: 'time_spent_seconds', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Updated At', key: 'updated_at', width: 20 }
    ];

    // Add data rows
    scores.forEach(score => {
      worksheet.addRow({
        id: score.id,
        user_type: score.is_guest ? 'Guest' : score.role,
        username: score.username,
        display_name: score.is_guest ? score.guest_name : score.username,
        email: score.email || 'N/A',
        access_code: score.access_code_name || 'N/A',
        image_filename: score.image_filename,
        image_original_name: score.image_original_name,
        kss_score: score.kss_score,
        explanation: score.explanation || '',
        time_spent_seconds: score.time_spent_seconds || 0,
        created_at: score.scored_at,
        updated_at: score.scored_at
      });
    });

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `kss_scores_${timestamp}.xlsx`;

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel file' });
    }
  });
});

// Export LLM JSON
router.post('/export/llm-json', async (req, res) => {
  const { apiKey, sampleFormat, includeExplanations = true } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'OpenAI API key is required' });
  }

  if (!sampleFormat) {
    return res.status(400).json({ error: 'Sample format is required' });
  }

  try {
    // Validate the sample format is valid JSON
    JSON.parse(sampleFormat);
  } catch (error) {
    return res.status(400).json({ error: 'Sample format must be valid JSON' });
  }

  const query = `
    SELECT 
      s.*,
      u.username,
      u.email,
      u.role,
      u.guest_name,
      u.is_guest,
      u.guest_access_code_id,
      i.filename as image_filename,
      i.original_name as image_original_name,
      gac.name as access_code_name
    FROM scores s
    JOIN users u ON s.user_id = u.id
    JOIN images i ON s.image_id = i.id
    LEFT JOIN guest_access_codes gac ON u.guest_access_code_id = gac.id
    WHERE u.is_active = 1
    ORDER BY s.scored_at DESC
  `;

  database.getDb().all(query, [], async (err, scores) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch scores for export' });
    }

    try {
      // Group scores by image filename
      const groupedData = {};
      scores.forEach(score => {
        const imageKey = score.image_filename;
        if (!groupedData[imageKey]) {
          groupedData[imageKey] = {
            image_filename: score.image_filename,
            image_original_name: score.image_original_name,
            scores: []
          };
        }

        const scoreData = {
          score_id: score.id,
          user_type: score.is_guest ? 'guest' : score.role,
          user_identifier: score.is_guest ? score.guest_name : score.username,
          email: score.email,
          access_code: score.access_code_name,
          kss_score: score.kss_score,
          time_spent_seconds: score.time_spent_seconds,
          created_at: score.scored_at
        };

        if (includeExplanations && score.explanation) {
          scoreData.explanation = score.explanation;
        }

        groupedData[imageKey].scores.push(scoreData);
      });

      // Prepare data for LLM
      const dataToFormat = Object.values(groupedData);

      // Create OpenAI instance
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      const prompt = `Please reformat the following KSS scoring data according to the provided sample format. The data includes both regular users and guest users (identified by user_type).

Sample format to follow:
${sampleFormat}

Data to reformat:
${JSON.stringify(dataToFormat, null, 2)}

Please return only the reformatted JSON data, no additional text or explanations.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1
      });

      const formattedData = completion.choices[0].message.content;

      // Validate that the response is valid JSON
      let parsedData;
      try {
        parsedData = JSON.parse(formattedData);
      } catch (parseError) {
        console.error('LLM response parsing error:', parseError);
        return res.status(500).json({ 
          error: 'Failed to parse LLM response as JSON',
          llm_response: formattedData 
        });
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `kss_scores_formatted_${timestamp}.json`;

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.json(parsedData);

    } catch (error) {
      console.error('LLM JSON export error:', error);
      
      if (error.code === 'invalid_api_key') {
        return res.status(401).json({ error: 'Invalid OpenAI API key' });
      }
      
      res.status(500).json({ 
        error: 'Failed to process data with LLM',
        details: error.message 
      });
    }
  });
});

module.exports = router; 