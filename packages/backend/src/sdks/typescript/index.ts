/**
 * Social Media Automation Platform - TypeScript/JavaScript SDK
 * 
 * Official SDK for integrating with the Social Media Automation Platform API
 * Provides type-safe methods for all API endpoints with built-in error handling,
 * retry logic, and developer-friendly features.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Types
export interface SMAConfig {
  baseURL?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  debug?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  content: string;
  images?: string[];
  hashtags?: string[];
  platforms: Platform[];
  scheduledTime?: string;
  status: PostStatus;
  source: PostSource;
  platformPosts?: PlatformPost[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostRequest {
  content: string;
  images?: string[];
  hashtags?: string[];
  platforms: Platform[];
  scheduledTime?: string;
  platformSpecificContent?: Record<Platform, Partial<CreatePostRequest>>;
}

export interface PlatformPost {
  platform: Platform;
  platformPostId?: string;
  content: string;
  status: PostStatus;
  publishedAt?: string;
  error?: string;
}

export interface PlatformConnection {
  id: string;
  platform: Platform;
  platformUserId: string;
  platformUsername?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Analytics {
  totalPosts: number;
  publishedPosts: number;
  failedPosts: number;
  scheduledPosts: number;
  platformBreakdown: Record<Platform, number>;
  successRate: number;
  averagePostsPerDay: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
    responseTime?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
  retryable: boolean;
  retryAfter?: number;
  timestamp: string;
  requestId: string;
  documentation?: string;
  supportContact?: string;
}

export type Platform = 'facebook' | 'instagram' | 'pinterest' | 'x';
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type PostSource = 'manual' | 'blogger' | 'soloboss';

export interface PostFilters {
  page?: number;
  limit?: number;
  status?: PostStatus;
  platform?: Platform;
  sort?: 'createdAt' | 'scheduledTime' | 'publishedAt';
  order?: 'asc' | 'desc';
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  platform?: Platform;
}

// Custom error class for SDK errors
export class SMAError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly requestId?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    retryable: boolean = false,
    retryAfter?: number,
    requestId?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SMAError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.requestId = requestId;
    this.details = details;
  }
}

/**
 * Main SDK class for Social Media Automation Platform
 */
export class SocialMediaAutomationSDK {
  private client: AxiosInstance;
  private config: Required<SMAConfig>;
  private tokens?: AuthTokens;

