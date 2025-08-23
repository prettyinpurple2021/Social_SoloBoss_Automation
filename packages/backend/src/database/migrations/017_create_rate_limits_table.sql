-- Create rate_limits table for API rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- IP address, user ID, or API key
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_duration_seconds INTEGER NOT NULL DEFAULT 3600, -- 1 hour default
    limit_per_window INTEGER NOT NULL DEFAULT 1000,
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for identifier and endpoint combination
    UNIQUE(identifier, endpoint)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(blocked_until);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint ON rate_limits(identifier, endpoint);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE rate_limits IS 'API rate limiting tracking per identifier and endpoint';
COMMENT ON COLUMN rate_limits.identifier IS 'IP address, user ID, or API key being rate limited';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the current rate limiting window';
COMMENT ON COLUMN rate_limits.window_duration_seconds IS 'Duration of rate limiting window in seconds';
COMMENT ON COLUMN rate_limits.limit_per_window IS 'Maximum requests allowed per window';