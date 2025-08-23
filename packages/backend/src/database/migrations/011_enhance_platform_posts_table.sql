-- Enhance platform_posts table with additional fields from design
ALTER TABLE platform_posts 
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Rename error column to error_message if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_posts' AND column_name = 'error') THEN
        ALTER TABLE platform_posts RENAME COLUMN error TO error_message;
    END IF;
END $$;

-- Create index for metadata
CREATE INDEX IF NOT EXISTS idx_platform_posts_metadata ON platform_posts USING GIN(metadata);

-- Create index for retry_count
CREATE INDEX IF NOT EXISTS idx_platform_posts_retry_count ON platform_posts(retry_count);

-- Add comment for documentation
COMMENT ON TABLE platform_posts IS 'Individual platform posts tracking publication status';
COMMENT ON COLUMN platform_posts.error_message IS 'Error message if publication failed';
COMMENT ON COLUMN platform_posts.metadata IS 'Platform-specific metadata and response data';
COMMENT ON COLUMN platform_posts.retry_count IS 'Number of retry attempts for failed posts';