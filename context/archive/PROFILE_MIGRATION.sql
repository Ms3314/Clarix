-- Profile Picture Feature - Database Migration

-- Add profile picture fields to users table
ALTER TABLE users 
ADD COLUMN profile_picture_url VARCHAR NULL,
ADD COLUMN profile_picture_updated_at DATETIME NULL;

-- For SQLite (if using SQLite during development):
-- SQLite doesn't support ALTER TABLE ADD COLUMN with multiple columns, so run separately:
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR NULL;
ALTER TABLE users ADD COLUMN profile_picture_updated_at DATETIME NULL;

-- PostgreSQL (Supabase):
ALTER TABLE users 
ADD COLUMN profile_picture_url TEXT NULL,
ADD COLUMN profile_picture_updated_at TIMESTAMP NULL;

-- Create index for better query performance
CREATE INDEX idx_users_profile_picture_updated_at 
ON users(profile_picture_updated_at DESC);
