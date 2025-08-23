-- Create failed_login_attempts table for security monitoring
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_count INTEGER DEFAULT 1,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for email and IP combination
    UNIQUE(email, ip_address)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_blocked ON failed_login_attempts(blocked_until);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_last_attempt ON failed_login_attempts(last_attempt_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email_ip ON failed_login_attempts(email, ip_address);

-- Add comments for documentation
COMMENT ON TABLE failed_login_attempts IS 'Failed login attempts for security monitoring and account lockout';
COMMENT ON COLUMN failed_login_attempts.attempt_count IS 'Number of consecutive failed attempts';
COMMENT ON COLUMN failed_login_attempts.blocked_until IS 'Timestamp until which login is blocked';