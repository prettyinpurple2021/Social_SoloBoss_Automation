-- Create content tags table for tagging posts
CREATE TABLE IF NOT EXISTS content_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_content_tags_user_id ON content_tags(user_id);

-- Create index for name (for searching)
CREATE INDEX IF NOT EXISTS idx_content_tags_name ON content_tags(name);

-- Add comment for documentation
COMMENT ON TABLE content_tags IS 'User-defined tags for labeling and organizing social media posts';
COMMENT ON COLUMN content_tags.name IS 'Tag name (should be lowercase, no spaces)';