# Backup, Recovery, and Data Management Guide

## Overview

The Social Media Automation Platform includes a comprehensive backup, recovery, and data management system designed to ensure data protection, regulatory compliance, and business continuity.

## Features

### 🔄 Automated Backup System
- **Full Backups**: Complete database snapshots created daily
- **Incremental Backups**: Changes-only backups created hourly during business hours
- **Geographic Distribution**: Backups stored across multiple regions
- **Encryption**: All backups encrypted at rest using AES-256-GCM
- **Integrity Verification**: Automated checksum validation and content verification

### 🔐 Data Protection & Compliance
- **GDPR Compliance**: Right to erasure (Article 17) implementation
- **Data Export**: User data export in JSON and CSV formats
- **Secure Deletion**: Multi-stage deletion with audit trails
- **Retention Policies**: Configurable retention periods for different backup types

### 🚨 Disaster Recovery
- **Point-in-Time Recovery**: Restore to any point in time using backup combinations
- **Automated Testing**: Regular disaster recovery procedure testing
- **Documented Procedures**: Step-by-step recovery procedures with validation
- **Failover Capabilities**: Multi-region failover procedures

## Architecture

### Backup Storage Structure
```
Primary Bucket (us-central1)
├── backups/
│   ├── full_20240824_abc123.sql.gz.enc
│   ├── incremental_20240824_def456.json.gz.enc
│   └── ...
├── exports/
│   ├── user123/
│   │   ├── export_20240824_ghi789.json.enc
│   │   └── ...
└── deletion-backups/
    ├── deletion_user123_20240824.json.enc
    └── ...

Secondary Buckets (us-east1, europe-west1)
├── backups/ (replicated)
└── ...
```

### Database Schema

#### Backup Metadata
```sql
CREATE TABLE backup_metadata (
    id UUID PRIMARY KEY,
    backup_id VARCHAR(255) UNIQUE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'full', 'incremental', 'differential'
    size BIGINT NOT NULL,
    checksum VARCHAR(255) NOT NULL,
    encrypted BOOLEAN NOT NULL DEFAULT TRUE,
    location TEXT NOT NULL,
    region VARCHAR(100) NOT NULL,
    retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed'
);
```

#### Data Deletion Requests
```sql
CREATE TABLE data_deletion_requests (
    id UUID PRIMARY KEY,
    request_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    verification_required BOOLEAN NOT NULL DEFAULT TRUE,
    verification_token VARCHAR(255),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);
```

## Configuration

### Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=social_media_automation
DB_USER=postgres
DB_PASSWORD=your_password

# Backup Storage Configuration
BACKUP_BUCKET_PRIMARY=sma-backups-primary
BACKUP_BUCKET_SECONDARY=sma-backups-secondary
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account.json

# Encryption Configuration
ENCRYPTION_KEY=your-32-character-encryption-key
CURRENT_ENCRYPTION_KEY_ID=1

# Backup Schedule Configuration
BACKUP_SCHEDULE_FULL=0 2 * * *        # Daily at 2 AM
BACKUP_SCHEDULE_INCREMENTAL=0 9-17 * * 1-5  # Hourly during business hours
BACKUP_RETENTION_DAILY=7              # Keep daily backups for 7 days
BACKUP_RETENTION_WEEKLY=4             # Keep weekly backups for 4 weeks
BACKUP_RETENTION_MONTHLY=12           # Keep monthly backups for 12 months
```

### Backup Configuration Object

```typescript
const backupConfig = {
  schedule: '0 2 * * *',
  retention: {
    daily: 7,
    weekly: 4,
    monthly: 12,
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationDays: 90,
  },
  storage: {
    primary: 'sma-backups-primary',
    secondary: 'sma-backups-secondary',
    regions: ['us-central1', 'us-east1', 'europe-west1'],
  },
};
```

## API Endpoints

### Backup Management

#### Create Backup
```http
POST /api/backup/create
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "type": "full" | "incremental"
}
```

#### Restore from Backup
```http
POST /api/backup/restore
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "backupId": "full_20240824_abc123",
  "targetTime": "2024-08-24T10:30:00Z" // Optional
}
```

#### Test Backup Integrity
```http
POST /api/backup/test/{backupId}
Authorization: Bearer <admin_token>
```

### Data Export

#### Export User Data
```http
POST /api/backup/export
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "format": "json" | "csv"
}
```

### Data Deletion (GDPR)

#### Request Data Deletion
```http
POST /api/backup/delete-request
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "reason": "User requested account deletion",
  "immediate": false
}
```

#### Verify Deletion Request
```http
POST /api/backup/delete-verify
Content-Type: application/json

