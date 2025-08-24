-- Migration: Create backup and recovery system tables
-- Description: Tables for backup metadata, recovery points, and data management

-- Backup metadata table
CREATE TABLE backup_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id VARCHAR(255) UNIQUE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental', 'differential')),
    size BIGINT NOT NULL,
    checksum VARCHAR(255) NOT NULL,
    encrypted BOOLEAN NOT NULL DEFAULT TRUE,
    location TEXT NOT NULL,
    region VARCHAR(100) NOT NULL,
    retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed', 'expired')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recovery points table for point-in-time recovery
CREATE TABLE recovery_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id VARCHAR(255) UNIQUE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    backup_id VARCHAR(255) REFERENCES backup_metadata(backup_id) ON DELETE CASCADE,
    transaction_log_position BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'corrupted')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data deletion requests table (GDPR compliance)
CREATE TABLE data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    verification_required BOOLEAN NOT NULL DEFAULT TRUE,
    verification_token VARCHAR(255),
    verification_expires_at TIMESTAMP WITH TIME ZONE,
    backup_location TEXT,
    deletion_summary JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data export requests table
CREATE TABLE data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    format VARCHAR(10) NOT NULL CHECK (format IN ('json', 'csv')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    file_size BIGINT,
    encrypted BOOLEAN NOT NULL DEFAULT TRUE,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backup jobs table for scheduling and tracking
CREATE TABLE backup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental', 'differential')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'cancelled')),
    backup_id VARCHAR(255) REFERENCES backup_metadata(backup_id) ON DELETE SET NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disaster recovery procedures table
CREATE TABLE disaster_recovery_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    steps JSONB NOT NULL,
    estimated_duration_minutes INTEGER,
    priority INTEGER NOT NULL DEFAULT 1,
    last_tested_at TIMESTAMP WITH TIME ZONE,
    test_results JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disaster recovery tests table
CREATE TABLE disaster_recovery_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id VARCHAR(255) UNIQUE NOT NULL,
    procedure_id UUID NOT NULL REFERENCES disaster_recovery_procedures(id) ON DELETE CASCADE,
    test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('scheduled', 'manual', 'incident')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed', 'cancelled')),
    results JSONB,
    issues_found TEXT[],
    recommendations TEXT[],
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_backup_metadata_timestamp ON backup_metadata(timestamp);
CREATE INDEX idx_backup_metadata_type ON backup_metadata(type);
CREATE INDEX idx_backup_metadata_status ON backup_metadata(status);
CREATE INDEX idx_backup_metadata_retention ON backup_metadata(retention_until);
CREATE INDEX idx_backup_metadata_backup_id ON backup_metadata(backup_id);

CREATE INDEX idx_recovery_points_timestamp ON recovery_points(timestamp);
CREATE INDEX idx_recovery_points_backup_id ON recovery_points(backup_id);
CREATE INDEX idx_recovery_points_status ON recovery_points(status);

CREATE INDEX idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX idx_data_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX idx_data_deletion_requests_scheduled_for ON data_deletion_requests(scheduled_for);

CREATE INDEX idx_data_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX idx_data_export_requests_status ON data_export_requests(status);
CREATE INDEX idx_data_export_requests_expires_at ON data_export_requests(expires_at);

CREATE INDEX idx_backup_jobs_scheduled_at ON backup_jobs(scheduled_at);
CREATE INDEX idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX idx_backup_jobs_type ON backup_jobs(type);

CREATE INDEX idx_disaster_recovery_procedures_is_active ON disaster_recovery_procedures(is_active);
CREATE INDEX idx_disaster_recovery_procedures_priority ON disaster_recovery_procedures(priority);

CREATE INDEX idx_disaster_recovery_tests_procedure_id ON disaster_recovery_tests(procedure_id);
CREATE INDEX idx_disaster_recovery_tests_status ON disaster_recovery_tests(status);
CREATE INDEX idx_disaster_recovery_tests_started_at ON disaster_recovery_tests(started_at);

-- Add comments for documentation
COMMENT ON TABLE backup_metadata IS 'Metadata for all database backups including location, size, and retention information';
COMMENT ON TABLE recovery_points IS 'Point-in-time recovery checkpoints for database restoration';
COMMENT ON TABLE data_deletion_requests IS 'GDPR-compliant user data deletion requests and tracking';
COMMENT ON TABLE data_export_requests IS 'User data export requests in various formats';
COMMENT ON TABLE backup_jobs IS 'Scheduled and tracked backup operations';
COMMENT ON TABLE disaster_recovery_procedures IS 'Documented disaster recovery procedures and testing';
COMMENT ON TABLE disaster_recovery_tests IS 'Results and tracking of disaster recovery testing';

COMMENT ON COLUMN backup_metadata.backup_id IS 'Unique identifier for the backup file';
COMMENT ON COLUMN backup_metadata.checksum IS 'SHA-256 checksum for backup integrity verification';
COMMENT ON COLUMN backup_metadata.location IS 'Storage location path or URL for the backup file';
COMMENT ON COLUMN backup_metadata.retention_until IS 'Date when backup can be safely deleted';

COMMENT ON COLUMN recovery_points.transaction_log_position IS 'Database transaction log position for point-in-time recovery';

COMMENT ON COLUMN data_deletion_requests.verification_token IS 'Token for user verification before deletion';
COMMENT ON COLUMN data_deletion_requests.deletion_summary IS 'Summary of deleted records and data';

COMMENT ON COLUMN data_export_requests.download_url IS 'Secure temporary URL for downloading exported data';
COMMENT ON COLUMN data_export_requests.expires_at IS 'Expiration time for download URL';

COMMENT ON COLUMN disaster_recovery_procedures.steps IS 'JSON array of recovery steps with commands and validation';
COMMENT ON COLUMN disaster_recovery_procedures.estimated_duration_minutes IS 'Expected time to complete recovery procedure';