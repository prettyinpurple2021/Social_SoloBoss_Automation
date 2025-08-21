-- Create platform_posts table
CREATE TABLE IF NOT EXISTS platform_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_post_id VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure valid status values
    CONSTRAINT platform_posts_status_check CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
    -- Ensure one platform post per post per platform
    UNIQUE(post_id, platform)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_posts_post_id ON platform_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_platform ON platform_posts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_posts_status ON platform_posts(status);
CREATE INDEX IF NOT EXISTS idx_platform_posts_platform_post_id ON platform_posts(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_published_at ON platform_posts(published_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_platform_posts_updated_at BEFORE UPDATE ON platform_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();