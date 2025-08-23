-- Create content_templates table for reusable post templates
CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL,
    platforms TEXT[] NOT NULL,
    hashtags TEXT[] DEFAULT '{}',
    variables JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure template name is unique per user
    UNIQUE(user_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_templates_user_id ON content_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_platforms ON content_templates USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_content_templates_usage ON content_templates(usage_count);
CREATE INDEX IF NOT EXISTS idx_content_templates_variables ON content_templates USING GIN(variables);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE content_templates IS 'Reusable content templates for post creation';
COMMENT ON COLUMN content_templates.template_content IS 'Template content with variable placeholders';
COMMENT ON COLUMN content_templates.variables IS 'Template variables and their default values';
COMMENT ON COLUMN content_templates.usage_count IS 'Number of times template has been used';