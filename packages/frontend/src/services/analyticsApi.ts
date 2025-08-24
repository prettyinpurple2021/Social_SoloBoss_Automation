import { Platform } from '@sma/shared/types/platform';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  analytics?: T;
  error?: string;
  message?: string;
}

export interface AnalyticsQuery {
  startDate?: Date;
  endDate?: Date;
  platforms?: Platform[];
  timeRange?: '7d' | '30d' | '90d' | 'custom';
}

export interface AnalyticsOverview {
  totalPosts: number;
  totalEngagement: number;
  totalReach: number;
  totalImpressions: number;
  engagementRate: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface PlatformAnalytics {
  platform: Platform;
  posts: number;
  engagement: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  topPost?: {
    id: string;
    content: string;
    engagement: number;
    publishedAt: Date;
  };
}

export interface EngagementTrend {
  date: string;
  engagement: number;
  reach: number;
  impressions: number;
  posts: number;
}

export interface TopPerformingPost {
  id: string;
  content: string;
  platform: Platform;
  engagement: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  publishedAt: Date;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  platformBreakdown: PlatformAnalytics[];
  engagementTrend: EngagementTrend[];
  topPosts: TopPerformingPost[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'post_published' | 'high_engagement' | 'milestone_reached' | 'platform_connected';
  message: string;
  timestamp: Date;
  platform?: Platform;
  postId?: string;
  metadata?: Record<string, any>;
}

class AnalyticsApi {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      };
    }
  }

  private buildQueryString(query: AnalyticsQuery): string {
    const searchParams = new URLSearchParams();
    
    if (query.startDate) searchParams.append('startDate', query.startDate.toISOString());
    if (query.endDate) searchParams.append('endDate', query.endDate.toISOString());
    if (query.timeRange) searchParams.append('timeRange', query.timeRange);
    if (query.platforms) {
      query.platforms.forEach(platform => searchParams.append('platforms', platform));
    }

    return searchParams.toString();
  }

  async getAnalytics(query: AnalyticsQuery = {}): Promise<ApiResponse<AnalyticsData>> {
    const queryString = this.buildQueryString(query);
    const endpoint = `/analytics${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<AnalyticsData>(endpoint);
  }

  async getOverview(query: AnalyticsQuery = {}): Promise<ApiResponse<AnalyticsOverview>> {
    const queryString = this.buildQueryString(query);
    const endpoint = `/analytics/overview${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<AnalyticsOverview>(endpoint);
  }

  async getPlatformAnalytics(query: AnalyticsQuery = {}): Promise<ApiResponse<PlatformAnalytics[]>> {
    const queryString = this.buildQueryString(query);
    const endpoint = `/analytics/platforms${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<PlatformAnalytics[]>(endpoint);
  }

  async getEngagementTrend(query: AnalyticsQuery = {}): Promise<ApiResponse<EngagementTrend[]>> {
    const queryString = this.buildQueryString(query);
    const endpoint = `/analytics/engagement-trend${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<EngagementTrend[]>(endpoint);
  }

  async getTopPosts(query: AnalyticsQuery & { limit?: number } = {}): Promise<ApiResponse<TopPerformingPost[]>> {
    const searchParams = new URLSearchParams(this.buildQueryString(query));
    if (query.limit) searchParams.append('limit', query.limit.toString());
    
    const queryString = searchParams.toString();
    const endpoint = `/analytics/top-posts${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<TopPerformingPost[]>(endpoint);
  }

  async getRecentActivity(limit = 10): Promise<ApiResponse<ActivityItem[]>> {
    return this.makeRequest<ActivityItem[]>(`/analytics/activity?limit=${limit}`);
  }

  async getPostAnalytics(postId: string): Promise<ApiResponse<{
    engagement: number;
    reach: number;
    impressions: number;
    clicks: number;
    shares: number;
    comments: number;
    likes: number;
    platformBreakdown: Record<Platform, {
      engagement: number;
      reach: number;
      impressions: number;
    }>;
  }>> {
    return this.makeRequest(`/analytics/posts/${postId}`);
  }

  async exportAnalytics(query: AnalyticsQuery & { format: 'csv' | 'json' }): Promise<ApiResponse<{
    downloadUrl: string;
    expiresAt: Date;
  }>> {
    const searchParams = new URLSearchParams(this.buildQueryString(query));
    searchParams.append('format', query.format);
    
    return this.makeRequest(`/analytics/export?${searchParams.toString()}`, {
      method: 'POST'
    });
  }
}

export const analyticsApi = new AnalyticsApi();