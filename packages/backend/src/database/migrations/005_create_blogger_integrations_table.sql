-- Create blogger_integrations table
CREATE TABLE IF NOT EXISTS blogger_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blog_url VARCHAR(500) NOT NULL,
    rss_feed_url VARCHAR(500) NOT NULL,
    auto_approve BOOLEAN DEFAULT false,
    default_platforms TEXT[] DEFAULT '{}',
    custom_hashtags TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    last_checked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one integration per user
    UNIQUE(user_id)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_blogger_integrations_user_id ON blogger_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_blogger_integrations_enabled ON blogger_integrations(enabled);
CREATE INDEX IF NOT EXISTS idx_blogger_integrations_last_checked ON blogger_integrations(last_checked);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blogger_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_blogger_integrations_updated_at
    BEFORE UPDATE ON blogger_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_blogger_integrations_updated_at();