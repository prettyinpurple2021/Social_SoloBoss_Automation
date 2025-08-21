import { Platform } from './platform';

export interface BloggerIntegration {
  id: string;
  userId: string;
  blogUrl: string;
  rssFeedUrl: string;
  autoApprove: boolean;
  defaultPlatforms: Platform[];
  customHashtags: string[];
  enabled: boolean;
  lastChecked?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BloggerIntegrationSettings {
  blogUrl: string;
  autoApprove: boolean;
  defaultPlatforms: Platform[];
  customHashtags: string[];
  enabled: boolean;
}

export interface BloggerPost {
  id: string;
  title: string;
  content: string;
  url: string;
  publishedAt: Date;
  author: string;
  excerpt?: string;
  categories?: string[];
}

export interface BloggerMonitorResult {
  newPostsFound: number;
  newPosts: Array<{
    id: string;
    title: string;
    excerpt?: string;
    url: string;
    publishedAt: Date;
  }>;
  lastChecked: Date;
  error?: string;
}

export interface BloggerTestResult {
  recentPosts: Array<{
    id: string;
    title: string;
    excerpt?: string;
    url: string;
    publishedAt: Date;
    author: string;
    categories?: string[];
  }>;
}