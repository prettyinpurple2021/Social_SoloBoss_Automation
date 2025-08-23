-- Create integrations table for external service configurations
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure valid integration types
    CONSTRAINT integrations_type_check CHECK (
        integration_type IN ('blogger', 'soloboss', 'rss_feed', 'webhook', 'zapier', 'ifttt')
    ),
    
    -- Ensure one active integration per type per user
    UNIQUE(user_id, integration_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_integrations_active ON integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_integrations_configuration ON integrations USING GIN(configuration);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_integrations_user_type ON integrations(user_id, integration_type);
CREATE INDEX IF NOT EXISTS idx_integrations_user_active ON integrations(user_id, is_active);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE integrations IS 'External service integrations and configurations';
COMMENT ON COLUMN integrations.integration_type IS 'Type of integration (blogger, soloboss, etc.)';
COMMENT ON COLUMN integrations.configuration IS 'Integration-specific configuration and settings';
COMMENT ON COLUMN integrations.is_active IS 'Whether the integration is currently active';