export enum Platform {
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  PINTEREST = 'pinterest',
  X = 'x'
}

export interface PlatformConnection {
  id: string;
  userId: string;
  platform: Platform;
  platformUserId: string;
  platformUsername: string;
  accessToken: string; // encrypted
  refreshToken?: string; // encrypted
  tokenExpiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformContent {
  content: string;
  images?: string[];
  hashtags?: string[];
  platformSpecific?: Record<string, any>;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  retryable: boolean;
}

export interface ConnectionResult {
  success: boolean;
  connection?: PlatformConnection;
  error?: string;
}