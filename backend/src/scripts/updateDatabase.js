const database = require('../models/database');

async function updateDatabase() {
  const db = database.getDb();
  
  console.log('Starting database update for guest access functionality...');

  try {
    // Add guest access codes table
    console.log('Creating guest_access_codes table...');
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS guest_access_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          expires_at DATETIME NOT NULL,
          max_uses INTEGER DEFAULT 100,
          uses_count INTEGER DEFAULT 0,
          image_ids TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Add guest-related columns to users table
    console.log('Updating users table with guest fields...');
    
    const columnsToAdd = [
      'is_guest BOOLEAN DEFAULT 0',
      'guest_name TEXT',
      'guest_access_code_id INTEGER'
    ];

    for (const column of columnsToAdd) {
      try {
        await new Promise((resolve, reject) => {
          db.run(`ALTER TABLE users ADD COLUMN ${column}`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        console.log(`  Added column: ${column.split(' ')[0]}`);
      } catch (err) {
        console.log(`  Column ${column.split(' ')[0]} already exists or error: ${err.message}`);
      }
    }

    // Add missing columns to images table
    console.log('Updating images table...');
    const imageColumns = [
      'uploaded_by INTEGER',
      'file_path TEXT',
      'created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
      'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    ];

    for (const column of imageColumns) {
      try {
        await new Promise((resolve, reject) => {
          db.run(`ALTER TABLE images ADD COLUMN ${column}`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        console.log(`  Added column to images: ${column.split(' ')[0]}`);
      } catch (err) {
        console.log(`  Column ${column.split(' ')[0]} already exists or error: ${err.message}`);
      }
    }

    // Update scores table to use the correct KSS range (0-10)
    console.log('Updating scores table structure...');
    try {
      // Note: SQLite doesn't support DROP CONSTRAINT, so we need to handle this in application logic
      console.log('  KSS score range will be validated in application logic (0-10)');
      
      // Add missing columns to scores table
      const scoreColumns = [
        'created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
        'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
      ];

      for (const column of scoreColumns) {
        try {
          await new Promise((resolve, reject) => {
            db.run(`ALTER TABLE scores ADD COLUMN ${column}`, (err) => {
              if (err && !err.message.includes('duplicate column name')) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
          console.log(`  Added column to scores: ${column.split(' ')[0]}`);
        } catch (err) {
          console.log(`  Column ${column.split(' ')[0]} already exists`);
        }
      }
    } catch (err) {
      console.log(`  Scores table update error: ${err.message}`);
    }

    // Create folders table for organizing images
    console.log('Creating folders table...');
    try {
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
          )
        `, (err) => {
          if (err) reject(err);
          else {
            console.log('  Folders table created');
            resolve();
          }
        });
      });
    } catch (err) {
      console.log(`  Folders table error: ${err.message}`);
    }

    // Add folder_id to images table
    console.log('Adding folder_id to images table...');
    try {
      await new Promise((resolve, reject) => {
        db.run('ALTER TABLE images ADD COLUMN folder_id INTEGER REFERENCES folders(id)', (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      console.log('  Added folder_id column to images');
    } catch (err) {
      console.log(`  Column folder_id already exists or error: ${err.message}`);
    }

    // Create indexes for better performance
    console.log('Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_guest_codes_code ON guest_access_codes(code)',
      'CREATE INDEX IF NOT EXISTS idx_guest_codes_expires ON guest_access_codes(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_users_guest_code ON users(guest_access_code_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users(is_guest)',
      'CREATE INDEX IF NOT EXISTS idx_images_uploaded_by ON images(uploaded_by)',
      'CREATE INDEX IF NOT EXISTS idx_images_folder_id ON images(folder_id)',
      'CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_scores_user_image ON scores(user_id, image_id)'
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log('Database update completed successfully!');
    console.log('\nSummary of changes:');
    console.log('  • Added guest_access_codes table for managing temporary access');
    console.log('  • Extended users table with guest-related fields');
    console.log('  • Updated images table with required columns');
    console.log('  • Updated scores table structure');
    console.log('  • Created performance indexes');
    console.log('  • Guest users can now access the scoring system with access codes');

  } catch (error) {
    console.error('Database update failed:', error);
    throw error;
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateDatabase()
    .then(() => {
      console.log('\nAll database updates completed successfully!');
      setTimeout(() => process.exit(0), 1000);
    })
    .catch((error) => {
      console.error('\nDatabase update failed:', error);
      setTimeout(() => process.exit(1), 1000);
    });
}

module.exports = { updateDatabase }; 