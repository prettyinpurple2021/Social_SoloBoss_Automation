-- Create security_incidents table for incident management
CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'authentication_failure', 
        'authorization_failure', 
        'data_breach', 
        'suspicious_activity', 
        'system_compromise',
        'malicious_input',
        'rate_limit_abuse'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    affected_users JSONB DEFAULT '[]',
    affected_resources JSONB DEFAULT '[]',
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'false_positive')),
    assigned_to VARCHAR(255),
    details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255)
);

-- Create incident_response_actions table for tracking response actions
CREATE TABLE IF NOT EXISTS incident_response_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'block_ip', 
        'disable_user', 
        'revoke_tokens', 
        'alert_admin', 
        'backup_data', 
        'isolate_system',
        'notify_users'
    )),
    description TEXT NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    executed_by VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blocked_ips table for IP blocking
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    blocked_by VARCHAR(255) NOT NULL,
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create security_alerts table for alert management
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES security_incidents(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    recipients JSONB DEFAULT '[]',
    sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'resolved')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON security_incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_resolved_at ON security_incidents(resolved_at);

CREATE INDEX IF NOT EXISTS idx_incident_response_actions_incident_id ON incident_response_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_response_actions_type ON incident_response_actions(type);
CREATE INDEX IF NOT EXISTS idx_incident_response_actions_executed_at ON incident_response_actions(executed_at);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_at ON blocked_ips(blocked_at);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires_at ON blocked_ips(expires_at);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(is_active);

CREATE INDEX IF NOT EXISTS idx_security_alerts_incident_id ON security_alerts(incident_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_sent_at ON security_alerts(sent_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_incidents_type_severity ON security_incidents(type, severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status_detected ON security_incidents(status, detected_at);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active_expires ON blocked_ips(is_active, expires_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_security_incidents_updated_at BEFORE UPDATE ON security_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blocked_ips_updated_at BEFORE UPDATE ON blocked_ips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE security_incidents IS 'Security incidents and their management lifecycle';
COMMENT ON TABLE incident_response_actions IS 'Actions taken in response to security incidents';
COMMENT ON TABLE blocked_ips IS 'IP addresses blocked for security reasons';
COMMENT ON TABLE security_alerts IS 'Security alerts and notifications';

COMMENT ON COLUMN security_incidents.type IS 'Type of security incident';
COMMENT ON COLUMN security_incidents.severity IS 'Severity level of the incident';
COMMENT ON COLUMN security_incidents.affected_users IS 'JSON array of affected user IDs';
COMMENT ON COLUMN security_incidents.affected_resources IS 'JSON array of affected resource identifiers';
COMMENT ON COLUMN security_incidents.metadata IS 'Additional incident metadata including detection method and risk score';

COMMENT ON COLUMN incident_response_actions.type IS 'Type of response action taken';
COMMENT ON COLUMN incident_response_actions.success IS 'Whether the action was executed successfully';

COMMENT ON COLUMN blocked_ips.expires_at IS 'When the IP block expires (NULL for permanent blocks)';
COMMENT ON COLUMN blocked_ips.is_active IS 'Whether the IP block is currently active';