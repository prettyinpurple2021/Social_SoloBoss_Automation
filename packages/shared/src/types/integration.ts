// Import types from other files to avoid duplication
import { BloggerPost } from './blogger';
import { SoloBossContent } from './post';

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  template: string;
  variables: TemplateVariable[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'image' | 'url' | 'date' | 'list';
  required: boolean;
  defaultValue?: string;
  description: string;
}

export interface IntegrationConfig {
  id: string;
  userId: string;
  type: 'blogger' | 'soloboss';
  configuration: Record<string, any>;
  isActive: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookPayload {
  type: 'blogger.post.published' | 'soloboss.content.created';
  data: BloggerPost | SoloBossContent;
  timestamp: Date;
  signature?: string;
}

export interface IntegrationError {
  id: string;
  integrationId: string;
  errorType: 'webhook' | 'api' | 'processing' | 'validation';
  errorCode: string;
  errorMessage: string;
  payload?: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ProcessingResult {
  success: boolean;
  generatedPosts: PostData[];
  errors: string[];
  warnings: string[];
  requiresReview: boolean;
}

import { Platform } from './platform';
import { PostData } from './post';