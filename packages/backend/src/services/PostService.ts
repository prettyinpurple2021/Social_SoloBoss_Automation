import { PostModel } from '../models/Post';
import { PlatformPostModel } from '../models/PlatformPost';
import { 
  PostRow, 
  CreatePostInput, 
  UpdatePostInput,
  PostStatus,
  PostSource,
  Platform,
  PlatformPostRow,
  CreatePlatformPostInput
} from '../types/database';

export interface PostData {
  content: string;
  images?: string[];
  hashtags?: string[];
  platforms: Platform[];
  scheduledTime?: Date;
  source?: PostSource;
}

export interface PostWithPlatformPosts extends PostRow {
  platformPosts: PlatformPostRow[];
}

export class PostService {
  /**
   * Create a new post with validation and sanitization
   */
  static async createPost(userId: string, postData: PostData): Promise<PostWithPlatformPosts> {
    // Validate input
    this.validatePostData(postData);
    
    // Sanitize content
    const sanitizedContent = this.sanitizeContent(postData.content);
    const sanitizedHashtags = postData.hashtags?.map(tag => this.sanitizeHashtag(tag)) || [];
    
    // Determine initial status
    const status = postData.scheduledTime ? PostStatus.SCHEDULED : PostStatus.DRAFT;
    
    const createInput: CreatePostInput = {
      user_id: userId,
      content: sanitizedContent,
      images: postData.images || [],
      hashtags: sanitizedHashtags,
      platforms: postData.platforms,
      scheduled_time: postData.scheduledTime,
      status,
      source: postData.source || PostSource.MANUAL
    };

    // Create the main post
    const post = await PostModel.create(createInput);
    
    // Create platform-specific posts
    const platformPosts: PlatformPostRow[] = [];
    for (const platform of postData.platforms) {
      const platformContent = this.formatContentForPlatform(sanitizedContent, platform, sanitizedHashtags);
      
      const platformPostInput: CreatePlatformPostInput = {
        post_id: post.id,
        platform,
        content: platformContent,
        status
      };
      
      const platformPost = await PlatformPostModel.create(platformPostInput);
      platformPosts.push(platformPost);
    }

    // Schedule post if it has a scheduled time
    if (postData.scheduledTime && status === PostStatus.SCHEDULED) {
      try {
        // Import here to avoid circular dependency
        const { schedulerService } = await import('./SchedulerService');
        await schedulerService.schedulePost(post.id, userId, postData.scheduledTime);
      } catch (error) {
        console.error('Error scheduling post:', error);
        // Don't fail the post creation, just log the error
      }
    }

    return {
      ...post,
      platformPosts
    };
  }

  /**
   * Get a post by ID with authorization check
   */
  static async getPost(postId: string, userId: string): Promise<PostWithPlatformPosts | null> {
    const post = await PostModel.findById(postId);
    
    if (!post || post.user_id !== userId) {
      return null;
    }

    const platformPosts = await PlatformPostModel.findByPostId(postId);
    
    return {
      ...post,
      platformPosts
    };
  }

  /**
   * Get posts for a user with pagination
   */
  static async getUserPosts(
    userId: string, 
    limit: number = 50, 
    offset: number = 0,
    status?: PostStatus
  ): Promise<PostWithPlatformPosts[]> {
    let posts: PostRow[];
    
    if (status) {
      posts = await PostModel.findByUserAndStatus(userId, status);
    } else {
      posts = await PostModel.findByUserId(userId, limit, offset);
    }

    const postsWithPlatforms: PostWithPlatformPosts[] = [];
    
    for (const post of posts) {
      const platformPosts = await PlatformPostModel.findByPostId(post.id);
      postsWithPlatforms.push({
        ...post,
        platformPosts
      });
    }

    return postsWithPlatforms;
  }

  /**
   * Get posts by user, source, and status
   */
  static async getPostsByUserAndSource(
    userId: string, 
    source: PostSource, 
    status?: PostStatus
  ): Promise<PostWithPlatformPosts[]> {
    const posts = await PostModel.findByUserSourceAndStatus(userId, source, status);
    
    const postsWithPlatforms: PostWithPlatformPosts[] = [];
    
    for (const post of posts) {
      const platformPosts = await PlatformPostModel.findByPostId(post.id);
      postsWithPlatforms.push({
        ...post,
        platformPosts
      });
    }

    return postsWithPlatforms;
  }

