import { Platform, PlatformContent } from './platform';

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

export interface PostData {
  userId: string;
  platforms: Platform[];
  content: string;
  images?: string[];
  hashtags?: string[];
  scheduledTime?: Date;
  platformSpecificContent?: Record<Platform, PlatformContent>;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  images: string[];
  hashtags: string[];
  platforms: Platform[];
  scheduledTime?: Date;
  status: PostStatus;
  source: PostSource;
  platformPosts: PlatformPost[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPost extends PostData {
  id: string;
  status: PostStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformPost {
  platform: Platform;
  platformPostId?: string;
  content: string;
  status: PostStatus;
  publishedAt?: Date;
  error?: string;
}

export interface ExecutionResult {
  postId: string;
  platform: Platform;
  success: boolean;
  error?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  url: string;
  publishedAt: Date;
  author: string;
}

export interface GeneratedSocialPosts {
  posts: PostData[];
  requiresReview: boolean;
}

export interface SoloBossContent {
  id: string;
  title: string;
  content: string;
  seoSuggestions: string[];
  socialMediaText: string;
  images: string[];
  publishedAt: Date;
}

export interface ProcessedContent {
  posts: PostData[];
  requiresReview: boolean;
  originalContent: SoloBossContent;
}