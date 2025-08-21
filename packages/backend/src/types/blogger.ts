export interface BloggerConfig {
  userId: string;
  blogUrl: string;
  rssFeedUrl: string;
  lastChecked?: Date;
  isActive: boolean;
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
  newPosts: BloggerPost[];
  lastChecked: Date;
  error?: string;
}

export interface BloggerIntegrationSettings {
  userId: string;
  blogUrl: string;
  autoApprove: boolean;
  defaultPlatforms: string[];
  customHashtags: string[];
  enabled: boolean;
}