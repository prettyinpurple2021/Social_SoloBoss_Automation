import { PostService } from '../services/PostService';
import { PostModel } from '../models/Post';
import { PlatformPostModel } from '../models/PlatformPost';
import { PostStatus, PostSource, Platform } from '../types/database';

// Simple integration test to verify the post management system works
describe('Post Management Integration', () => {
  it('should demonstrate core post management functionality', async () => {
    // Mock the models to simulate database operations
    const mockPost = {
      id: 'test-post-id',
      user_id: 'test-user-id',
      content: 'Test post content',
      images: [],
      hashtags: ['test'],
      platforms: [Platform.FACEBOOK],
      scheduled_time: undefined,
      status: PostStatus.DRAFT,
      source: PostSource.MANUAL,
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockPlatformPost = {
      id: 'platform-post-id',
      post_id: 'test-post-id',
      platform: Platform.FACEBOOK,
      platform_post_id: undefined,
      content: 'Test post content\n\n#test',
      status: PostStatus.DRAFT,
      published_at: undefined,
      error: undefined,
      retry_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Mock the database calls
    jest.spyOn(PostModel, 'create').mockResolvedValue(mockPost);
    jest.spyOn(PlatformPostModel, 'create').mockResolvedValue(mockPlatformPost);
    jest.spyOn(PostModel, 'findById').mockResolvedValue(mockPost);
    jest.spyOn(PlatformPostModel, 'findByPostId').mockResolvedValue([mockPlatformPost]);

    // Test creating a post
    const postData = {
      content: 'Test post content',
      hashtags: ['test'],
      platforms: [Platform.FACEBOOK]
    };

    const createdPost = await PostService.createPost('test-user-id', postData);

    expect(createdPost).toBeDefined();
    expect(createdPost.content).toBe('Test post content');
    expect(createdPost.platforms).toContain(Platform.FACEBOOK);
    expect(createdPost.platformPosts).toHaveLength(1);
    expect(createdPost.platformPosts[0].content).toContain('#test');

    // Test retrieving a post
    const retrievedPost = await PostService.getPost('test-post-id', 'test-user-id');

    expect(retrievedPost).toBeDefined();
    expect(retrievedPost?.id).toBe('test-post-id');
    expect(retrievedPost?.platformPosts).toHaveLength(1);

    console.log('✅ Post management system integration test passed');
  });

  it('should validate post data correctly', async () => {
    // Test validation errors
    const invalidPostData = {
      content: '', // Empty content should fail
      platforms: [Platform.FACEBOOK]
    };

    await expect(PostService.createPost('test-user-id', invalidPostData))
      .rejects.toThrow('Post content cannot be empty');

    const tooManyHashtags = {
      content: 'Test content',
      platforms: [Platform.FACEBOOK],
      hashtags: Array(31).fill('tag') // Too many hashtags
    };

    await expect(PostService.createPost('test-user-id', tooManyHashtags))
      .rejects.toThrow('Cannot have more than 30 hashtags');

    console.log('✅ Post validation test passed');
  });

  it('should format content for different platforms', async () => {
    const mockPost = {
      id: 'test-post-id',
      user_id: 'test-user-id',
      content: 'A'.repeat(300), // Long content
      images: [],
      hashtags: ['test'],
      platforms: [Platform.X], // Twitter has character limits
      scheduled_time: undefined,
      status: PostStatus.DRAFT,
      source: PostSource.MANUAL,
      created_at: new Date(),
      updated_at: new Date()
    };

    let capturedContent = '';
    jest.spyOn(PostModel, 'create').mockResolvedValue(mockPost);
    jest.spyOn(PlatformPostModel, 'create').mockImplementation((input) => {
      capturedContent = input.content;
      return Promise.resolve({
        id: 'platform-post-id',
        post_id: 'test-post-id',
        platform: Platform.X,
        platform_post_id: undefined,
        content: input.content,
        status: PostStatus.DRAFT,
        published_at: undefined,
        error: undefined,
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
    });

    const postData = {
      content: 'A'.repeat(300),
      hashtags: ['test'],
      platforms: [Platform.X]
    };

    await PostService.createPost('test-user-id', postData);

    // Should be truncated for Twitter
    expect(capturedContent.length).toBeLessThanOrEqual(280);
    expect(capturedContent).toContain('...');
    expect(capturedContent).toContain('#test');

    console.log('✅ Platform-specific formatting test passed');
  });
});