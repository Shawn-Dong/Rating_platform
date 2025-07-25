const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database/kss_rating.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.initTables();
      }
    });
  }

  initTables() {
    const queries = [
      // Users table for scorers
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active BOOLEAN NOT NULL DEFAULT 1,
      google_id TEXT UNIQUE,
      avatar_url TEXT
      )`,

      // Images table for pictures to be scored
      `CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        s3_url TEXT NOT NULL,
        original_name TEXT,
        dataset_name TEXT,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        metadata TEXT
      )`,

      // Scores table for KSS ratings
      `CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        image_id INTEGER NOT NULL,
        kss_score INTEGER NOT NULL CHECK (kss_score >= 0 AND kss_score <= 10),
        explanation TEXT NOT NULL,
        additional_notes TEXT,
        scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        time_spent_seconds INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (image_id) REFERENCES images (id),
        UNIQUE(user_id, image_id)
      )`,

      // Assignments table for distributing work
      `CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        image_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (image_id) REFERENCES images (id),
        UNIQUE(user_id, image_id)
      )`
    ];

    queries.forEach(query => {
      this.db.run(query, (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        }
      });
    });
  }

  getDb() {
    return this.db;
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = new Database(); 