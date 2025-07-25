const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const database = require('../models/database');
const { generateToken, authenticateToken, getUserById } = require('../middleware/auth');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Passport.js Google OAuth2 Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`
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
}

// Google Auth Routes (only if Google OAuth is configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }),
    function(req, res) {
      // Successful authentication, generate a JWT
      const token = generateToken(req.user);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
    }
  );
} else {
  // Return error if Google OAuth is not configured
  router.get('/google', (req, res) => {
    res.status(503).json({ 
      error: 'Google OAuth not configured', 
      message: 'Google login is currently unavailable. Please contact the administrator.' 
    });
  });
  
  router.get('/google/callback', (req, res) => {
    res.status(503).json({ 
      error: 'Google OAuth not configured', 
      message: 'Google login is currently unavailable. Please contact the administrator.' 
    });
  });
}

// Register new user
router.post('/register', (req, res) => {
  const { username, email, password, role = 'admin' } = req.body;

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

// Generate guest access code (admin only)
router.post('/generate-guest-code', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { 
    name, 
    description, 
    expires_in_hours = 24, 
    max_uses = 100,
    image_ids = null,
    folder_id = null,
    scores_per_image = 3,
    expected_participants = 5,
    assignment_algorithm = null
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Access code name is required' });
  }

  // Generate random access code
  const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);

  const query = `
    INSERT INTO guest_access_codes (
      code, name, description, expires_at, max_uses, image_ids, 
      folder_id, scores_per_image, expected_participants, assignment_algorithm, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  database.getDb().run(query, [
    accessCode, 
    name, 
    description, 
    expiresAt.toISOString(), 
    max_uses,
    image_ids ? JSON.stringify(image_ids) : null,
    folder_id,
    scores_per_image,
    expected_participants,
    assignment_algorithm ? JSON.stringify(assignment_algorithm) : null,
    req.user.id
  ], function(err) {
    if (err) {
      console.error('Guest code creation error:', err.message);
      return res.status(500).json({ error: 'Failed to create guest access code' });
    }

    res.json({
      message: 'Guest access code created successfully',
      access_code: accessCode,
      id: this.lastID,
      expires_at: expiresAt,
      guest_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/guest/${accessCode}`
    });
  });
});

// Guest login with access code
router.post('/guest-login', (req, res) => {
  const { access_code, guest_name, guest_email } = req.body;

  if (!access_code || !guest_name || !guest_email) {
    return res.status(400).json({ error: 'Access code, guest name, and email are required' });
  }

  // Verify access code
  const codeQuery = `
    SELECT * FROM guest_access_codes 
    WHERE code = ? AND is_active = 1 AND expires_at > datetime('now')
  `;

  database.getDb().get(codeQuery, [access_code], (err, guestCode) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!guestCode) {
      return res.status(401).json({ error: 'Invalid or expired access code' });
    }

    // Check usage limit
    if (guestCode.uses_count >= guestCode.max_uses) {
      return res.status(403).json({ error: 'Access code usage limit exceeded' });
    }

    // Check if guest user already exists with same name, email, and access code
    const findGuestQuery = `
      SELECT * FROM users 
      WHERE guest_name = ? AND email = ? AND guest_access_code_id = ? AND is_guest = 1
    `;

    database.getDb().get(findGuestQuery, [guest_name, guest_email, guestCode.id], (err, existingUser) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      if (existingUser) {
        // Use existing guest user - don't increment usage count
        const guestUser = {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          role: existingUser.role,
          guest_name: existingUser.guest_name,
          guest_access_code_id: existingUser.guest_access_code_id
        };

        const token = generateToken(guestUser);

        res.json({
          message: 'Guest login successful',
          user: {
            id: guestUser.id,
            username: guestUser.username,
            email: guestUser.email,
            role: guestUser.role,
            guest_name: guestUser.guest_name
          },
          token,
          access_code_info: {
            name: guestCode.name,
            description: guestCode.description
          }
        });
      } else {
        // Create new guest user
        const guestUsername = `guest_${access_code}_${Date.now()}`;
        const insertGuestQuery = `
          INSERT INTO users (username, email, password_hash, role, is_guest, guest_access_code_id, guest_name)
          VALUES (?, ?, ?, 'guest', 1, ?, ?)
        `;

        database.getDb().run(insertGuestQuery, [
          guestUsername, 
          guest_email,
          'guest_no_password', // Placeholder for guest users
          guestCode.id, 
          guest_name
        ], function(err) {
          if (err) {
            console.error('Guest user creation error:', err.message);
            return res.status(500).json({ error: 'Failed to create guest user' });
          }

          const guestUser = {
            id: this.lastID,
            username: guestUsername,
            email: guest_email,
            role: 'guest',
            guest_name: guest_name,
            guest_access_code_id: guestCode.id
          };

          // Increment usage count for new users only
          const updateUsageQuery = 'UPDATE guest_access_codes SET uses_count = uses_count + 1 WHERE id = ?';
          database.getDb().run(updateUsageQuery, [guestCode.id], (err) => {
            if (err) {
              console.error('Usage count update error:', err.message);
            }
          });

          // Auto-assign images using smart assignment algorithm
          if (guestCode.assignment_algorithm && guestCode.image_ids) {
            try {
              const assignmentPlan = JSON.parse(guestCode.assignment_algorithm);
              
              // Get current user count for this access code (including the new user)
              const getCurrentUsersQuery = `
                SELECT COUNT(*) as user_count 
                FROM users 
                WHERE guest_access_code_id = ? AND is_guest = 1
              `;
              
              database.getDb().get(getCurrentUsersQuery, [guestCode.id], (err, result) => {
                if (err) {
                  console.error('Error getting current user count:', err.message);
                  return;
                }

                const currentUserIndex = result.user_count - 1; // Zero-based index
                
                                if (assignmentPlan.assignments && assignmentPlan.assignments[currentUserIndex]) {
                  const assignmentData = assignmentPlan.assignments[currentUserIndex];
                  const userImageIds = assignmentData.imageIds || assignmentData;
                  
                  // Ensure userImageIds is an array
                  if (!Array.isArray(userImageIds)) {
                    console.error('userImageIds is not an array:', userImageIds);
                    return;
                  }
                  
                  // Insert assignments for this user
                   const assignQuery = 'INSERT INTO assignments (user_id, image_id, assigned_at, status) VALUES (?, ?, datetime("now"), "pending")';
                   
                   userImageIds.forEach(imageId => {
                     database.getDb().run(assignQuery, [guestUser.id, imageId], (err) => {
                       if (err) {
                         console.error('Smart assignment error:', err.message);
                       }
                     });
                   });
                  
                  console.log(`Auto-assigned ${userImageIds.length} images to guest user ${guestUser.guest_name} using smart algorithm`);
                } else {
                  console.log(`No assignment found for user index ${currentUserIndex} in smart algorithm`);
                }
              });
            } catch (e) {
              console.error('Smart assignment parsing error:', e.message);
              // Fallback to simple assignment
              this.fallbackImageAssignment(guestUser, guestCode);
            }
          } else if (guestCode.image_ids) {
            // Fallback: assign specific images
            try {
              const imageIds = JSON.parse(guestCode.image_ids);
                             const assignQuery = 'INSERT INTO assignments (user_id, image_id, assigned_at, status) VALUES (?, ?, datetime("now"), "pending")';
               
               imageIds.forEach(imageId => {
                 database.getDb().run(assignQuery, [guestUser.id, imageId], (err) => {
                   if (err) {
                     console.error('Simple assignment error:', err.message);
                   }
                 });
               });
            } catch (e) {
              console.error('Image assignment parsing error:', e.message);
            }
          } else {
            // Auto-assign all active images if no specific images are set
            const getAllImagesQuery = 'SELECT id FROM images WHERE is_active = 1';
            database.getDb().all(getAllImagesQuery, [], (err, images) => {
              if (!err && images.length > 0) {
                                 const assignQuery = 'INSERT INTO assignments (user_id, image_id, assigned_at, status) VALUES (?, ?, datetime("now"), "pending")';
                 images.forEach(image => {
                   database.getDb().run(assignQuery, [guestUser.id, image.id], (err) => {
                     if (err) {
                       console.error('Auto-assignment error:', err.message);
                     }
                   });
                 });
              }
            });
          }

          const token = generateToken(guestUser);

          res.json({
            message: 'Guest login successful',
            user: {
              id: guestUser.id,
              username: guestUser.username,
              email: guestUser.email,
              role: guestUser.role,
              guest_name: guestUser.guest_name
            },
            token,
            access_code_info: {
              name: guestCode.name,
              description: guestCode.description
            }
          });
        });
      }
    });
  });
});

// Get guest access codes (admin only)
router.get('/guest-codes', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const codesQuery = `
    SELECT 
      gac.*,
      f.name as folder_name,
      u.username as created_by_username,
      COUNT(gu.id) as guest_users_count
    FROM guest_access_codes gac
    LEFT JOIN users u ON gac.created_by = u.id
    LEFT JOIN users gu ON gac.id = gu.guest_access_code_id AND gu.is_guest = 1
    LEFT JOIN folders f ON gac.folder_id = f.id
    WHERE gac.is_active = 1
    GROUP BY gac.id
    ORDER BY gac.created_at DESC
  `;

    database.getDb().all(codesQuery, [], (err, codes) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    console.log('Raw codes from database:', codes.length);
    console.log('First code:', codes[0]);

    // Format codes with proper image names
    Promise.all(codes.map(code => {
      return new Promise((resolve) => {
        const imageIds = code.image_ids ? JSON.parse(code.image_ids) : [];
        
        if (imageIds.length === 0) {
          resolve({
            ...code,
            image_ids: imageIds,
            assignment_algorithm: code.assignment_algorithm,
            image_names_map: {},
            guest_users: [],
            guest_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/guest/${code.code}`
          });
          return;
        }

        // Fetch real image names from database
        const placeholders = imageIds.map(() => '?').join(',');
        const imageNamesQuery = `
          SELECT id, filename, original_name 
          FROM images 
          WHERE id IN (${placeholders})
        `;
        
        database.getDb().all(imageNamesQuery, imageIds, (err, images) => {
          const imageNamesMap = {};
          
          if (!err && images) {
            images.forEach(image => {
              // Use original_name if available, otherwise use filename
              imageNamesMap[image.id] = image.original_name || image.filename;
            });
          }
          
          // Fill in any missing images with fallback names
          imageIds.forEach(id => {
            if (!imageNamesMap[id]) {
              imageNamesMap[id] = `Image ${id}`;
            }
          });

          resolve({
            ...code,
            image_ids: imageIds,
            assignment_algorithm: code.assignment_algorithm,
            image_names_map: imageNamesMap,
            guest_users: [],
            guest_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/guest/${code.code}`
          });
        });
      });
    })).then(formattedCodes => {
      res.json({ guest_codes: formattedCodes });
    }).catch(error => {
      console.error('Error formatting codes:', error);
      res.status(500).json({ error: 'Failed to format guest codes' });
    });
  });
});

// Deactivate guest access code (admin only)
router.patch('/guest-codes/:codeId/deactivate', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { codeId } = req.params;

  const query = 'UPDATE guest_access_codes SET is_active = 0 WHERE id = ?';
  database.getDb().run(query, [codeId], function(err) {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Guest access code not found' });
    }

    res.json({ message: 'Guest access code deactivated successfully' });
  });
});

module.exports = router; 