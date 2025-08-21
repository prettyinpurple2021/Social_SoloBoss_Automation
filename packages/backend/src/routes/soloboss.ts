import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { SoloBossService } from '../services/SoloBossService';
import { EncryptionService } from '../services/EncryptionService';
import { PostService } from '../services/PostService';
import { authMiddleware } from '../middleware/auth';
import { SoloBossWebhookPayload, SoloBossConnectionRequest } from '../types/soloboss';
import { PostSource, PostStatus } from '@sma/shared';

export function createSoloBossRoutes(db: Pool): Router {
  const router = Router();
  const soloBossService = new SoloBossService(db);

  // Connect SoloBoss integration
  router.post('/connect', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const connectionRequest: SoloBossConnectionRequest = req.body;
      
      if (!connectionRequest.apiKey || !connectionRequest.webhookSecret) {
        return res.status(400).json({ 
          error: 'API key and webhook secret are required' 
        });
      }

      const result = await soloBossService.connectSoloBoss(userId, connectionRequest);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'SoloBoss integration connected successfully',
          configId: result.configId
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error connecting SoloBoss:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Disconnect SoloBoss integration
  router.delete('/disconnect', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const success = await soloBossService.disconnectSoloBoss(userId);
      
      if (success) {
        res.json({
          success: true,
          message: 'SoloBoss integration disconnected successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No active SoloBoss integration found'
        });
      }
    } catch (error) {
      console.error('Error disconnecting SoloBoss:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get SoloBoss integration status
  router.get('/status', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const integration = await soloBossService.getSoloBossIntegration(userId);
      
      res.json({
        connected: !!integration,
        integration: integration ? {
          id: integration.id,
          isActive: integration.isActive,
          createdAt: integration.createdAt,
          updatedAt: integration.updatedAt
        } : null
      });
    } catch (error) {
      console.error('Error getting SoloBoss status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get pending SoloBoss posts for review
  router.get('/pending-posts', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get draft posts from SoloBoss source
      const posts = await PostService.getPostsByUserAndSource(userId, PostSource.SOLOBOSS, PostStatus.DRAFT);
      
      res.json({
        success: true,
        posts: posts.map(post => ({
          id: post.id,
          content: post.content,
          images: post.images,
          hashtags: post.hashtags,
          platforms: post.platforms,
          created_at: post.created_at,
          source: post.source
        }))
      });
    } catch (error) {
      console.error('Error getting pending SoloBoss posts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update/customize a SoloBoss-generated post
  router.put('/posts/:postId/customize', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { postId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updates = req.body;
      
      // Validate that this is a SoloBoss post owned by the user
      const existingPost = await PostService.getPost(postId, userId);
      if (!existingPost || existingPost.source !== 'soloboss') {
        return res.status(404).json({ error: 'Post not found or not accessible' });
      }

      // Update the post with customizations
      const updatedPost = await PostService.updatePost(postId, userId, {
        content: updates.content,
        images: updates.images,
        hashtags: updates.hashtags,
        platforms: updates.platforms,
        scheduledTime: updates.scheduledTime
      });

      res.json({
        success: true,
        message: 'Post customized successfully',
        post: updatedPost
      });
    } catch (error) {
      console.error('Error customizing SoloBoss post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Approve and schedule a SoloBoss post
  router.post('/posts/:postId/approve', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { postId } = req.params;
      const { scheduledTime } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate that this is a SoloBoss post owned by the user
      const existingPost = await PostService.getPost(postId, userId);
      if (!existingPost || existingPost.source !== 'soloboss') {
        return res.status(404).json({ error: 'Post not found or not accessible' });
      }

      // Update post status and schedule if provided
      const updates: any = {};
      if (scheduledTime) {
        updates.scheduledTime = new Date(scheduledTime);
      }

      // First update with scheduling if provided
      let updatedPost = existingPost;
      if (Object.keys(updates).length > 0) {
        const result = await PostService.updatePost(postId, userId, updates);
        if (result) updatedPost = result;
      }

      // Then update status to scheduled
      const finalPost = await PostService.updatePostStatus(postId, userId, PostStatus.SCHEDULED);

      res.json({
        success: true,
        message: 'Post approved and scheduled successfully',
        post: finalPost || updatedPost
      });
    } catch (error) {
      console.error('Error approving SoloBoss post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Reject/delete a SoloBoss post
  router.delete('/posts/:postId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { postId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate that this is a SoloBoss post owned by the user
      const existingPost = await PostService.getPost(postId, userId);
      if (!existingPost || existingPost.source !== 'soloboss') {
        return res.status(404).json({ error: 'Post not found or not accessible' });
      }

      await PostService.deletePost(postId, userId);

      res.json({
        success: true,
        message: 'Post rejected and deleted successfully'
      });
    } catch (error) {
      console.error('Error rejecting SoloBoss post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Webhook endpoint to receive content from SoloBoss
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const payload: SoloBossWebhookPayload = req.body;
      
      // Validate required fields
      if (!payload.userId || !payload.id || !payload.signature) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, id, or signature' 
        });
      }

      // Verify webhook signature
      const rawBody = JSON.stringify(req.body);
      const isValidSignature = await soloBossService.verifyWebhookSignature(
        rawBody, 
        payload.signature, 
        payload.userId
      );

      if (!isValidSignature) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Process the content
      const processedContent = await soloBossService.processWebhookContent(payload);
      
      // Create draft posts for review
      const postIds = await soloBossService.createDraftPostsFromSoloBoss(
        payload.userId, 
        processedContent
      );

      res.json({
        success: true,
        message: 'Content processed successfully',
        postsCreated: postIds.length,
        postIds,
        requiresReview: processedContent.requiresReview
      });
    } catch (error) {
      console.error('Error processing SoloBoss webhook:', error);
      res.status(500).json({ 
        error: 'Failed to process webhook content',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}