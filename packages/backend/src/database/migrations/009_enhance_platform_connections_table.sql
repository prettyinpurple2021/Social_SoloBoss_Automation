-- Enhance platform_connections table with additional fields from design
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for scopes
CREATE INDEX IF NOT EXISTS idx_platform_connections_scopes ON platform_connections USING GIN(scopes);

-- Create index for metadata
CREATE INDEX IF NOT EXISTS idx_platform_connections_metadata ON platform_connections USING GIN(metadata);

-- Add comment for documentation
COMMENT ON TABLE platform_connections IS 'OAuth connections to social media platforms';
COMMENT ON COLUMN platform_connections.scopes IS 'OAuth scopes granted for this connection';
COMMENT ON COLUMN platform_connections.metadata IS 'Platform-specific metadata and configuration';