import os
import json
import logging
from datetime import datetime, timezone
from google.cloud import sql_v1
from google.cloud import storage
from google.cloud import pubsub_v1
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
PROJECT_ID = os.environ.get('PROJECT_ID')
DATABASE_INSTANCE = os.environ.get('DATABASE_INSTANCE')
BACKUP_BUCKET = os.environ.get('BACKUP_BUCKET')
ENVIRONMENT = os.environ.get('ENVIRONMENT')
NOTIFICATION_TOPIC = os.environ.get('NOTIFICATION_TOPIC', '')

def backup_handler(event, context):
    """
    Main backup handler function triggered by Pub/Sub
    """
    try:
        # Decode the Pub/Sub message
        if 'data' in event:
            message_data = base64.b64decode(event['data']).decode('utf-8')
            message = json.loads(message_data)
        else:
            message = {'type': 'manual_backup'}
        
        logger.info(f"Starting backup process: {message}")
        
        # Perform database backup
        backup_id = create_database_backup()
        
        # Export backup to Cloud Storage
        export_backup_to_storage(backup_id)
        
        # Verify backup integrity
        verify_backup_integrity(backup_id)
        
        # Send success notification
        send_notification('success', f"Backup completed successfully: {backup_id}")
        
        logger.info(f"Backup process completed successfully: {backup_id}")
        return {'status': 'success', 'backup_id': backup_id}
        
    except Exception as e:
        logger.error(f"Backup process failed: {str(e)}")
        send_notification('error', f"Backup failed: {str(e)}")
        raise

def create_database_backup():
    """
    Create a Cloud SQL backup
    """
    client = sql_v1.SqlBackupRunsServiceClient()
    
    # Generate backup ID with timestamp
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    backup_id = f"sma-backup-{ENVIRONMENT}-{timestamp}"
    
    # Create backup request
    request = sql_v1.SqlBackupRunsInsertRequest(
        project=PROJECT_ID,
        instance=DATABASE_INSTANCE,
        body=sql_v1.BackupRun(
            description=f"Automated backup for {ENVIRONMENT} environment",
            type_=sql_v1.BackupRun.Type.ON_DEMAND,
            backup_kind=sql_v1.BackupRun.BackupKind.SNAPSHOT
        )
    )
    
    # Execute backup
    operation = client.insert(request=request)
    logger.info(f"Database backup initiated: {backup_id}")
    
    # Wait for backup to complete (simplified - in production, use operation polling)
    return backup_id

def export_backup_to_storage(backup_id):
    """
    Export backup to Cloud Storage bucket
    """
    client = sql_v1.SqlExportContextServiceClient()
    
    # Create export request
    export_uri = f"gs://{BACKUP_BUCKET}/database-backups/{backup_id}.sql"
    
    request = sql_v1.SqlInstancesExportRequest(
        project=PROJECT_ID,
        instance=DATABASE_INSTANCE,
        body=sql_v1.InstancesExportRequest(
            export_context=sql_v1.ExportContext(
                uri=export_uri,
                kind="sql#exportContext",
                file_type=sql_v1.ExportContext.FileType.SQL,
                databases=["social_soloboss_" + ENVIRONMENT]
            )
        )
    )
    
    # Execute export
    operation = client.export(request=request)
    logger.info(f"Database export initiated to: {export_uri}")
    
    return export_uri

def verify_backup_integrity(backup_id):
    """
    Verify backup integrity and completeness
    """
    storage_client = storage.Client()
    bucket = storage_client.bucket(BACKUP_BUCKET)
    
    # Check if backup file exists
    backup_blob_name = f"database-backups/{backup_id}.sql"
    blob = bucket.blob(backup_blob_name)
    
    if not blob.exists():
        raise Exception(f"Backup file not found: {backup_blob_name}")
    
    # Check file size (should be > 0)
    blob.reload()
    if blob.size == 0:
        raise Exception(f"Backup file is empty: {backup_blob_name}")
    
    # Create metadata file
    metadata = {
        'backup_id': backup_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'environment': ENVIRONMENT,
        'database_instance': DATABASE_INSTANCE,
        'file_size': blob.size,
        'file_path': backup_blob_name,
        'verification_status': 'verified'
    }
    
    metadata_blob = bucket.blob(f"metadata/{backup_id}.json")
    metadata_blob.upload_from_string(json.dumps(metadata, indent=2))
    
    logger.info(f"Backup verification completed: {backup_id}")

