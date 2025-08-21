import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import crypto from 'crypto';
import { SoloBossService } from '../services/SoloBossService';
import { EncryptionService } from '../services/EncryptionService';
import { PostService } from '../services/PostService';
import { SoloBossWebhookPayload } from '../types/soloboss';
import { PostSource, PostStatus } from '../types/database';
import { testDb } from './setup';

describe('SoloBoss Integration Tests', () => {
  let soloBossService: SoloBossService;
  let encryptionService: EncryptionService;
  let testUserId: string;

  beforeEach(async () => {
    soloBossService = new SoloBossService(testDb);
    
    // Create test user
    const userResult = await testDb.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['integration-test@example.com', 'Integration Test User', 'hashedpassword']
    );
    testUserId = userResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.query('DELETE FROM posts WHERE user_id = $1', [testUserId]);
    await testDb.query('DELETE FROM soloboss_integrations WHERE user_id = $1', [testUserId]);
    await testDb.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('End-to-End SoloBoss Workflow', () => {
    it('should complete full workflow from connection to post creation', async () => {
      // Step 1: Connect SoloBoss integration
      const connectionRequest = {
        apiKey: 'integration-test-api-key-12345',
        webhookSecret: 'integration-test-webhook-secret-16chars'
      };

      const connectionResult = await soloBossService.connectSoloBoss(testUserId, connectionRequest);
      expect(connectionResult.success).toBe(true);

      // Step 2: Verify integration is active
      const integration = await soloBossService.getSoloBossIntegration(testUserId);
      expect(integration).toBeDefined();
      expect(integration?.isActive).toBe(true);

      // Step 3: Create and verify webhook signature
      const webhookPayload: SoloBossWebhookPayload = {
        id: 'integration-test-content-123',
        title: 'Complete Integration Test Blog Post',
        content: 'This is a comprehensive test of the SoloBoss integration workflow. It includes detailed content that will be processed and converted into social media posts across multiple platforms.',
        seoSuggestions: [
          'integration testing',
          'social media automation',
          'content marketing',
          'blog post distribution',
          'multi-platform posting'
        ],
        socialMediaText: 'Just published a comprehensive guide on social media automation! Learn how to streamline your content distribution across multiple platforms. #SocialMedia #Automation #ContentMarketing',
        images: [
          'https://example.com/blog-header.jpg',
          'https://example.com/infographic.png',
          'https://example.com/screenshot.jpg'
        ],
        publishedAt: '2024-01-15T14:30:00Z',
        userId: testUserId,
        signature: '' // Will be calculated
      };

      // Calculate proper signature
      const payloadForSignature: any = { ...webhookPayload };
      delete payloadForSignature.signature;
      const payloadString = JSON.stringify(payloadForSignature);
      
      webhookPayload.signature = crypto
        .createHmac('sha256', connectionRequest.webhookSecret)
        .update(payloadString)
        .digest('hex');

      // Step 4: Verify webhook signature
      const isValidSignature = await soloBossService.verifyWebhookSignature(
        payloadString,
        webhookPayload.signature,
        testUserId
      );
      expect(isValidSignature).toBe(true);

      // Step 5: Process webhook content
      const processedContent = await soloBossService.processWebhookContent(webhookPayload);
      
      expect(processedContent.requiresReview).toBe(true);
      expect(processedContent.posts).toHaveLength(1);
      expect(processedContent.originalContent.id).toBe('integration-test-content-123');

      const generatedPost = processedContent.posts[0];
      expect(generatedPost.userId).toBe(testUserId);
      expect(generatedPost.content).toContain('social media automation');
      expect(generatedPost.images).toHaveLength(3);
      expect(generatedPost.hashtags.length).toBeGreaterThan(0);
      expect(generatedPost.platforms).toEqual(['facebook', 'instagram', 'pinterest', 'x']);

      // Verify platform-specific content
      expect(generatedPost.platformSpecificContent).toBeDefined();
      expect(generatedPost.platformSpecificContent?.x.content.length).toBeLessThanOrEqual(280);
      expect(generatedPost.platformSpecificContent?.instagram.hashtags.length).toBeGreaterThan(0);
      expect(generatedPost.platformSpecificContent?.pinterest.images).toHaveLength(1);

      // Step 6: Create draft posts in database
      const postIds = await soloBossService.createDraftPostsFromSoloBoss(testUserId, processedContent);
      
      expect(postIds).toHaveLength(1);
      expect(postIds[0]).toBeDefined();

      // Step 7: Verify posts were created in database
      const createdPosts = await PostService.getPostsByUserAndSource(testUserId, PostSource.SOLOBOSS, PostStatus.DRAFT);
      expect(createdPosts).toHaveLength(1);
      
      const createdPost = createdPosts[0];
      expect(createdPost.id).toBe(postIds[0]);
      expect(createdPost.source).toBe('soloboss');
      expect(createdPost.status).toBe('draft');
      expect(createdPost.content).toContain('social media automation');

      // Step 8: Test post customization
      const customizations = {
        content: 'Customized: Just published a guide on social media automation!',
        hashtags: ['#CustomizedHashtag', '#SocialMedia'],
        scheduledTime: new Date('2024-01-20T10:00:00Z')
      };

      const updatedPost = await PostService.updatePost(createdPost.id, testUserId, customizations);
      expect(updatedPost).toBeDefined();
      expect(updatedPost?.content).toBe(customizations.content);
      expect(updatedPost?.hashtags).toEqual(customizations.hashtags);
      expect(updatedPost?.scheduled_time).toEqual(customizations.scheduledTime);

      // Step 9: Test post approval (status change)
      const approvedPost = await PostService.updatePostStatus(createdPost.id, testUserId, PostStatus.SCHEDULED);
      expect(approvedPost).toBeDefined();
      expect(approvedPost?.status).toBe('scheduled');

      // Step 10: Test post deletion
      const deleteResult = await PostService.deletePost(createdPost.id, testUserId);
      expect(deleteResult).toBe(true);

      // Verify post is deleted
      const deletedPost = await PostService.getPost(createdPost.id, testUserId);
      expect(deletedPost).toBeNull();
    });

    it('should handle multiple webhook payloads correctly', async () => {
      // Connect integration
      const connectionRequest = {
        apiKey: 'multi-webhook-test-api-key',
        webhookSecret: 'multi-webhook-test-secret-16chars'
      };
      await soloBossService.connectSoloBoss(testUserId, connectionRequest);

      // Create multiple webhook payloads
      const webhookPayloads: SoloBossWebhookPayload[] = [
        {
          id: 'multi-test-1',
          title: 'First Blog Post',
          content: 'Content for first blog post',
          seoSuggestions: ['first', 'blog'],
          socialMediaText: 'First social media post',
          images: ['https://example.com/image1.jpg'],
          publishedAt: '2024-01-15T10:00:00Z',
          userId: testUserId,
          signature: ''
        },
        {
          id: 'multi-test-2',
          title: 'Second Blog Post',
          content: 'Content for second blog post',
          seoSuggestions: ['second', 'blog'],
          socialMediaText: 'Second social media post',
          images: ['https://example.com/image2.jpg'],
          publishedAt: '2024-01-15T11:00:00Z',
          userId: testUserId,
          signature: ''
        }
      ];

      // Process each webhook
      const allPostIds: string[] = [];
      
      for (const payload of webhookPayloads) {
        // Calculate signature
        const payloadForSignature: any = { ...payload };
        delete payloadForSignature.signature;
        const payloadString = JSON.stringify(payloadForSignature);
        
        payload.signature = crypto
          .createHmac('sha256', connectionRequest.webhookSecret)
          .update(payloadString)
          .digest('hex');

        // Process webhook
        const processedContent = await soloBossService.processWebhookContent(payload);
        const postIds = await soloBossService.createDraftPostsFromSoloBoss(testUserId, processedContent);
        
        allPostIds.push(...postIds);
      }

      // Verify all posts were created
      expect(allPostIds).toHaveLength(2);
      
      const allPosts = await PostService.getPostsByUserAndSource(testUserId, PostSource.SOLOBOSS, PostStatus.DRAFT);
      expect(allPosts).toHaveLength(2);
      
      // Verify posts have different content
      const contents = allPosts.map(post => post.content);
      expect(contents).toContain('First social media post');
      expect(contents).toContain('Second social media post');
    });

    it('should handle webhook with invalid signature gracefully', async () => {
      // Connect integration
      const connectionRequest = {
        apiKey: 'invalid-signature-test-api-key',
        webhookSecret: 'invalid-signature-test-secret-16chars'
      };
      await soloBossService.connectSoloBoss(testUserId, connectionRequest);

      const webhookPayload: SoloBossWebhookPayload = {
        id: 'invalid-signature-test',
        title: 'Test Blog Post',
        content: 'Test content',
        seoSuggestions: ['test'],
        socialMediaText: 'Test social media post',
        images: [],
        publishedAt: '2024-01-15T12:00:00Z',
        userId: testUserId,
        signature: 'completely-invalid-signature'
      };

      const payloadString = JSON.stringify(webhookPayload);
      
      // Verify signature is invalid
      const isValidSignature = await soloBossService.verifyWebhookSignature(
        payloadString,
        webhookPayload.signature,
        testUserId
      );
      expect(isValidSignature).toBe(false);

      // Verify no posts were created due to invalid signature
      const posts = await PostService.getPostsByUserAndSource(testUserId, PostSource.SOLOBOSS, PostStatus.DRAFT);
      expect(posts).toHaveLength(0);
    });

    it('should handle disconnection and reconnection workflow', async () => {
      // Step 1: Connect
      const initialConnection = {
        apiKey: 'disconnect-test-api-key-12345',
        webhookSecret: 'disconnect-test-webhook-secret-16chars'
      };
      
      let result = await soloBossService.connectSoloBoss(testUserId, initialConnection);
      expect(result.success).toBe(true);

      let integration = await soloBossService.getSoloBossIntegration(testUserId);
      expect(integration?.isActive).toBe(true);

      // Step 2: Disconnect
      const disconnectResult = await soloBossService.disconnectSoloBoss(testUserId);
      expect(disconnectResult).toBe(true);

      integration = await soloBossService.getSoloBossIntegration(testUserId);
      expect(integration).toBeNull();

      // Step 3: Reconnect with different credentials
      const newConnection = {
        apiKey: 'reconnect-test-api-key-54321',
        webhookSecret: 'reconnect-test-webhook-secret-16chars'
      };
      
      result = await soloBossService.connectSoloBoss(testUserId, newConnection);
      expect(result.success).toBe(true);

      integration = await soloBossService.getSoloBossIntegration(testUserId);
      expect(integration?.isActive).toBe(true);

      // Step 4: Verify new credentials work
      const testPayload = JSON.stringify({ test: 'data' });
      const newSignature = crypto
        .createHmac('sha256', newConnection.webhookSecret)
        .update(testPayload)
        .digest('hex');

      const isValid = await soloBossService.verifyWebhookSignature(
        testPayload,
        newSignature,
        testUserId
      );
      expect(isValid).toBe(true);

      // Step 5: Verify old credentials don't work
      const oldSignature = crypto
        .createHmac('sha256', initialConnection.webhookSecret)
        .update(testPayload)
        .digest('hex');

      const isOldValid = await soloBossService.verifyWebhookSignature(
        testPayload,
        oldSignature,
        testUserId
      );
      expect(isOldValid).toBe(false);
    });
  });
});