  /**
   * Update a post with validation and authorization
   */
  static async updatePost(
    postId: string, 
    userId: string, 
    updateData: Partial<PostData>
  ): Promise<PostWithPlatformPosts | null> {
    // Check authorization
    const existingPost = await PostModel.findById(postId);
    if (!existingPost || existingPost.user_id !== userId) {
      return null;
    }

    // Validate update data
    if (updateData.content !== undefined || updateData.hashtags !== undefined || updateData.platforms !== undefined) {
      this.validatePostData({
        content: updateData.content || existingPost.content,
        platforms: updateData.platforms || existingPost.platforms,
        hashtags: updateData.hashtags || existingPost.hashtags
      });
    }

    // Prepare update input
    const updateInput: UpdatePostInput = {};
    
    if (updateData.content !== undefined) {
      updateInput.content = this.sanitizeContent(updateData.content);
    }
    
    if (updateData.images !== undefined) {
      updateInput.images = updateData.images;
    }
    
    if (updateData.hashtags !== undefined) {
      updateInput.hashtags = updateData.hashtags.map(tag => this.sanitizeHashtag(tag));
    }
    
    if (updateData.platforms !== undefined) {
      updateInput.platforms = updateData.platforms;
    }
    
    if (updateData.scheduledTime !== undefined) {
      updateInput.scheduled_time = updateData.scheduledTime;
      // Update status based on scheduling
      if (updateData.scheduledTime && existingPost.status === PostStatus.DRAFT) {
        updateInput.status = PostStatus.SCHEDULED;
      } else if (!updateData.scheduledTime && existingPost.status === PostStatus.SCHEDULED) {
        updateInput.status = PostStatus.DRAFT;
      }
    }

    // Update the main post
    const updatedPost = await PostModel.update(postId, updateInput);
    if (!updatedPost) {
      return null;
    }

    // Handle scheduling changes
    if (updateData.scheduledTime !== undefined) {
      try {
        // Import here to avoid circular dependency
        const { schedulerService } = await import('./SchedulerService');
        
        if (updateData.scheduledTime && updatedPost.status === PostStatus.SCHEDULED) {
          // Schedule or reschedule the post
          await schedulerService.schedulePost(postId, userId, updateData.scheduledTime);
        } else if (!updateData.scheduledTime) {
          // Cancel scheduling if scheduled time was removed
          await schedulerService.cancelScheduledPost(postId, userId);
        }
      } catch (error) {
        console.error('Error updating post schedule:', error);
        // Don't fail the update, just log the error
      }
    }

    // Update platform posts if platforms or content changed
    if (updateData.platforms !== undefined || updateData.content !== undefined || updateData.hashtags !== undefined) {
      // Remove old platform posts
      await PlatformPostModel.deleteByPostId(postId);
      
      // Create new platform posts
      const platformPosts: PlatformPostRow[] = [];
      const finalContent = updateInput.content || existingPost.content;
      const finalHashtags = updateInput.hashtags || existingPost.hashtags;
      const finalPlatforms = updateInput.platforms || existingPost.platforms;
      
      for (const platform of finalPlatforms) {
        const platformContent = this.formatContentForPlatform(finalContent, platform, finalHashtags);
        
        const platformPostInput: CreatePlatformPostInput = {
          post_id: postId,
          platform,
          content: platformContent,
          status: updatedPost.status
        };
        
        const platformPost = await PlatformPostModel.create(platformPostInput);
        platformPosts.push(platformPost);
      }

      return {
        ...updatedPost,
        platformPosts
      };
    }

    // Get existing platform posts
    const platformPosts = await PlatformPostModel.findByPostId(postId);
    
    return {
      ...updatedPost,
      platformPosts
    };
  }

  /**
   * Delete a post with authorization check
   */
  static async deletePost(postId: string, userId: string): Promise<boolean> {
    // Check authorization
    const existingPost = await PostModel.findById(postId);
    if (!existingPost || existingPost.user_id !== userId) {
      return false;
    }

    // Cancel any scheduled execution
    try {
      const { schedulerService } = await import('./SchedulerService');
      await schedulerService.cancelScheduledPost(postId, userId);
    } catch (error) {
      console.error('Error canceling scheduled post during deletion:', error);
      // Continue with deletion even if cancellation fails
    }

    // Delete platform posts first (cascade should handle this, but being explicit)
    await PlatformPostModel.deleteByPostId(postId);
    
    // Delete the main post
    return await PostModel.delete(postId);
  }

