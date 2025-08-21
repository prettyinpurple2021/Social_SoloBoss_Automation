-- Create platform_connections table
CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    platform_username VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL, -- encrypted
    refresh_token TEXT, -- encrypted
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one connection per platform per user
    UNIQUE(user_id, platform)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_id ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_connections_active ON platform_connections(is_active);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_platform_connections_updated_at BEFORE UPDATE ON platform_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();