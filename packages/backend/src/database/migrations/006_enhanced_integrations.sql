-- Enhanced Integration Features Migration
-- This migration adds support for content templates, error tracking, and webhook validation

-- Content Templates Table
CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(20) NOT NULL CHECK (template_type IN ('blogger', 'soloboss', 'manual')),
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'instagram', 'pinterest', 'x', 'all')),
    template_content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integration Errors Table
CREATE TABLE IF NOT EXISTS integration_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_type VARCHAR(20) NOT NULL CHECK (integration_type IN ('blogger', 'soloboss')),
    error_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    stack_trace TEXT,
    recovery_actions TEXT[] DEFAULT '{}',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_method VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Manual Review Queue Table
CREATE TABLE IF NOT EXISTS manual_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id UUID NOT NULL REFERENCES integration_errors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_type VARCHAR(20) NOT NULL CHECK (integration_type IN ('blogger', 'soloboss')),
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'escalated')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(error_id)
);

-- Webhook Validation Logs Table (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS webhook_validation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    integration_type VARCHAR(20) NOT NULL CHECK (integration_type IN ('blogger', 'soloboss')),
    validation_result VARCHAR(20) NOT NULL CHECK (validation_result IN ('success', 'failed', 'error')),
    error_type VARCHAR(50),
    error_message TEXT,
    payload_size INTEGER,
    signature_valid BOOLEAN,
    timestamp_valid BOOLEAN,
    content_valid BOOLEAN,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Transformation Logs Table (for analytics and debugging)
CREATE TABLE IF NOT EXISTS content_transformation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES content_templates(id) ON DELETE SET NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('blogger', 'soloboss', 'manual')),
    platform VARCHAR(20) NOT NULL,
    transformation_result VARCHAR(20) NOT NULL CHECK (transformation_result IN ('success', 'failed', 'fallback')),
    content_length INTEGER,
    hashtags_generated INTEGER,
    images_processed INTEGER,
    processing_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_templates_user_type ON content_templates(user_id, template_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_platform ON content_templates(platform) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_integration_errors_user_id ON integration_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_errors_type_severity ON integration_errors(integration_type, severity);
CREATE INDEX IF NOT EXISTS idx_integration_errors_resolved ON integration_errors(resolved, created_at);
CREATE INDEX IF NOT EXISTS idx_integration_errors_retry ON integration_errors(resolved, next_retry_at) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_manual_review_queue_status ON manual_review_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_manual_review_queue_user ON manual_review_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_validation_logs_user_type ON webhook_validation_logs(user_id, integration_type);
CREATE INDEX IF NOT EXISTS idx_webhook_validation_logs_result ON webhook_validation_logs(validation_result, created_at);
CREATE INDEX IF NOT EXISTS idx_content_transformation_logs_user ON content_transformation_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_content_transformation_logs_template ON content_transformation_logs(template_id, transformation_result);

-- Add some default content templates
INSERT INTO content_templates (user_id, name, description, template_type, platform, template_content, variables, is_active)
SELECT 
    u.id,
    'Default Blogger Template',
    'Default template for blog post social media generation',
    'blogger',
    'all',
    '📝 New blog post: {{title}}

{{#if excerpt}}{{excerpt}}{{/if}}

{{#if url}}Read more: {{url}}{{/if}}

{{#each hashtags}}{{this}} {{/each}}',
    ARRAY['title', 'excerpt', 'url', 'hashtags'],
    TRUE
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM content_templates ct 
    WHERE ct.user_id = u.id AND ct.template_type = 'blogger' AND ct.name = 'Default Blogger Template'
);

INSERT INTO content_templates (user_id, name, description, template_type, platform, template_content, variables, is_active)
SELECT 
    u.id,
    'Default SoloBoss Template',
    'Default template for SoloBoss AI content social media generation',
    'soloboss',
    'all',
    '🤖 AI-Generated Content: {{title}}

{{#if social_text}}{{social_text}}{{else}}{{content}}{{/if}}

{{#if seo_suggestions}}💡 Key insights: {{seo_suggestions}}{{/if}}

{{#each hashtags}}{{this}} {{/each}}',
    ARRAY['title', 'social_text', 'content', 'seo_suggestions', 'hashtags'],
    TRUE
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM content_templates ct 
    WHERE ct.user_id = u.id AND ct.template_type = 'soloboss' AND ct.name = 'Default SoloBoss Template'
);

-- Platform-specific templates for Instagram
INSERT INTO content_templates (user_id, name, description, template_type, platform, template_content, variables, is_active)
SELECT 
    u.id,
    'Instagram Blogger Template',
    'Instagram-optimized template for blog posts',
    'blogger',
    'instagram',
    '📸 {{title}}

{{#if excerpt}}{{excerpt}}{{/if}}

{{#if url}}Link in bio 👆{{/if}}

.
.
.
{{#each hashtags}}{{this}} {{/each}}',
    ARRAY['title', 'excerpt', 'url', 'hashtags'],
    TRUE
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM content_templates ct 
    WHERE ct.user_id = u.id AND ct.template_type = 'blogger' AND ct.platform = 'instagram'
);

-- Platform-specific templates for Twitter/X
INSERT INTO content_templates (user_id, name, description, template_type, platform, template_content, variables, is_active)
SELECT 
    u.id,
    'Twitter Blogger Template',
    'Twitter-optimized template for blog posts',
    'blogger',
    'x',
    '🧵 {{title}}

{{#if excerpt}}{{excerpt}}{{/if}}

{{#if url}}{{url}}{{/if}} {{#each hashtags}}{{this}} {{/each}}',
    ARRAY['title', 'excerpt', 'url', 'hashtags'],
    TRUE
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM content_templates ct 
    WHERE ct.user_id = u.id AND ct.template_type = 'blogger' AND ct.platform = 'x'
);

-- Update existing blogger_integrations table to ensure it has all required columns
DO $$
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blogger_integrations' AND column_name = 'last_checked') THEN
        ALTER TABLE blogger_integrations ADD COLUMN last_checked TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blogger_integrations' AND column_name = 'created_at') THEN
        ALTER TABLE blogger_integrations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blogger_integrations' AND column_name = 'updated_at') THEN
        ALTER TABLE blogger_integrations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Update existing soloboss_integrations table to ensure it has all required columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'soloboss_integrations' AND column_name = 'created_at') THEN
        ALTER TABLE soloboss_integrations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'soloboss_integrations' AND column_name = 'updated_at') THEN
        ALTER TABLE soloboss_integrations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add triggers to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables that need automatic updated_at updates
DROP TRIGGER IF EXISTS update_content_templates_updated_at ON content_templates;
CREATE TRIGGER update_content_templates_updated_at
    BEFORE UPDATE ON content_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_errors_updated_at ON integration_errors;
CREATE TRIGGER update_integration_errors_updated_at
    BEFORE UPDATE ON integration_errors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_manual_review_queue_updated_at ON manual_review_queue;
CREATE TRIGGER update_manual_review_queue_updated_at
    BEFORE UPDATE ON manual_review_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blogger_integrations_updated_at ON blogger_integrations;
CREATE TRIGGER update_blogger_integrations_updated_at
    BEFORE UPDATE ON blogger_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_soloboss_integrations_updated_at ON soloboss_integrations;
CREATE TRIGGER update_soloboss_integrations_updated_at
    BEFORE UPDATE ON soloboss_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE content_templates IS 'Customizable templates for automated social media post generation';
COMMENT ON TABLE integration_errors IS 'Detailed error tracking and recovery for integration failures';
COMMENT ON TABLE manual_review_queue IS 'Queue for errors requiring manual review and intervention';
COMMENT ON TABLE webhook_validation_logs IS 'Logs for webhook validation attempts and results';
COMMENT ON TABLE content_transformation_logs IS 'Logs for content transformation operations and performance';

COMMENT ON COLUMN content_templates.template_content IS 'Template content with variable placeholders like {{title}}, {{#if condition}}, etc.';
COMMENT ON COLUMN content_templates.variables IS 'Array of variable names available in this template';
COMMENT ON COLUMN integration_errors.recovery_actions IS 'Array of recovery actions to attempt (retry, fallback_template, manual_review, etc.)';
COMMENT ON COLUMN integration_errors.details IS 'JSON object containing error-specific details and context';
COMMENT ON COLUMN integration_errors.context IS 'JSON object containing request/operation context when error occurred';