import request from 'supertest';
import { app } from '../index';
import { db } from '../database/connection';
import { ContentTemplateModel } from '../models/ContentTemplate';
import { ContentApprovalWorkflowModel, TeamMemberModel } from '../models/ContentApproval';
import { ContentVersioningService } from '../services/ContentVersioningService';
import { ContentCalendarService } from '../services/ContentCalendarService';

describe('Advanced Content Management Features', () => {
  let authToken: string;
  let userId: string;
  let postId: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

    userId = userResponse.body.data.user.id;

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;

    // Create a test post
    const postResponse = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Test post content',
        platforms: ['facebook'],
        scheduledTime: new Date(Date.now() + 3600000).toISOString()
      });

    postId = postResponse.body.data.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM users WHERE email = $1', ['test@example.com']);
  });

  describe('Content Templates', () => {
    let templateId: string;

    it('should create a content template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Template',
          description: 'A test template',
          templateType: 'manual',
          platform: 'all',
          templateContent: 'Check out this post: {{title}}\n\n{{content}}\n\n{{hashtags}}',
          variables: ['title', 'content', 'hashtags'],
          isActive: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Template');
      templateId = response.body.data.id;
    });

    it('should get all templates for user', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get template by ID', async () => {
      const response = await request(app)
        .get(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(templateId);
    });

    it('should preview template with sample data', async () => {
      const response = await request(app)
        .post(`/api/templates/${templateId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sampleData: {
            title: 'Sample Title',
            content: 'Sample content here',
            hashtags: '#test #sample'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.preview).toContain('Sample Title');
      expect(response.body.data.preview).toContain('Sample content here');
    });

    it('should update template', async () => {
      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Test Template',
          templateContent: 'Updated: {{title}}\n\n{{content}}'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Test Template');
    });

    it('should get available variables for template type', async () => {
      const response = await request(app)
        .get('/api/templates/variables/blogger')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.templateType).toBe('blogger');
      expect(Array.isArray(response.body.data.variables)).toBe(true);
    });

    it('should delete template', async () => {
      const response = await request(app)
        .delete(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Content Approval Workflow', () => {
    let workflowId: string;
    let approvalRequestId: string;

    it('should create approval workflow', async () => {
      const response = await request(app)
        .post('/api/content-approval/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Workflow',
          description: 'A test approval workflow',
          steps: [
            {
              stepNumber: 0,
              name: 'Initial Review',
              requiredRoles: ['admin'],
              requiredApprovers: 1,
              allowSelfApproval: false
            },
            {
              stepNumber: 1,
              name: 'Final Approval',
              requiredRoles: ['admin'],
              requiredApprovers: 1,
              allowSelfApproval: true
            }
          ],
          isDefault: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Workflow');
      workflowId = response.body.data.id;
    });

    it('should add team member', async () => {
      // First create another user to add as team member
      const memberResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Team Member',
          email: 'member@example.com',
          password: 'password123'
        });

      const memberId = memberResponse.body.data.user.id;

      const response = await request(app)
        .post('/api/content-approval/team-members')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: memberId,
          role: 'admin',
          permissions: {}
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should submit post for approval', async () => {
      const response = await request(app)
        .post('/api/content-approval/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postId: postId,
          workflowId: workflowId,
          priority: 'normal',
          notes: 'Please review this post'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      approvalRequestId = response.body.data.id;
    });

    it('should get workflow progress', async () => {
      const response = await request(app)
        .get(`/api/content-approval/requests/${approvalRequestId}/progress`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStep).toBe(0);
      expect(response.body.data.totalSteps).toBe(2);
    });

    it('should get pending approvals', async () => {
      const response = await request(app)
        .get('/api/content-approval/pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Content Versioning', () => {
    let versionId: string;
    let abTestId: string;

    it('should get version history for post', async () => {
      const response = await request(app)
        .get(`/api/content-versioning/posts/${postId}/versions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.versions).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
    });

    it('should record performance metric', async () => {
      const response = await request(app)
        .post(`/api/content-versioning/posts/${postId}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metricCategory: 'engagement',
          metricName: 'likes',
          metricValue: 150,
          metricUnit: 'count',
          benchmarkValue: 100
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metricValue).toBe(150);
    });

    it('should get performance summary', async () => {
      const response = await request(app)
        .get(`/api/content-versioning/posts/${postId}/performance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overallScore).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
    });

    it('should create A/B test', async () => {
      // Create another post for variant
      const variantPostResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Variant post content',
          platforms: ['facebook'],
          scheduledTime: new Date(Date.now() + 3600000).toISOString()
        });

      const variantPostId = variantPostResponse.body.data.id;

      const response = await request(app)
        .post('/api/content-versioning/ab-tests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test A/B Test',
          description: 'Testing different content versions',
          testType: 'content',
          variants: [
            {
              name: 'Control',
              postId: postId,
              trafficAllocation: 0.5,
              isControl: true
            },
            {
              name: 'Variant A',
              postId: variantPostId,
              trafficAllocation: 0.5,
              isControl: false
            }
          ],
          duration: {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
          },
          metrics: {
            primary: 'engagement_rate'
          },
          sampleSize: 1000,
          confidenceLevel: 0.95
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test A/B Test');
      abTestId = response.body.data.id;
    });

    it('should start A/B test', async () => {
      const response = await request(app)
        .post(`/api/content-versioning/ab-tests/${abTestId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('running');
    });
  });

  describe('Content Calendar', () => {
    let eventId: string;
    let campaignId: string;

    it('should create calendar event', async () => {
      const response = await request(app)
        .post('/api/content-calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Event',
          description: 'A test calendar event',
          eventType: 'post',
          startDate: new Date(Date.now() + 3600000).toISOString(),
          endDate: new Date(Date.now() + 7200000).toISOString(),
          priority: 'normal',
          postId: postId
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Event');
      eventId = response.body.data.id;
    });

    it('should get calendar view', async () => {
      const response = await request(app)
        .get('/api/content-calendar')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 3600000).toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toBeDefined();
      expect(response.body.data.campaigns).toBeDefined();
    });

    it('should create campaign', async () => {
      const response = await request(app)
        .post('/api/content-calendar/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Campaign',
          description: 'A test marketing campaign',
          campaignType: 'product_launch',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
          budget: 1000,
          targetAudience: 'Young professionals',
          goals: 'Increase brand awareness'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Campaign');
      campaignId = response.body.data.id;
    });

    it('should add post to campaign', async () => {
      const response = await request(app)
        .post(`/api/content-calendar/campaigns/${campaignId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postId: postId,
          postRole: 'hero',
          sequenceOrder: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should get campaign analytics', async () => {
      const response = await request(app)
        .get(`/api/content-calendar/campaigns/${campaignId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
    });

    it('should create workflow state', async () => {
      const response = await request(app)
        .post('/api/content-calendar/workflow-states')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Draft',
          description: 'Initial draft state',
          color: '#FFC107',
          isInitialState: true,
          allowedTransitions: ['Review', 'Published'],
          requiredRoles: ['editor']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Draft');
    });

    it('should add collaboration comment', async () => {
      const response = await request(app)
        .post(`/api/content-calendar/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          commentText: 'This looks great! Ready for approval.',
          commentType: 'approval',
          isInternal: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.commentText).toBe('This looks great! Ready for approval.');
    });

    it('should get post comments', async () => {
      const response = await request(app)
        .get(`/api/content-calendar/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should update event status', async () => {
      const response = await request(app)
        .patch(`/api/content-calendar/events/${eventId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete content workflow', async () => {
      // 1. Create a template
      const templateResponse = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Workflow Template',
          templateType: 'manual',
          platform: 'all',
          templateContent: 'New post: {{title}}\n\n{{content}}',
          variables: ['title', 'content']
        });

      expect(templateResponse.status).toBe(201);

      // 2. Create a workflow
      const workflowResponse = await request(app)
        .post('/api/content-approval/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Integration Workflow',
          steps: [{
            stepNumber: 0,
            name: 'Review',
            requiredRoles: ['admin'],
            requiredApprovers: 1,
            allowSelfApproval: true
          }]
        });

      expect(workflowResponse.status).toBe(201);

      // 3. Create a campaign
      const campaignResponse = await request(app)
        .post('/api/content-calendar/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Integration Campaign',
          description: 'Testing full workflow integration'
        });

      expect(campaignResponse.status).toBe(201);

      // 4. Create a post and add to campaign
      const postResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Integration test post',
          platforms: ['facebook']
        });

      expect(postResponse.status).toBe(201);

      const campaignPostResponse = await request(app)
        .post(`/api/content-calendar/campaigns/${campaignResponse.body.data.id}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postId: postResponse.body.data.id,
          postRole: 'hero'
        });

      expect(campaignPostResponse.status).toBe(201);

      // 5. Submit for approval
      const approvalResponse = await request(app)
        .post('/api/content-approval/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postId: postResponse.body.data.id,
          workflowId: workflowResponse.body.data.id,
          priority: 'normal'
        });

      expect(approvalResponse.status).toBe(201);

      // 6. Record performance metrics
      const metricsResponse = await request(app)
        .post(`/api/content-versioning/posts/${postResponse.body.data.id}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metricCategory: 'engagement',
          metricName: 'likes',
          metricValue: 200
        });

      expect(metricsResponse.status).toBe(201);

      // Verify the complete workflow worked
      const calendarResponse = await request(app)
        .get('/api/content-calendar')
        .set('Authorization', `Bearer ${authToken}`);

      expect(calendarResponse.status).toBe(200);
      expect(calendarResponse.body.data.campaigns.length).toBeGreaterThan(0);
    });
  });
});

