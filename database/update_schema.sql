-- Database schema update script to add folder support

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Add folder_id column to images table if it doesn't exist
ALTER TABLE images ADD COLUMN folder_id INTEGER REFERENCES folders(id);

-- Add folder_id, scores_per_image, expected_participants, assignment_algorithm columns to guest_access_codes if they don't exist
ALTER TABLE guest_access_codes ADD COLUMN folder_id INTEGER REFERENCES folders(id);
ALTER TABLE guest_access_codes ADD COLUMN scores_per_image INTEGER DEFAULT 3;
ALTER TABLE guest_access_codes ADD COLUMN expected_participants INTEGER DEFAULT 5;
ALTER TABLE guest_access_codes ADD COLUMN assignment_algorithm TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_images_folder_id ON images(folder_id);
CREATE INDEX IF NOT EXISTS idx_guest_access_codes_folder_id ON guest_access_codes(folder_id); 