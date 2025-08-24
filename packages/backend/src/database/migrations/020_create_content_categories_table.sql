-- Create content categories table for organizing posts
CREATE TABLE IF NOT EXISTS content_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#2196F3', -- Hex color code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_content_categories_user_id ON content_categories(user_id);

-- Create index for name (for searching)
CREATE INDEX IF NOT EXISTS idx_content_categories_name ON content_categories(name);

-- Add comment for documentation
COMMENT ON TABLE content_categories IS 'User-defined categories for organizing social media posts';
COMMENT ON COLUMN content_categories.color IS 'Hex color code for category display (e.g., #FF5722)';