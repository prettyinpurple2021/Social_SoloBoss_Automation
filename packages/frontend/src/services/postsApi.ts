import { Post, PostData, PostStatus } from '@sma/shared/types/post';
import { Platform } from '@sma/shared/types/platform';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  posts?: T;
  error?: string;
  message?: string;
}

interface PostsQuery {
  status?: PostStatus;
  platform?: Platform;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

class PostsApi {
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

  async getPosts(query: PostsQuery = {}): Promise<ApiResponse<Post[]>> {
    const searchParams = new URLSearchParams();
    
    if (query.status) searchParams.append('status', query.status);
    if (query.platform) searchParams.append('platform', query.platform);
    if (query.limit) searchParams.append('limit', query.limit.toString());
    if (query.offset) searchParams.append('offset', query.offset.toString());
    if (query.startDate) searchParams.append('startDate', query.startDate.toISOString());
    if (query.endDate) searchParams.append('endDate', query.endDate.toISOString());

    const queryString = searchParams.toString();
    const endpoint = `/posts${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<Post[]>(endpoint);
  }

  async getPost(postId: string): Promise<ApiResponse<Post>> {
    return this.makeRequest<Post>(`/posts/${postId}`);
  }

  async createPost(postData: PostData): Promise<ApiResponse<Post>> {
    return this.makeRequest<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }

  async updatePost(postId: string, updates: Partial<PostData>): Promise<ApiResponse<Post>> {
    return this.makeRequest<Post>(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deletePost(postId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/posts/${postId}`, {
      method: 'DELETE'
    });
  }

  async publishPost(postId: string): Promise<ApiResponse<Post>> {
    return this.makeRequest<Post>(`/posts/${postId}/publish`, {
      method: 'POST'
    });
  }

  async schedulePost(postId: string, scheduledTime: Date): Promise<ApiResponse<Post>> {
    return this.makeRequest<Post>(`/posts/${postId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledTime: scheduledTime.toISOString() })
    });
  }

  async retryFailedPost(postId: string, platform?: Platform): Promise<ApiResponse<Post>> {
    const body = platform ? JSON.stringify({ platform }) : undefined;
    
    return this.makeRequest<Post>(`/posts/${postId}/retry`, {
      method: 'POST',
      body
    });
  }

  async getScheduledPosts(): Promise<ApiResponse<Post[]>> {
    return this.getPosts({ status: PostStatus.SCHEDULED });
  }

  async getDraftPosts(): Promise<ApiResponse<Post[]>> {
    return this.getPosts({ status: PostStatus.DRAFT });
  }

  async getPublishedPosts(limit = 50): Promise<ApiResponse<Post[]>> {
    return this.getPosts({ status: PostStatus.PUBLISHED, limit });
  }

  async getFailedPosts(): Promise<ApiResponse<Post[]>> {
    return this.getPosts({ status: PostStatus.FAILED });
  }
}

export const postsApi = new PostsApi();