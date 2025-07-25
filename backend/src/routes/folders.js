const express = require('express');
const router = express.Router();
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all folders
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const query = `
    SELECT 
      f.*,
      u.username as created_by_username,
      (SELECT COUNT(*) FROM images i WHERE i.folder_id = f.id AND i.is_active = 1) as image_count
    FROM folders f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.is_active = 1
    ORDER BY f.created_at DESC
  `;

  console.log('Executing folders query:', query);
  database.getDb().all(query, [], (err, folders) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch folders' });
    }

    console.log('Query results:', folders);
    
    // Debug: Check actual images in Thomas folder
    database.getDb().all('SELECT id, filename, folder_id, is_active FROM images WHERE folder_id = 1', [], (err, images) => {
      console.log('Thomas folder images:', images);
      console.log('Count of Thomas folder images:', images.length);
      console.log('Count of active Thomas folder images:', images.filter(img => img.is_active === 1).length);
    });
    
    res.json({ folders });
  });
});

// Create new folder
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { name, description = '' } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const query = `
    INSERT INTO folders (name, description, created_by)
    VALUES (?, ?, ?)
  `;

  database.getDb().run(query, [name.trim(), description.trim(), req.user.id], function(err) {
    if (err) {
      console.error('Folder creation error:', err.message);
      return res.status(500).json({ error: 'Failed to create folder' });
    }

    res.status(201).json({
      message: 'Folder created successfully',
      folder: {
        id: this.lastID,
        name: name.trim(),
        description: description.trim(),
        created_by: req.user.id,
        image_count: 0
      }
    });
  });
});

// Get folder details with images
router.get('/:folderId', authenticateToken, requireAdmin, (req, res) => {
  const { folderId } = req.params;

  const folderQuery = `
    SELECT 
      f.*,
      u.username as created_by_username,
      (SELECT COUNT(*) FROM images i WHERE i.folder_id = f.id AND i.is_active = 1) as image_count
    FROM folders f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.id = ? AND f.is_active = 1
  `;

  database.getDb().get(folderQuery, [folderId], (err, folder) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch folder' });
    }

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Get images in this folder
    const imagesQuery = `
      SELECT id, filename, original_name, s3_url, file_path, upload_date
      FROM images
      WHERE folder_id = ? AND is_active = 1
      ORDER BY upload_date DESC
    `;

    database.getDb().all(imagesQuery, [folderId], (err, images) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch folder images' });
      }

      res.json({
        folder: {
          ...folder,
          images
        }
      });
    });
  });
});

// Update folder
router.put('/:folderId', authenticateToken, requireAdmin, (req, res) => {
  const { folderId } = req.params;
  const { name, description } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const query = `
    UPDATE folders 
    SET name = ?, description = ?
    WHERE id = ? AND is_active = 1
  `;

  database.getDb().run(query, [name.trim(), description.trim(), folderId], function(err) {
    if (err) {
      console.error('Folder update error:', err.message);
      return res.status(500).json({ error: 'Failed to update folder' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ message: 'Folder updated successfully' });
  });
});

// Delete folder (soft delete)
router.delete('/:folderId', authenticateToken, requireAdmin, (req, res) => {
  const { folderId } = req.params;

  const query = `
    UPDATE folders 
    SET is_active = 0
    WHERE id = ? AND is_active = 1
  `;

  database.getDb().run(query, [folderId], function(err) {
    if (err) {
      console.error('Folder deletion error:', err.message);
      return res.status(500).json({ error: 'Failed to delete folder' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ message: 'Folder deleted successfully' });
  });
});

module.exports = router; 