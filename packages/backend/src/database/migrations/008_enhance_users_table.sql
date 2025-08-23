-- Enhance users table with additional fields from design
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for soft deletes
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Create index for email verification status
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Add comment for documentation
COMMENT ON TABLE users IS 'User accounts with authentication and profile information';
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.timezone IS 'User timezone for scheduling posts';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp';