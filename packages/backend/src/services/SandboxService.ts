/**
 * Sandbox Service for Developer Testing
 * 
 * Provides a safe testing environment with mock data and simulated API responses
 * for developers to test their integrations without affecting production data.
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ResponseUtils } from '../utils/responseUtils';
import { loggerService } from './LoggerService';

export interface SandboxUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  isSandbox: true;
}

export interface SandboxPost {
  id: string;
  content: string;
  images?: string[];
  hashtags?: string[];
  platforms: string[];
  scheduledTime?: string;
  status: string;
  source: string;
  platformPosts?: any[];
  createdAt: string;
  updatedAt: string;
  isSandbox: true;
}

export interface SandboxPlatformConnection {
  id: string;
  platform: string;
  platformUserId: string;
  platformUsername: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isSandbox: true;
}

export class SandboxService {
  private static instance: SandboxService;
  private sandboxUsers: Map<string, SandboxUser> = new Map();
  private sandboxPosts: Map<string, SandboxPost> = new Map();
  private sandboxConnections: Map<string, SandboxPlatformConnection> = new Map();
  private sandboxTokens: Map<string, string> = new Map(); // token -> userId

  private constructor() {
    this.initializeSandboxData();
  }

  public static getInstance(): SandboxService {
    if (!SandboxService.instance) {
      SandboxService.instance = new SandboxService();
    }
    return SandboxService.instance;
  }

  /**
   * Initialize sandbox with test data
   */
  private initializeSandboxData(): void {
    // Create test users
    const testUsers = [
      {
        email: 'developer@example.com',
        name: 'Test Developer',
        password: 'sandbox123'
      },
      {
        email: 'demo@sma-platform.com',
        name: 'Demo User',
        password: 'demo123'
      },
      {
        email: 'integration@test.com',
        name: 'Integration Tester',
        password: 'test123'
      }
    ];

    testUsers.forEach(userData => {
      const user: SandboxUser = {
        id: uuidv4(),
        email: userData.email,
        name: userData.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSandbox: true
      };

      this.sandboxUsers.set(user.id, user);

      // Create test token for each user
      const token = `sandbox_${Buffer.from(user.id).toString('base64')}`;
      this.sandboxTokens.set(token, user.id);

      // Create test platform connections
      const platforms = ['facebook', 'instagram', 'pinterest', 'x'];
      platforms.forEach(platform => {
        const connection: SandboxPlatformConnection = {
          id: uuidv4(),
          platform,
          platformUserId: `${platform}_${user.id.slice(0, 8)}`,
          platformUsername: `${user.name.toLowerCase().replace(' ', '_')}_${platform}`,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isSandbox: true
        };

        this.sandboxConnections.set(`${user.id}_${platform}`, connection);
      });

      // Create test posts
      const testPosts = [
        {
          content: 'Welcome to the Social Media Automation Platform! 🚀',
          platforms: ['facebook', 'instagram'],
          hashtags: ['#welcome', '#automation', '#socialmedia'],
          status: 'published'
        },
        {
          content: 'Testing scheduled posts with the sandbox environment',
          platforms: ['facebook'],
          hashtags: ['#test', '#sandbox'],
          status: 'scheduled',
          scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        {
          content: 'Draft post for testing purposes',
          platforms: ['instagram', 'pinterest'],
          hashtags: ['#draft', '#testing'],
          status: 'draft'
        },
        {
          content: 'Failed post example for error handling testing',
          platforms: ['x'],
          hashtags: ['#failed', '#error'],
          status: 'failed'
        }
      ];

      testPosts.forEach(postData => {
        const post: SandboxPost = {
          id: uuidv4(),
          content: postData.content,
          hashtags: postData.hashtags,
          platforms: postData.platforms,
          scheduledTime: postData.scheduledTime,
          status: postData.status,
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isSandbox: true,
          platformPosts: postData.platforms.map(platform => ({
            platform,
            platformPostId: postData.status === 'published' ? `${platform}_${uuidv4().slice(0, 8)}` : null,
            content: postData.content,
            status: postData.status,
            publishedAt: postData.status === 'published' ? new Date().toISOString() : null,
            error: postData.status === 'failed' ? 'Platform API rate limit exceeded' : null
          }))
        };

        this.sandboxPosts.set(post.id, post);
      });
    });

    loggerService.info('Sandbox environment initialized with test data', {
      users: this.sandboxUsers.size,
      posts: this.sandboxPosts.size,
      connections: this.sandboxConnections.size
    });
  }

  /**
   * Check if request is for sandbox environment
   */
  public isSandboxRequest(req: Request): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;

    const token = authHeader.replace('Bearer ', '');
    return token.startsWith('sandbox_') || this.sandboxTokens.has(token);
  }

  /**
   * Get sandbox user from token
   */
  public getSandboxUser(token: string): SandboxUser | null {
    const userId = this.sandboxTokens.get(token);
    if (!userId) return null;

    return this.sandboxUsers.get(userId) || null;
  }

  /**
   * Sandbox login
   */
  public sandboxLogin(email: string, password: string): { user: SandboxUser; token: string } | null {
    const user = Array.from(this.sandboxUsers.values()).find(u => u.email === email);
    if (!user) return null;

    // In sandbox, accept any password for demo purposes
    const token = Array.from(this.sandboxTokens.entries()).find(([, userId]) => userId === user.id)?.[0];
    if (!token) return null;

    return { user, token };
  }

  /**
   * Get sandbox posts for user
   */
  public getSandboxPosts(userId: string, filters: any = {}): { posts: SandboxPost[]; totalCount: number } {
    let posts = Array.from(this.sandboxPosts.values());

    // Apply filters
    if (filters.status) {
      posts = posts.filter(p => p.status === filters.status);
    }
    if (filters.platform) {
      posts = posts.filter(p => p.platforms.includes(filters.platform));
    }

    // Sort
    const sortField = filters.sort || 'createdAt';
    const sortOrder = filters.order || 'desc';
    posts.sort((a, b) => {
      const aValue = (a as any)[sortField];
      const bValue = (b as any)[sortField];
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const startIndex = (page - 1) * limit;
    const paginatedPosts = posts.slice(startIndex, startIndex + limit);

    return {
      posts: paginatedPosts,
      totalCount: posts.length
    };
  }

  /**
   * Get sandbox post by ID
   */
  public getSandboxPost(postId: string): SandboxPost | null {
    return this.sandboxPosts.get(postId) || null;
  }

  /**
   * Create sandbox post
   */
  public createSandboxPost(userId: string, postData: any): SandboxPost {
    const post: SandboxPost = {
      id: uuidv4(),
      content: postData.content,
      images: postData.images,
      hashtags: postData.hashtags,
      platforms: postData.platforms,
      scheduledTime: postData.scheduledTime,
      status: postData.scheduledTime ? 'scheduled' : 'draft',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSandbox: true,
      platformPosts: postData.platforms.map((platform: string) => ({
        platform,
        platformPostId: null,
        content: postData.content,
        status: 'draft',
        publishedAt: null,
        error: null
      }))
    };

    this.sandboxPosts.set(post.id, post);
    return post;
  }

  /**
   * Update sandbox post
   */
  public updateSandboxPost(postId: string, updateData: any): SandboxPost | null {
    const post = this.sandboxPosts.get(postId);
    if (!post) return null;

    const updatedPost = {
      ...post,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.sandboxPosts.set(postId, updatedPost);
    return updatedPost;
  }

  /**
   * Delete sandbox post
   */
  public deleteSandboxPost(postId: string): boolean {
    return this.sandboxPosts.delete(postId);
  }

  /**
   * Simulate post publishing
   */
  public simulatePostPublish(postId: string): { results: any[] } {
    const post = this.sandboxPosts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Simulate publishing to each platform
    const results = post.platforms.map(platform => {
      // Simulate random success/failure for demo purposes
      const success = Math.random() > 0.1; // 90% success rate

      if (success) {
        return {
          platform,
          success: true,
          platformPostId: `${platform}_${uuidv4().slice(0, 8)}`,
          error: null,
          retryable: false
        };
      } else {
        return {
          platform,
          success: false,
          platformPostId: null,
          error: 'Simulated platform API error for testing',
          retryable: true
        };
      }
    });

    // Update post status
    const allSuccessful = results.every(r => r.success);
    post.status = allSuccessful ? 'published' : 'failed';
    post.updatedAt = new Date().toISOString();

    // Update platform posts
    post.platformPosts = results.map(result => ({
      platform: result.platform,
      platformPostId: result.platformPostId,
      content: post.content,
      status: result.success ? 'published' : 'failed',
      publishedAt: result.success ? new Date().toISOString() : null,
      error: result.error
    }));

    this.sandboxPosts.set(postId, post);

    return { results };
  }

  /**
   * Get sandbox analytics
   */
  public getSandboxAnalytics(userId: string, filters: any = {}): any {
    const posts = Array.from(this.sandboxPosts.values());

    const totalPosts = posts.length;
    const publishedPosts = posts.filter(p => p.status === 'published').length;
    const failedPosts = posts.filter(p => p.status === 'failed').length;
    const scheduledPosts = posts.filter(p => p.status === 'scheduled').length;

    const platformBreakdown = posts.reduce((acc, post) => {
      post.platforms.forEach(platform => {
        acc[platform] = (acc[platform] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPosts,
      publishedPosts,
      failedPosts,
      scheduledPosts,
      platformBreakdown,
      successRate: totalPosts > 0 ? (publishedPosts / totalPosts) * 100 : 0,
      averagePostsPerDay: 2.5 // Mock value
    };
  }

  /**
   * Get sandbox platform connections
   */
  public getSandboxConnections(userId: string): SandboxPlatformConnection[] {
    return Array.from(this.sandboxConnections.values()).filter(
      conn => conn.id.startsWith(userId) || conn.platformUserId.includes(userId.slice(0, 8))
    );
  }

  /**
   * Reset sandbox data
   */
  public resetSandboxData(): void {
    this.sandboxUsers.clear();
    this.sandboxPosts.clear();
    this.sandboxConnections.clear();
    this.sandboxTokens.clear();
    this.initializeSandboxData();

    loggerService.info('Sandbox data reset');
  }

  /**
   * Get sandbox statistics
   */
  public getSandboxStats(): any {
    return {
      users: this.sandboxUsers.size,
      posts: this.sandboxPosts.size,
      connections: this.sandboxConnections.size,
      tokens: this.sandboxTokens.size,
      lastReset: new Date().toISOString()
    };
  }
}

// Middleware to handle sandbox requests
export const sandboxMiddleware = (req: Request, res: Response, next: any) => {
  const sandboxService = SandboxService.getInstance();
  
  // Check if this is a sandbox request
  if (sandboxService.isSandboxRequest(req)) {
    req.isSandbox = true;
    req.sandboxService = sandboxService;

    // Add sandbox headers
    res.setHeader('X-Sandbox-Mode', 'true');
    res.setHeader('X-Sandbox-Warning', 'This is a sandbox environment for testing purposes only');
  }

  next();
};

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      isSandbox?: boolean;
      sandboxService?: SandboxService;
    }
  }
}