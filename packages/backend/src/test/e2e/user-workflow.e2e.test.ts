import request from 'supertest';
import { app } from '../../index';
import { DatabaseConnection } from '../../database/connection';
import { RedisConnection } from '../../database/redis';

describe('End-to-End User Workflows', () => {
  let authToken: string;
  let userId: string;
  let postId: string;

  beforeAll(async () => {
    // Initialize test database
    const db = DatabaseConnection.getInstance();
    const redis = RedisConnection.getInstance();
    await redis.connect();
  });

  afterAll(async () => {
    // Clean up test data
    const db = DatabaseConnection.getInstance();
    const redis = RedisConnection.getInstance();
    await db.close();
    await redis.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    const db = DatabaseConnection.getInstance();
    await db.query('DELETE FROM platform_posts');
    await db.query('DELETE FROM posts');
    await db.query('DELETE FROM platform_connections');
    await db.query("DELETE FROM users WHERE email LIKE '%test%'");
  });

  describe('Complete User Journey: Registration to Post Publishing', () => {
    it('should complete full user workflow from registration to post publishing', async () => {
      // Step 1: User Registration
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
          name: 'Test User'
        })
        .expect(201);

      expect(registrationResponse.body).toHaveProperty('token');
      expect(registrationResponse.body.user).toHaveProperty('id');
      
      authToken = registrationResponse.body.token;
      userId = registrationResponse.body.user.id;

      // Step 2: User Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!'
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('token');
      authToken = loginResponse.body.token;

      // Step 3: Connect Social Media Platform (Mock OAuth)
      const oauthResponse = await request(app)
        .post('/api/oauth/connect/facebook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'mock_oauth_code',
          redirectUri: 'http://localhost:3000/oauth/callback'
        })
        .expect(200);

      expect(oauthResponse.body).toHaveProperty('success', true);
      expect(oauthResponse.body).toHaveProperty('platformConnection');

      // Step 4: Create a Post
      const createPostResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test post for end-to-end testing',
          platforms: ['facebook'],
          hashtags: ['#test', '#e2e'],
          scheduledTime: new Date(Date.now() + 60000).toISOString() // 1 minute from now
        })
        .expect(201);

      expect(createPostResponse.body).toHaveProperty('id');
      expect(createPostResponse.body.content).toBe('This is a test post for end-to-end testing');
      expect(createPostResponse.body.status).toBe('scheduled');
      
      postId = createPostResponse.body.id;

      // Step 5: View Dashboard (Get All Posts)
      const dashboardResponse = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(dashboardResponse.body).toHaveProperty('posts');
      expect(dashboardResponse.body.posts).toHaveLength(1);
      expect(dashboardResponse.body.posts[0].id).toBe(postId);

      // Step 6: Edit the Post
      const editPostResponse = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is an updated test post for end-to-end testing',
          hashtags: ['#test', '#e2e', '#updated']
        })
        .expect(200);

      expect(editPostResponse.body.content).toBe('This is an updated test post for end-to-end testing');
      expect(editPostResponse.body.hashtags).toContain('#updated');

      // Step 7: Manually Publish Post (Skip Scheduler)
      const publishResponse = await request(app)
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(publishResponse.body).toHaveProperty('success', true);
      expect(publishResponse.body).toHaveProperty('results');

      // Step 8: Verify Post Status
      const postStatusResponse = await request(app)
        .get(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(postStatusResponse.body.status).toBe('published');
      expect(postStatusResponse.body.platformPosts).toHaveLength(1);
      expect(postStatusResponse.body.platformPosts[0].platform).toBe('facebook');

      // Step 9: View Analytics/History
      const analyticsResponse = await request(app)
        .get('/api/posts/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body).toHaveProperty('totalPosts', 1);
      expect(analyticsResponse.body).toHaveProperty('publishedPosts', 1);
      expect(analyticsResponse.body).toHaveProperty('platformBreakdown');

      // Step 10: Disconnect Platform
      const disconnectResponse = await request(app)
        .delete('/api/oauth/disconnect/facebook')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(disconnectResponse.body).toHaveProperty('success', true);

      // Step 11: User Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(logoutResponse.body).toHaveProperty('success', true);
    });

    it('should handle blogger integration workflow', async () => {
      // Setup user and auth
      const user = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'blogger-test@example.com',
          password: 'SecurePassword123!',
          name: 'Blogger Test User'
        })
        .expect(201);

      authToken = user.body.token;

      // Connect social media platform
      await request(app)
        .post('/api/oauth/connect/facebook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'mock_oauth_code',
          redirectUri: 'http://localhost:3000/oauth/callback'
        })
        .expect(200);

      // Configure Blogger integration
      const bloggerConfigResponse = await request(app)
        .post('/api/blogger/configure')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          blogUrl: 'https://test-blog.blogspot.com',
          autoApprove: false
        })
        .expect(200);

      expect(bloggerConfigResponse.body).toHaveProperty('success', true);

      // Simulate new blog post detection
      const newBlogPostResponse = await request(app)
        .post('/api/blogger/webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New Blog Post Title',
          content: 'This is the content of the new blog post...',
          url: 'https://test-blog.blogspot.com/2024/01/new-post',
          publishedAt: new Date().toISOString()
        })
        .expect(200);

      expect(newBlogPostResponse.body).toHaveProperty('generatedPosts');
      expect(newBlogPostResponse.body.generatedPosts).toHaveLength(1);

      // Review and approve generated post
      const generatedPostId = newBlogPostResponse.body.generatedPosts[0].id;
      const approveResponse = await request(app)
        .post(`/api/posts/${generatedPostId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(approveResponse.body).toHaveProperty('success', true);
      expect(approveResponse.body.post.status).toBe('scheduled');
    });

    it('should handle SoloBoss integration workflow', async () => {
      // Setup user and auth
      const user = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'soloboss-test@example.com',
          password: 'SecurePassword123!',
          name: 'SoloBoss Test User'
        })
        .expect(201);

      authToken = user.body.token;

      // Connect social media platform
      await request(app)
        .post('/api/oauth/connect/instagram')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'mock_oauth_code',
          redirectUri: 'http://localhost:3000/oauth/callback'
        })
        .expect(200);

      // Configure SoloBoss integration
      const soloBossConfigResponse = await request(app)
        .post('/api/soloboss/configure')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: 'mock_soloboss_api_key',
          autoApprove: true
        })
        .expect(200);

      expect(soloBossConfigResponse.body).toHaveProperty('success', true);

      // Simulate SoloBoss webhook
      const soloBossWebhookResponse = await request(app)
        .post('/api/soloboss/webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'AI Generated Blog Post',
          content: 'This is AI-generated content from SoloBoss...',
          seoSuggestions: ['keyword1', 'keyword2'],
          socialMediaText: 'Check out this amazing new blog post! #AI #Content',
          images: ['https://example.com/image1.jpg']
        })
        .expect(200);

      expect(soloBossWebhookResponse.body).toHaveProperty('processedContent');
      expect(soloBossWebhookResponse.body.processedContent).toHaveProperty('posts');

      // Since autoApprove is true, posts should be automatically scheduled
      const posts = soloBossWebhookResponse.body.processedContent.posts;
      expect(posts[0].status).toBe('scheduled');
    });
  });

  describe('Error Handling Workflows', () => {
    beforeEach(async () => {
      // Setup authenticated user for error tests
      const user = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'error-test@example.com',
          password: 'SecurePassword123!',
          name: 'Error Test User'
        })
        .expect(201);

      authToken = user.body.token;
    });

    it('should handle authentication errors gracefully', async () => {
      // Test with invalid token
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should handle platform API failures with retry logic', async () => {
      // Connect platform with mock that will fail
      await request(app)
        .post('/api/oauth/connect/facebook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'mock_oauth_code_fail',
          redirectUri: 'http://localhost:3000/oauth/callback'
        })
        .expect(200);

      // Create post that will fail to publish
      const createPostResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This post will fail to publish',
          platforms: ['facebook']
        })
        .expect(201);

      postId = createPostResponse.body.id;

      // Attempt to publish (should fail and trigger retry)
      const publishResponse = await request(app)
        .post(`/api/posts/${postId}/publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(publishResponse.body.results[0]).toHaveProperty('success', false);
      expect(publishResponse.body.results[0]).toHaveProperty('retryable', true);

      // Check that post is in retry queue
      const retryQueueResponse = await request(app)
        .get('/api/posts/retry-queue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(retryQueueResponse.body.posts).toHaveLength(1);
      expect(retryQueueResponse.body.posts[0].id).toBe(postId);
    });
  });
});