{
  "requestId": "del_20240824_abc123",
  "verificationToken": "verification_token_here"
}
```

### Disaster Recovery

#### Get Recovery Procedures
```http
GET /api/backup/disaster-recovery/procedures
Authorization: Bearer <admin_token>
```

#### Execute Recovery Procedure
```http
POST /api/backup/disaster-recovery/execute
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "procedureName": "database_restore_from_backup",
  "testMode": true
}
```

#### Get Recovery Status
```http
GET /api/backup/disaster-recovery/status
Authorization: Bearer <admin_token>
```

## Scheduled Jobs

The system runs several automated jobs:

### Daily Jobs
- **Full Backup** (2:00 AM): Complete database backup
- **Deletion Processing** (1:00 AM): Process scheduled data deletions

### Hourly Jobs
- **Incremental Backup** (9 AM - 5 PM, weekdays): Incremental changes backup

### Weekly Jobs
- **Backup Cleanup** (Sunday 3:00 AM): Remove expired backups
- **DR Testing** (Saturday 4:00 AM): Test disaster recovery procedures

### Monthly Jobs
- **Integrity Check** (1st day 5:00 AM): Comprehensive backup validation

## Disaster Recovery Procedures

### 1. Database Restore from Backup

**Estimated Duration**: 30 minutes  
**Priority**: Critical

**Steps**:
1. Stop application services
2. Create current database backup (safety measure)
3. Restore from backup
4. Verify database integrity
5. Start application services

### 2. Failover to Secondary Region

**Estimated Duration**: 45 minutes  
**Priority**: Critical

**Steps**:
1. Verify secondary region status
2. Update DNS records
3. Sync latest data
4. Start services in secondary region

### 3. Security Incident Response

**Estimated Duration**: 60 minutes  
**Priority**: High

**Steps**:
1. Isolate affected systems
2. Revoke compromised credentials
3. Create forensic backup
4. Notify stakeholders

## Monitoring and Alerting

### Health Checks

The system provides health check endpoints:

```http
GET /api/backup/health
```

Response:
```json
{
  "status": "healthy",
  "scheduler": {
    "isStarted": true,
    "jobCount": 6,
    "runningJobs": 0,
    "enabledJobs": 6,
    "lastJobExecution": "2024-08-24T02:00:00Z"
  },
  "backups": {
    "totalBackups": 45,
    "totalSize": 1073741824,
    "lastFullBackup": "2024-08-24T02:00:00Z",
    "lastIncrementalBackup": "2024-08-24T15:00:00Z"
  },
  "disasterRecovery": {
    "status": "ready",
    "procedureCount": 3,
    "lastTest": "2024-08-17T04:00:00Z"
  }
}
```

### Alerts

The system generates alerts for:
- Backup failures
- Integrity check failures
- Disaster recovery test failures
- Storage quota warnings
- Encryption key rotation reminders

## Security Considerations

### Encryption
- All backups encrypted using AES-256-GCM
- Encryption keys rotated every 90 days
- Key versioning for backward compatibility
- Secure key storage using environment variables

### Access Control
- Admin-only access to backup/restore operations
- User access to own data export/deletion
- Audit logging for all operations
- Multi-factor authentication for critical operations

### Data Protection
- Geographic distribution of backups
- Immutable backup storage
- Retention policies enforcement
- Secure deletion procedures

## Compliance

### GDPR Compliance
- **Right to Access**: Data export functionality
- **Right to Erasure**: Secure deletion with verification
- **Data Portability**: Export in standard formats (JSON, CSV)
- **Audit Trail**: Complete logging of all data operations

### SOC 2 Compliance
- **Security**: Encrypted backups and secure access controls
- **Availability**: Disaster recovery procedures and testing
- **Processing Integrity**: Backup integrity verification
- **Confidentiality**: Encryption and access controls

## Troubleshooting

### Common Issues

#### Backup Creation Fails
1. Check database connectivity
2. Verify storage bucket permissions
3. Check disk space for temporary files
4. Review encryption key configuration

#### Restore Operation Fails
1. Verify backup integrity
2. Check database permissions
3. Ensure sufficient disk space
4. Review restore point validity

#### Data Export Timeout
1. Check user data volume
2. Increase export timeout settings
3. Consider pagination for large datasets
4. Monitor storage bucket performance

### Log Analysis

Key log patterns to monitor:

```bash
# Successful backup
grep "backup completed" /var/log/app/combined.log

# Failed operations
grep "ERROR.*backup\|restore\|export" /var/log/app/error.log

# Security events
grep "audit.*deletion\|export" /var/log/app/audit.log
```

## Best Practices

### Backup Strategy
1. **3-2-1 Rule**: 3 copies, 2 different media, 1 offsite
2. **Regular Testing**: Test restore procedures monthly
3. **Monitoring**: Set up alerts for backup failures
4. **Documentation**: Keep recovery procedures updated

### Data Management
1. **Retention Policies**: Implement appropriate retention periods
2. **Access Controls**: Limit access to backup operations
3. **Encryption**: Always encrypt sensitive data
4. **Audit Trails**: Log all data operations

### Disaster Recovery
1. **Regular Testing**: Test procedures quarterly
2. **Documentation**: Keep procedures current
3. **Training**: Train staff on recovery procedures
4. **Communication**: Have incident response plan

## Support

For issues with the backup and recovery system:

1. Check the health endpoint for system status
2. Review logs for error messages
3. Verify configuration settings
4. Contact system administrators for critical issues

## Changelog

### Version 1.0.0 (2024-08-24)
- Initial implementation of backup system
- GDPR compliance features
- Disaster recovery procedures
- Automated scheduling
- Comprehensive testing suite