def verify_backup(event, context):
    """
    Backup verification function triggered by Cloud Storage events
    """
    try:
        file_name = event['name']
        bucket_name = event['bucket']
        
        logger.info(f"Verifying backup file: {file_name}")
        
        # Only process SQL backup files
        if not file_name.endswith('.sql') or 'database-backups' not in file_name:
            logger.info(f"Skipping non-backup file: {file_name}")
            return
        
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        # Basic integrity checks
        blob.reload()
        
        if blob.size == 0:
            raise Exception(f"Backup file is empty: {file_name}")
        
        # Check for SQL dump header
        content_sample = blob.download_as_text(start=0, end=1000)
        if 'PostgreSQL database dump' not in content_sample:
            raise Exception(f"Invalid SQL dump format: {file_name}")
        
        # Update metadata with verification results
        backup_id = file_name.split('/')[-1].replace('.sql', '')
        metadata = {
            'backup_id': backup_id,
            'verification_timestamp': datetime.now(timezone.utc).isoformat(),
            'file_size': blob.size,
            'verification_status': 'passed',
            'checks_performed': [
                'file_exists',
                'non_empty',
                'sql_format_valid'
            ]
        }
        
        metadata_blob = bucket.blob(f"verification/{backup_id}.json")
        metadata_blob.upload_from_string(json.dumps(metadata, indent=2))
        
        send_notification('info', f"Backup verification passed: {backup_id}")
        logger.info(f"Backup verification completed: {backup_id}")
        
    except Exception as e:
        logger.error(f"Backup verification failed: {str(e)}")
        send_notification('error', f"Backup verification failed: {str(e)}")
        raise

def send_notification(level, message):
    """
    Send notification via Pub/Sub
    """
    if not NOTIFICATION_TOPIC:
        logger.info(f"No notification topic configured, skipping: {message}")
        return
    
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(PROJECT_ID, NOTIFICATION_TOPIC)
        
        notification_data = {
            'level': level,
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'environment': ENVIRONMENT,
            'service': 'backup-system'
        }
        
        # Publish message
        future = publisher.publish(
            topic_path,
            json.dumps(notification_data).encode('utf-8')
        )
        
        logger.info(f"Notification sent: {message}")
        
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")

def cleanup_old_backups():
    """
    Clean up old backups based on retention policy
    """
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(BACKUP_BUCKET)
        
        # List all backup files
        blobs = bucket.list_blobs(prefix='database-backups/')
        
        # Sort by creation time and keep only recent backups
        backup_files = []
        for blob in blobs:
            if blob.name.endswith('.sql'):
                backup_files.append((blob.name, blob.time_created))
        
        # Sort by creation time (newest first)
        backup_files.sort(key=lambda x: x[1], reverse=True)
        
        # Keep only the last 30 backups (configurable)
        retention_count = int(os.environ.get('BACKUP_RETENTION_COUNT', '30'))
        
        if len(backup_files) > retention_count:
            files_to_delete = backup_files[retention_count:]
            
            for file_name, _ in files_to_delete:
                blob = bucket.blob(file_name)
                blob.delete()
                logger.info(f"Deleted old backup: {file_name}")
                
                # Also delete associated metadata
                backup_id = file_name.split('/')[-1].replace('.sql', '')
                metadata_blob = bucket.blob(f"metadata/{backup_id}.json")
                if metadata_blob.exists():
                    metadata_blob.delete()
                
                verification_blob = bucket.blob(f"verification/{backup_id}.json")
                if verification_blob.exists():
                    verification_blob.delete()
        
        logger.info(f"Cleanup completed. Kept {min(len(backup_files), retention_count)} backups")
        
    except Exception as e:
        logger.error(f"Backup cleanup failed: {str(e)}")
        send_notification('warning', f"Backup cleanup failed: {str(e)}")

if __name__ == '__main__':
    # For local testing
    test_event = {
        'data': base64.b64encode(json.dumps({'type': 'test_backup'}).encode()).decode()
    }
    backup_handler(test_event, None)