import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { BackupService } from './BackupService';

interface DeletionRequest {
  id: string;
  userId: string;
  reason: string;
  requestedAt: Date;
  scheduledFor?: Date;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed';
  completedAt?: Date;
  verificationRequired: boolean;
}

interface Dele