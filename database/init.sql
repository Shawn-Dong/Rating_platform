-- KSS Rating Platform PostgreSQL Database Schema
-- This script initializes the database for production deployment

-- Create database if not exists (handled by Docker environment)
-- CREATE DATABASE kss_rating;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'scorer' CHECK(role IN ('admin', 'scorer', 'guest')),
    is_active BOOLEAN DEFAULT 1,
    is_guest BOOLEAN DEFAULT 0,
    guest_name TEXT,
    guest_access_code_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_access_code_id) REFERENCES guest_access_codes(id)
);

-- Guest access codes table
CREATE TABLE IF NOT EXISTS guest_access_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    expires_at DATETIME NOT NULL,
    max_uses INTEGER DEFAULT 100,
    uses_count INTEGER DEFAULT 0,
    image_ids TEXT, -- JSON array of image IDs, null means all images
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Scores table for KSS ratings
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    kss_score INTEGER NOT NULL CHECK (kss_score >= 0 AND kss_score <= 10),
    explanation TEXT NOT NULL,
    additional_notes TEXT,
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, image_id)
);

-- Assignments table for distributing work
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, image_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_images_active ON images(is_active);
CREATE INDEX IF NOT EXISTS idx_images_dataset ON images(dataset_name);
CREATE INDEX IF NOT EXISTS idx_images_upload_date ON images(upload_date);

CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_image_id ON scores(image_id);
CREATE INDEX IF NOT EXISTS idx_scores_kss_score ON scores(kss_score);
CREATE INDEX IF NOT EXISTS idx_scores_scored_at ON scores(scored_at);

CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_image_id ON assignments(image_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_at ON assignments(assigned_at);

-- Create default admin user (password: admin123)
-- Hash generated with bcrypt, rounds=10
INSERT INTO users (username, email, password_hash, role, is_active) 
VALUES (
    'admin', 
    'admin@kss-platform.com', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
    'admin', 
    true
) ON CONFLICT (username) DO NOTHING;

-- Create default scorer user (password: scorer123)
INSERT INTO users (username, email, password_hash, role, is_active) 
VALUES (
    'scorer1', 
    'scorer1@kss-platform.com', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
    'scorer', 
    true
) ON CONFLICT (username) DO NOTHING;

-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 