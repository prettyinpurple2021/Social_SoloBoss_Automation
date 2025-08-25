/**
 * Advanced Analytics Test Suite
 * 
 * Tests the new advanced analytics features including custom dashboards,
 * automated reporting, competitive analysis, ROI tracking, and predictive analytics.
 */

import request from 'supertest';
import { app } from '../index';
import { db } from '../database/connection';
import { AuthService } from '../services/AuthService';
import { Platform } from '../types/database';

describe('Advanced Analytics Features', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const testUser = {
      email: 'analytics-test@example.com',
      password: 'TestPassword123!',
      name: 'Analytics Test User'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(registerResponse.status).toBe(201);
    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM users WHERE email = $1', ['analytics-test@example.com']);
  });

  describe('Custom Dashboards', () => {
    let dashboardId: string;

    it('should create a custom dashboard', async () => {
      const dashboardData = {
        name: 'Test Dashboard',
        description: 'A test dashboard for analytics',
        widgets: [
          {
            id: 'widget-1',
            type: 'metric',
            title: 'Total Engagement',
            config: {
              metric: 'total_engagement',
              size: 'medium',
              position: { x: 0, y: 0, w: 3, h: 2 }
            }
          }
        ],
        isDefault: false,
        isPublic: false,
        tags: ['test', 'analytics']
      };

      const response = await request(app)
        .post('/api/analytics/dashboards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dashboardData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(dashboardData.name);
      expect(response.body.data.widgets).toHaveLength(1);

      dashboardId = response.body.data.id;
    });

    it('should get user dashboards', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get specific dashboard with populated data', async () => {
      const response = await request(app)
        .get(`/api/analytics/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(dashboardId);
      expect(response.body.data.widgets).toHaveLength(1);
    });

    it('should update dashboard', async () => {
      const updateData = {
        name: 'Updated Test Dashboard',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/analytics/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
    });

    it('should get dashboard templates', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboards/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should delete dashboard', async () => {
      const response = await request(app)
        .delete(`/api/analytics/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('KPI Management', () => {
    let kpiId: string;

    it('should create a KPI', async () => {
      const kpiData = {
        name: 'Engagement Rate',
        description: 'Average engagement rate across all platforms',
        formula: 'AVG(engagement_rate)',
        target: 5.0,
        unit: '%',
        category: 'engagement',
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
        isActive: true
      };

      const response = await request(app)
        .post('/api/analytics/kpis')
        .set('Authorization', `Bearer ${authToken}`)
        .send(kpiData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(kpiData.name);
      expect(response.body.data.target).toBe(kpiData.target);

      kpiId = response.body.data.id;
    });

    it('should get user KPIs', async () => {
      const response = await request(app)
        .get('/api/analytics/kpis')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should calculate KPI values', async () => {
      const calculationData = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        kpiIds: [kpiId]
      };

      const response = await request(app)
        .post('/api/analytics/kpis/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(calculationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Automated Reporting', () => {
    let templateId: string;
    let reportId: string;

    it('should create a report template', async () => {
      const templateData = {
        name: 'Weekly Test Report',
        description: 'Test report template',
        type: 'executive_summary',
        sections: [
          {
            id: 'overview',
            type: 'overview',
            title: 'Performance Overview',
            config: { timeRange: '7d', includeComparison: true }
          }
        ],
        schedule: {
          frequency: 'weekly',
          dayOfWeek: 1,
          time: '09:00',
          timezone: 'UTC'
        },
        recipients: ['test@example.com'],
        isActive: false
      };

      const response = await request(app)
        .post('/api/analytics/reports/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(templateData.name);

      templateId = response.body.data.id;
    });

    it('should get report templates', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should generate a report manually', async () => {
      const response = await request(app)
        .post(`/api/analytics/reports/generate/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('generated');

      reportId = response.body.data.id;
    });

    it('should get generated reports', async () => {
      const response = await request(app)
        .get('/api/analytics/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get report template library', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/templates/library')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Competitive Analysis', () => {
    let competitorId: string;

    it('should add a competitor', async () => {
      const competitorData = {
        name: 'Test Competitor',
        description: 'A test competitor for analysis',
        industry: 'technology',
        platforms: [
          {
            platform: Platform.FACEBOOK,
            handle: '@testcompetitor',
            followerCount: 10000
          }
        ],
        isActive: true
      };

      const response = await request(app)
        .post('/api/analytics/competitive/competitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(competitorData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(competitorData.name);

      competitorId = response.body.data.id;
    });

    it('should get user competitors', async () => {
      const response = await request(app)
        .get('/api/analytics/competitive/competitors')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get industry benchmarks', async () => {
      const response = await request(app)
        .get('/api/analytics/competitive/benchmarks/technology')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle competitive analysis with no competitors gracefully', async () => {
      // First delete the competitor to test the error case
      await db.query('DELETE FROM competitor_profiles WHERE id = $1', [competitorId]);

      const response = await request(app)
        .get('/api/analytics/competitive/analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No active competitors found');
    });
  });

  describe('ROI Tracking', () => {
    let goalId: string;
    let campaignId: string;

    it('should create a conversion goal', async () => {
      const goalData = {
        name: 'Newsletter Signup',
        description: 'Track newsletter signups from social media',
        type: 'signup',
        value: 5.00,
        currency: 'USD',
        trackingMethod: 'utm_parameters',
        config: {
          utmSource: 'social',
          utmMedium: 'post',
          utmCampaign: 'newsletter'
        },
        isActive: true
      };

      const response = await request(app)
        .post('/api/analytics/roi/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(goalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(goalData.name);

      goalId = response.body.data.id;
    });

    it('should get conversion goals', async () => {
      const response = await request(app)
        .get('/api/analytics/roi/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create a campaign', async () => {
      const campaignData = {
        name: 'Test Campaign',
        description: 'A test marketing campaign',
        startDate: new Date().toISOString(),
        budget: 1000,
        currency: 'USD',
        goals: [goalId],
        posts: [],
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
        status: 'active'
      };

      const response = await request(app)
        .post('/api/analytics/roi/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(campaignData.name);

      campaignId = response.body.data.id;
    });

    it('should get campaigns', async () => {
      const response = await request(app)
        .get('/api/analytics/roi/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should calculate ROI metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/roi/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ campaignId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('investment');
      expect(response.body.data).toHaveProperty('returns');
      expect(response.body.data).toHaveProperty('metrics');
    });

    it('should generate attribution report', async () => {
      const response = await request(app)
        .get('/api/analytics/roi/attribution')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ model: 'linear' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conversions');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should get conversion funnel', async () => {
      const response = await request(app)
        .get(`/api/analytics/roi/funnel/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stages');
      expect(response.body.data).toHaveProperty('totalVisitors');
    });
  });

  describe('Predictive Analytics', () => {
    it('should predict optimal timing', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive/timing')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ platform: Platform.FACEBOOK })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should generate content recommendations', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should predict engagement for content', async () => {
      const contentData = {
        content: 'This is a test post for engagement prediction #test #analytics',
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/analytics/predictive/engagement')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('predictions');
      expect(response.body.data).toHaveProperty('overallScore');
      expect(Array.isArray(response.body.data.predictions)).toBe(true);
    });

    it('should predict trends', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive/trends')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should generate optimal schedule', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ platform: Platform.INSTAGRAM, timeframe: 'week' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('schedule');
      expect(response.body.data).toHaveProperty('alternativeSlots');
      expect(response.body.data).toHaveProperty('insights');
    });

    it('should get comprehensive predictive insights', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive/insights')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timingRecommendations');
      expect(response.body.data).toHaveProperty('contentRecommendations');
      expect(response.body.data).toHaveProperty('trendPredictions');
      expect(response.body.data).toHaveProperty('performanceForecast');
    });

    it('should train a predictive model', async () => {
      const modelData = {
        modelType: 'optimal_timing'
      };

      const response = await request(app)
        .post('/api/analytics/predictive/models/train')
        .set('Authorization', `Bearer ${authToken}`)
        .send(modelData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.type).toBe(modelData.modelType);
      expect(response.body.data.accuracy).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should validate dashboard creation input', async () => {
      const invalidData = {
        // Missing required name field
        widgets: 'not-an-array'
      };

      const response = await request(app)
        .post('/api/analytics/dashboards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate KPI creation input', async () => {
      const invalidData = {
        name: 'Test KPI',
        // Missing required fields
        target: 'not-a-number'
      };

      const response = await request(app)
        .post('/api/analytics/kpis')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate predictive analytics input', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive/timing')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ platform: 'invalid-platform' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent dashboard', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/analytics/dashboards/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Dashboard not found');
    });

    it('should handle invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboards/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboards')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});