  constructor(config: SMAConfig = {}) {
    this.config = {
      baseURL: config.baseURL || 'https://api.sma-platform.com/api',
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      debug: config.debug || false
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SMA-SDK-JS/1.0.0',
        'X-SDK-Version': '1.0.0'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication token
        if (this.tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
        } else if (this.config.apiKey) {
          config.headers['X-API-Key'] = this.config.apiKey;
        }

        // Add request ID for tracing
        config.headers['X-Request-ID'] = this.generateRequestId();

        if (this.config.debug) {
          console.log('SMA SDK Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            headers: config.headers,
            data: config.data
          });
        }

        return config;
      },
      (error) => {
        if (this.config.debug) {
          console.error('SMA SDK Request Error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          console.log('SMA SDK Response:', {
            status: response.status,
            headers: response.headers,
            data: response.data
          });
        }
        return response;
      },
      async (error) => {
        if (this.config.debug) {
          console.error('SMA SDK Response Error:', error.response?.data || error.message);
        }

        // Handle token expiration
        if (error.response?.status === 401 && this.tokens?.refreshToken) {
          try {
            await this.refreshToken();
            // Retry the original request
            return this.client.request(error.config);
          } catch (refreshError) {
            // Refresh failed, clear tokens
            this.tokens = undefined;
          }
        }

        // Convert to SMAError
        const apiError = error.response?.data?.error;
        if (apiError) {
          throw new SMAError(
            apiError.message,
            apiError.code,
            error.response.status,
            apiError.retryable,
            apiError.retryAfter,
            apiError.requestId,
            apiError.details
          );
        }

        throw new SMAError(
          error.message || 'Network error occurred',
          'NETWORK_ERROR',
          error.response?.status,
          true
        );
      }
    );
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `sdk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Make a request with retry logic
   */
  private async makeRequest<T>(
    config: AxiosRequestConfig,
    retryCount: number = 0
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.request(config);
      return response.data;
    } catch (error) {
      if (error instanceof SMAError && error.retryable && retryCount < this.config.retryAttempts) {
        const delay = error.retryAfter ? error.retryAfter * 1000 : this.config.retryDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest<T>(config, retryCount + 1);
      }
      throw error;
    }
  }

  // Authentication methods
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await this.makeRequest<{ user: User; token: string; refreshToken?: string }>({
      method: 'POST',
      url: '/auth/login',
      data: { email, password }
    });

    if (!response.success || !response.data) {
      throw new SMAError('Login failed', 'LOGIN_FAILED');
    }

    this.tokens = {
      accessToken: response.data.token,
      refreshToken: response.data.refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    };

    return {
      user: response.data.user,
      tokens: this.tokens
    };
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await this.makeRequest<{ user: User; token: string; refreshToken?: string }>({
      method: 'POST',
      url: '/auth/register',
      data: { email, password, name }
    });

    if (!response.success || !response.data) {
      throw new SMAError('Registration failed', 'REGISTRATION_FAILED');
    }

    this.tokens = {
      accessToken: response.data.token,
      refreshToken: response.data.refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };

    return {
      user: response.data.user,
      tokens: this.tokens
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new SMAError('No refresh token available', 'NO_REFRESH_TOKEN');
    }

    const response = await this.makeRequest<{ token: string }>({
      method: 'POST',
      url: '/auth/refresh',
      data: { refreshToken: this.tokens.refreshToken }
    });

    if (!response.success || !response.data) {
      throw new SMAError('Token refresh failed', 'TOKEN_REFRESH_FAILED');
    }

    this.tokens = {
      ...this.tokens,
      accessToken: response.data.token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };

    return this.tokens;
  }

  /**
   * Set authentication tokens manually
   */
  setTokens(tokens: AuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Logout and clear tokens
   */
  async logout(): Promise<void> {
    try {
      await this.makeRequest({
        method: 'POST',
        url: '/auth/logout'
      });
    } finally {
      this.tokens = undefined;
    }
  }

  // Posts methods
  /**
   * Get posts with optional filtering
   */
  async getPosts(filters: PostFilters = {}): Promise<PaginatedResponse<Post>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await this.makeRequest<Post[]>({
      method: 'GET',
      url: `/posts?${params.toString()}`
    });

    return response as PaginatedResponse<Post>;
  }

  /**
   * Get a specific post by ID
   */
  async getPost(postId: string): Promise<Post> {
    const response = await this.makeRequest<Post>({
      method: 'GET',
      url: `/posts/${postId}`
    });

    if (!response.success || !response.data) {
      throw new SMAError('Post not found', 'POST_NOT_FOUND');
    }

    return response.data;
  }

  /**
   * Create a new post
   */
  async createPost(postData: CreatePostRequest): Promise<Post> {
    const response = await this.makeRequest<Post>({
      method: 'POST',
      url: '/posts',
      data: postData
    });

    if (!response.success || !response.data) {
      throw new SMAError('Failed to create post', 'POST_CREATION_FAILED');
    }

    return response.data;
  }

  /**
   * Update an existing post
   */
  async updatePost(postId: string, postData: Partial<CreatePostRequest>): Promise<Post> {
    const response = await this.makeRequest<Post>({
      method: 'PUT',
      url: `/posts/${postId}`,
      data: postData
    });

    if (!response.success || !response.data) {
      throw new SMAError('Failed to update post', 'POST_UPDATE_FAILED');
    }

    return response.data;
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string): Promise<void> {
    const response = await this.makeRequest({
      method: 'DELETE',
      url: `/posts/${postId}`
    });

    if (!response.success) {
      throw new SMAError('Failed to delete post', 'POST_DELETION_FAILED');
    }
  }

  /**
   * Publish a post immediately
   */
  async publishPost(postId: string): Promise<{ results: PlatformPost[] }> {
    const response = await this.makeRequest<{ results: PlatformPost[] }>({
      method: 'POST',
      url: `/posts/${postId}/publish`
    });

    if (!response.success || !response.data) {
      throw new SMAError('Failed to publish post', 'POST_PUBLISH_FAILED');
    }

    return response.data;
  }

  /**
   * Create multiple posts in bulk
   */
  async createBulkPosts(posts: CreatePostRequest[]): Promise<{ scheduledPosts: Post[]; errors: any[] }> {
    const response = await this.makeRequest<{ scheduledPosts: Post[]; errors: any[] }>({
      method: 'POST',
      url: '/posts/bulk',
      data: { posts }
    });

    if (!response.success || !response.data) {
      throw new SMAError('Failed to create bulk posts', 'BULK_POST_CREATION_FAILED');
    }

    return response.data;
  }

  // Analytics methods
  /**
   * Get post analytics
   */
  async getAnalytics(filters: AnalyticsFilters = {}): Promise<Analytics> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await this.makeRequest<Analytics>({
      method: 'GET',
      url: `/posts/analytics?${params.toString()}`
    });

    if (!response.success || !response.data) {
      throw new SMAError('Failed to get analytics', 'ANALYTICS_FETCH_FAILED');
    }

    return response.data;
  }

  // Platform connection methods
  /**
   * Connect to a social media platform
   */
  async connectPlatform(platform: Platform, authCode: string, redirectUri: string): Promise<PlatformConnection> {
    const response = await this.makeRequest<{ platformConnection: PlatformConnection }>({
      method: 'POST',
      url: `/oauth/connect/${platform}`,
      data: { code: authCode, redirectUri }
    });

    if (!response.success || !response.data) {
      throw new SMAError('Failed to connect platform', 'PLATFORM_CONNECTION_FAILED');
    }

    return response.data.platformConnection;
  }

  /**
   * Disconnect from a social media platform
   */
  async disconnectPlatform(platform: Platform): Promise<void> {
    const response = await this.makeRequest({
      method: 'DELETE',
      url: `/oauth/disconnect/${platform}`
    });

    if (!response.success) {
      throw new SMAError('Failed to disconnect platform', 'PLATFORM_DISCONNECTION_FAILED');
    }
  }

  // Utility methods
  /**
   * Check API health
   */
  async checkHealth(): Promise<{ status: string; timestamp: string; services: Record<string, string> }> {
    const response = await this.makeRequest<{ status: string; timestamp: string; services: Record<string, string> }>({
      method: 'GET',
      url: '/health'
    });

    if (!response.success || !response.data) {
      throw new SMAError('Health check failed', 'HEALTH_CHECK_FAILED');
    }

    return response.data;
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User> {
    const response = await this.makeRequest<User>({
      method: 'GET',
      url: '/auth/me'
    });

    if (!response.success || !response.data) {
      throw new SMAError('Failed to get user info', 'USER_INFO_FAILED');
    }

    return response.data;
  }
}

// Export default instance creator
export function createSMAClient(config?: SMAConfig): SocialMediaAutomationSDK {
  return new SocialMediaAutomationSDK(config);
}

// Export everything
export default SocialMediaAutomationSDK;