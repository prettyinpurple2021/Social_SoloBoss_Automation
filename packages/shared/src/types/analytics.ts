import { Platform } from './platform';

export interface AnalyticsMetrics {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  shares: number;
  comments: number;
  likes: number;
  saves?: number; // Instagram/Pinterest specific
}

export interface PostAnalytics {
  postId: string;
  platform: Platform;
  metrics: AnalyticsMetrics;
  recordedAt: Date;
  metadata?: Record<string, any>;
}

export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
  platforms?: Platform[];
  postIds?: string[];
  metrics?: (keyof AnalyticsMetrics)[];
}

export interface AnalyticsSummary {
  totalPosts: number;
  totalImpressions: number;
  totalEngagement: number;
  averageEngagementRate: number;
  topPerformingPlatform: Platform;
  engagementTrend: 'up' | 'down' | 'stable';
}

export interface PlatformAnalytics {
  platform: Platform;
  metrics: AnalyticsMetrics;
  engagementRate: number;
  postCount: number;
  averageMetrics: AnalyticsMetrics;
}

export interface EngagementMetrics {
  timeline: Array<{
    date: Date;
    engagement: number;
    impressions: number;
    engagementRate: number;
  }>;
  byPlatform: PlatformAnalytics[];
  topPosts: Array<{
    postId: string;
    content: string;
    platform: Platform;
    engagementRate: number;
    metrics: AnalyticsMetrics;
  }>;
}

export interface OptimalTimingData {
  platform: Platform;
  bestHours: number[];
  bestDays: string[];
  timezone: string;
  confidence: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  engagement: EngagementMetrics;
  platformBreakdown: PlatformAnalytics[];
  timing: OptimalTimingData[];
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

export interface AnalyticsExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  includeMetrics: (keyof AnalyticsMetrics)[];
  groupBy: 'platform' | 'date' | 'post';
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}