  /**
   * Update post status
   */
  static async updatePostStatus(postId: string, userId: string, status: PostStatus): Promise<PostWithPlatformPosts | null> {
    // Check authorization
    const existingPost = await PostModel.findById(postId);
    if (!existingPost || existingPost.user_id !== userId) {
      return null;
    }

    // Update main post status
    const updatedPost = await PostModel.updateStatus(postId, status);
    if (!updatedPost) {
      return null;
    }

    // Update platform post statuses
    const platformPosts = await PlatformPostModel.findByPostId(postId);
    const updatedPlatformPosts: PlatformPostRow[] = [];
    
    for (const platformPost of platformPosts) {
      const updated = await PlatformPostModel.updateStatus(platformPost.id, status);
      if (updated) {
        updatedPlatformPosts.push(updated);
      }
    }

    return {
      ...updatedPost,
      platformPosts: updatedPlatformPosts
    };
  }

  /**
   * Get scheduled posts that are ready to be published
   */
  static async getScheduledPostsForExecution(beforeTime?: Date): Promise<PostWithPlatformPosts[]> {
    const posts = await PostModel.findScheduledPosts(beforeTime || new Date());
    
    const postsWithPlatforms: PostWithPlatformPosts[] = [];
    
    for (const post of posts) {
      const platformPosts = await PlatformPostModel.findByPostId(post.id);
      postsWithPlatforms.push({
        ...post,
        platformPosts
      });
    }

    return postsWithPlatforms;
  }

  /**
   * Get user post statistics
   */
  static async getUserPostStats(userId: string) {
    return await PostModel.getPostStats(userId);
  }

  /**
   * Validate post data
   */
  private static validatePostData(postData: Partial<PostData>): void {
    if (postData.content !== undefined) {
      if (!postData.content || postData.content.trim().length === 0) {
        throw new Error('Post content cannot be empty');
      }
      
      if (postData.content.length > 10000) {
        throw new Error('Post content cannot exceed 10,000 characters');
      }
    }

    if (postData.platforms !== undefined) {
      if (!postData.platforms || postData.platforms.length === 0) {
        throw new Error('At least one platform must be selected');
      }
      
      const validPlatforms = Object.values(Platform);
      for (const platform of postData.platforms) {
        if (!validPlatforms.includes(platform)) {
          throw new Error(`Invalid platform: ${platform}`);
        }
      }
    }

    if (postData.hashtags !== undefined && postData.hashtags.length > 30) {
      throw new Error('Cannot have more than 30 hashtags');
    }

    if (postData.images !== undefined && postData.images.length > 10) {
      throw new Error('Cannot have more than 10 images');
    }
  }

  /**
   * Sanitize post content
   */
  private static sanitizeContent(content: string): string {
    // Remove potentially harmful HTML/script tags
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * Sanitize hashtag
   */
  private static sanitizeHashtag(hashtag: string): string {
    // Remove # if present and sanitize
    const cleaned = hashtag.replace(/^#/, '').replace(/[^a-zA-Z0-9_]/g, '').trim();
    return cleaned.length > 0 ? cleaned : '';
  }

  /**
   * Format content for specific platform
   */
  private static formatContentForPlatform(content: string, platform: Platform, hashtags: string[]): string {
    let formattedContent = content;
    const hashtagString = hashtags.filter(tag => tag.length > 0).map(tag => `#${tag}`).join(' ');

    switch (platform) {
      case Platform.X:
        // Twitter has character limits
        const maxLength = 280;
        const availableLength = maxLength - (hashtagString.length > 0 ? hashtagString.length + 1 : 0);
        
        if (formattedContent.length > availableLength) {
          formattedContent = formattedContent.substring(0, availableLength - 3) + '...';
        }
        break;
        
      case Platform.INSTAGRAM:
        // Instagram works well with hashtags at the end
        break;
        
      case Platform.FACEBOOK:
        // Facebook can handle longer content
        break;
        
      case Platform.PINTEREST:
        // Pinterest focuses on visual content with descriptions
        break;
    }

    // Add hashtags if present
    if (hashtagString.length > 0) {
      formattedContent += '\n\n' + hashtagString;
    }

    return formattedContent;
  }
}