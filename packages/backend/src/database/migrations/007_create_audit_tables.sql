-- Create audit_logs table for general audit events
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create security_events table for security-specific events
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('authentication', 'authorization', 'token_management', 'data_access', 'configuration', 'suspicious_activity')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_action ON security_events(action);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_resource ON audit_logs(user_id, resource);
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON security_events(type, severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON security_events(user_id, created_at);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'General audit log for all user actions and system events';
COMMENT ON TABLE security_events IS 'Security-specific events for monitoring and alerting';

COMMENT ON COLUMN audit_logs.action IS 'The action that was performed (e.g., login_attempt, post_created)';
COMMENT ON COLUMN audit_logs.resource IS 'The type of resource affected (e.g., user, post, oauth_token)';
COMMENT ON COLUMN audit_logs.resource_id IS 'The ID of the specific resource affected';
COMMENT ON COLUMN audit_logs.details IS 'Additional context and metadata about the event';
COMMENT ON COLUMN audit_logs.success IS 'Whether the action was successful';

COMMENT ON COLUMN security_events.type IS 'Category of security event';
COMMENT ON COLUMN security_events.severity IS 'Severity level for alerting and prioritization';
COMMENT ON COLUMN security_events.action IS 'Specific security action or event';
COMMENT ON COLUMN security_events.details IS 'Security event context and metadata';