describe('Content Management Services', () => {
  let contentVersioningService: ContentVersioningService;
  let contentCalendarService: ContentCalendarService;

  beforeAll(() => {
    contentVersioningService = ContentVersioningService.getInstance();
    contentCalendarService = ContentCalendarService.getInstance();
  });

  describe('ContentVersioningService', () => {
    it('should create post version', async () => {
      const version = await contentVersioningService.createPostVersion({
        post_id: 'test-post-id',
        content: 'Test content',
        platforms: ['facebook'],
        changed_by: 'test-user-id',
        change_type: 'create'
      });

      expect(version).toBeDefined();
      expect(version.content).toBe('Test content');
    });

    it('should record performance metric', async () => {
      const metric = await contentVersioningService.recordPerformanceMetric(
        'test-post-id',
        'engagement',
        'likes',
        150,
        { benchmarkValue: 100 }
      );

      expect(metric).toBeDefined();
      expect(metric.metricValue).toBe(150);
    });
  });

  describe('ContentCalendarService', () => {
    it('should create calendar event', async () => {
      const event = await contentCalendarService.createCalendarEvent({
        user_id: 'test-user-id',
        title: 'Test Event',
        event_type: 'post',
        start_date: new Date()
      });

      expect(event).toBeDefined();
      expect(event.title).toBe('Test Event');
    });

    it('should create campaign', async () => {
      const campaign = await contentCalendarService.createCampaign({
        user_id: 'test-user-id',
        name: 'Test Campaign'
      });

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Test Campaign');
    });
  });
});