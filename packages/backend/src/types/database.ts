// Database types and interfaces

export enum Platform {
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  PINTEREST = 'pinterest',
  X = 'x'
}

export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed'
}

export enum PostSource {
  MANUAL = 'manual',
  BLOGGER = 'blogger',
  SOLOBOSS = 'soloboss'
}

export interface UserSettings {
  timezone?: string;
  defaultHashtags?: string[];
  autoApproveFromSoloBoss?: boolean;
  bloggerIntegrationEnabled?: boolean;
  platformPreferences?: PlatformPreferences;
  notificationSettings?: NotificationSettings;
}

export interface PlatformPreferences {
  facebook?: FacebookPreferences;
  instagram?: InstagramPreferences;
  pinterest?: PinterestPreferences;
  x?: XPreferences;
}

export interface FacebookPreferences {
  defaultHashtags?: string[];
  contentFormat?: 'full' | 'summary';
  includeLink?: boolean;
  autoPost?: boolean;
}

export interface InstagramPreferences {
  defaultHashtags?: string[];
  imageRequired?: boolean;
  maxHashtags?: number;
  autoPost?: boolean;
}

export interface PinterestPreferences {
  defaultBoard?: string;
  defaultHashtags?: string[];
  imageRequired?: boolean;
  autoPost?: boolean;
}

export interface XPreferences {
  defaultHashtags?: string[];
  shortenLinks?: boolean;
  threadLongContent?: boolean;
  autoPost?: boolean;
}

export interface NotificationSettings {
  emailNotifications?: boolean;
  failedPostNotifications?: boolean;
  integrationIssueNotifications?: boolean;
  weeklyReports?: boolean;
  notificationEmail?: string;
}

// Database row interfaces (matching database schema)
export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  settings: UserSettings;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformConnectionRow {
  id: string;
  user_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_username: string;
  access_token: string; // encrypted
  refresh_token?: string; // encrypted
  token_expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PostRow {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  hashtags: string[];
  platforms: Platform[];
  scheduled_time?: Date;
  status: PostStatus;
  source: PostSource;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformPostRow {
  id: string;
  post_id: string;
  platform: Platform;
  platform_post_id?: string;
  content: string;
  status: PostStatus;
  published_at?: Date;
  error?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

// Input interfaces for creating/updating records
export interface CreateUserInput {
  email: string;
  name: string;
  password_hash: string;
  settings?: UserSettings;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  password_hash?: string;
  settings?: UserSettings;
}

export interface CreatePlatformConnectionInput {
  user_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_username: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: Date;
}

export interface UpdatePlatformConnectionInput {
  platform_user_id?: string;
  platform_username?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
  is_active?: boolean;
}

export interface CreatePostInput {
  user_id: string;
  content: string;
  images?: string[];
  hashtags?: string[];
  platforms: Platform[];
  scheduled_time?: Date;
  status?: PostStatus;
  source?: PostSource;
}

export interface UpdatePostInput {
  content?: string;
  images?: string[];
  hashtags?: string[];
  platforms?: Platform[];
  scheduled_time?: Date;
  status?: PostStatus;
}

export interface CreatePlatformPostInput {
  post_id: string;
  platform: Platform;
  content: string;
  status?: PostStatus;
}

export interface UpdatePlatformPostInput {
  platform_post_id?: string;
  content?: string;
  status?: PostStatus;
  published_at?: Date;
  error?: string;
  retry_count?: number;
}