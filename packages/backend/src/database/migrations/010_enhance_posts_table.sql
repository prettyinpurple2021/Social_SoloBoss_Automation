-- Enhance posts table with additional fields from design
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS platform_specific_content JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- Create index for platform specific content
CREATE INDEX IF NOT EXISTS idx_posts_platform_specific_content ON posts USING GIN(platform_specific_content);

-- Create index for metadata
CREATE INDEX IF NOT EXISTS idx_posts_metadata ON posts USING GIN(metadata);

-- Create index for published_at
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);

-- Add comment for documentation
COMMENT ON TABLE posts IS 'Social media posts with content and scheduling information';
COMMENT ON COLUMN posts.platform_specific_content IS 'Platform-specific content variations';
COMMENT ON COLUMN posts.metadata IS 'Additional post metadata and configuration';
COMMENT ON COLUMN posts.published_at IS 'Timestamp when post was actually published';