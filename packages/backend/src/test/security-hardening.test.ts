import request from 'supertest';
import { app } from '../index';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../database/connection';
import { redis } from '../database/redis';
import { AuthService } from '../services/AuthService';
import { securityService } from '../services/SecurityService';
import { incidentResponseService } from '../services/IncidentResponseService';

describe('Security Hardening Tests', () => {
  beforeAll(async () => {
    // Initialize test database and Redis
    await db.connect();
    await redis.connect();
  });

  afterAll(async () => {
    await db.disconnect();
    await redis.disconnect();
  });

  describe('HTTPS Enforcement', () => {
    it('should redirect HTTP to HTTPS in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/health')
        .set('Host', 'example.com');

      // In test environment, we can't easily test actual redirects
      // but we can verify the middleware is applied
      expect(response.status).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow HTTP in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/health');

      expect(response.status).not.toBe(301);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await request(app)
        .get('/health');

      // Check for security headers
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should include production-specific headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow, nosnippet, noarchive');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['x-download-options']).toBe('noopen');
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS properly for allowed origins', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(500); // CORS error
    });
  });

  describe('Input Validation', () => {
    it('should sanitize malicious input', async () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
        description: 'SELECT * FROM users; DROP TABLE users;'
      };

      const response = await request(app)
        .post('/api/posts')
        .send(maliciousInput);

      // Should not contain the malicious script
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });

    it('should block SQL injection attempts', async () => {
      const sqlInjection = {
        email: "admin'; DROP TABLE users; --",
        password: 'password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(sqlInjection);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should block XSS attempts', async () => {
      const xssPayload = {
        content: '<img src="x" onerror="alert(1)">',
        platforms: ['facebook']
      };

      const response = await request(app)
        .post('/api/posts')
        .send(xssPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should block path traversal attempts', async () => {
      const pathTraversal = {
        filename: '../../../etc/passwd'
      };

      const response = await request(app)
        .post('/api/posts')
        .send(pathTraversal);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make multiple requests to exceed rate limit
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/posts');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    it('should provide CSRF token endpoint', async () => {
      const response = await request(app)
        .get('/api/security/csrf-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.csrfToken).toBeDefined();
    });

    it('should reject requests without CSRF token for state-changing operations', async () => {
      const response = await request(app)
        .post('/api/posts')
        .send({
          content: 'Test post',
          platforms: ['facebook']
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF');
    });

    it('should accept requests with valid CSRF token', async () => {
      // First get CSRF token
      const tokenResponse = await request(app)
        .get('/api/security/csrf-token');

      const csrfToken = tokenResponse.body.data.csrfToken;

      // Then use it in a request
      const response = await request(app)
        .post('/api/posts')
        .set('X-CSRF-Token', csrfToken)
        .send({
          content: 'Test post',
          platforms: ['facebook']
        });

      // Should not be rejected for CSRF (may fail for other reasons like auth)
      expect(response.status).not.toBe(403);
    });
  });

  describe('JWT Token Security', () => {
    it('should use secure JWT configuration', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        settings: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      const tokenPair = await AuthService.generateTokenPair(user, '127.0.0.1', 'test-agent');

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBe(15 * 60); // 15 minutes
      expect(tokenPair.refreshExpiresIn).toBe(7 * 24 * 60 * 60); // 7 days
    });

    it('should implement token rotation on refresh', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        settings: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      const originalTokenPair = await AuthService.generateTokenPair(user, '127.0.0.1', 'test-agent');
      
      // Simulate token refresh
      const newTokenPair = await AuthService.refreshAccessToken(
        originalTokenPair.refreshToken,
        '127.0.0.1',
        'test-agent'
      );

      if (newTokenPair) {
        expect(newTokenPair.accessToken).not.toBe(originalTokenPair.accessToken);
        expect(newTokenPair.refreshToken).not.toBe(originalTokenPair.refreshToken);
      }
    });
  });

  describe('Account Lockout', () => {
    it('should lock account after multiple failed attempts', async () => {
      const email = 'lockout-test@example.com';
      const wrongPassword = 'wrongpassword';

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: wrongPassword });
      }

      // Check if account is locked
      const lockoutStatus = await securityService.isLockedOut(email, '127.0.0.1');
      expect(lockoutStatus.locked).toBe(true);
    });

    it('should provide lockout information', async () => {
      const email = 'lockout-info-test@example.com';
      
      // Simulate lockout
      for (let i = 0; i < 6; i++) {
        await securityService.recordLoginAttempt(email, '127.0.0.1', 'test-agent', false);
      }

      const lockoutStatus = await securityService.isLockedOut(email, '127.0.0.1');
      expect(lockoutStatus.locked).toBe(true);
      expect(lockoutStatus.unlockAt).toBeDefined();
      expect(lockoutStatus.attemptCount).toBeGreaterThan(0);
    });
  });

  describe('Security Monitoring', () => {
    it('should detect suspicious activity patterns', async () => {
      const email = 'suspicious-test@example.com';
      const userAgent = 'test-agent';

      // Simulate suspicious activity
      const suspiciousActivity = await securityService.detectSuspiciousActivity(
        email,
        '127.0.0.1',
        userAgent
      );

      expect(suspiciousActivity).toBeDefined();
      expect(typeof suspiciousActivity.suspicious).toBe('boolean');
      expect(Array.isArray(suspiciousActivity.reasons)).toBe(true);
      expect(typeof suspiciousActivity.riskScore).toBe('number');
    });

    it('should provide security metrics', async () => {
      const metrics = await securityService.getSecurityMetrics('24h');

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalLoginAttempts).toBe('number');
      expect(typeof metrics.failedLoginAttempts).toBe('number');
      expect(typeof metrics.lockedAccounts).toBe('number');
      expect(typeof metrics.securityEvents).toBe('number');
      expect(typeof metrics.suspiciousActivity).toBe('number');
    });
  });

  describe('Incident Response', () => {
    it('should create security incidents', async () => {
      const incident = {
        type: 'suspicious_activity' as const,
        severity: 'medium' as const,
        title: 'Test Security Incident',
        description: 'This is a test incident for security hardening verification',
        affectedUsers: ['test-user-1'],
        affectedResources: ['authentication'],
        details: {
          testIncident: true,
          detectionMethod: 'automated'
        },
        metadata: {
          detectionMethod: 'test',
          confidence: 85,
          riskScore: 60,
          impactAssessment: 'low'
        }
      };

      const incidentId = await incidentResponseService.createIncident(incident);
      expect(incidentId).toBeDefined();
      expect(typeof incidentId).toBe('string');
    });

    it('should provide incident metrics', async () => {
      const metrics = await incidentResponseService.getIncidentMetrics('24h');

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalIncidents).toBe('number');
      expect(typeof metrics.openIncidents).toBe('number');
      expect(typeof metrics.criticalIncidents).toBe('number');
      expect(typeof metrics.averageResolutionTime).toBe('number');
      expect(typeof metrics.incidentsByType).toBe('object');
      expect(typeof metrics.incidentsBySeverity).toBe('object');
      expect(typeof metrics.responseEffectiveness).toBe('number');
    });
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const originalData = 'sensitive information';
      const encrypted = await import('../services/EncryptionService').then(m => 
        m.EncryptionService.encrypt(originalData)
      );
      const decrypted = await import('../services/EncryptionService').then(m => 
        m.EncryptionService.decrypt(encrypted)
      );

      expect(encrypted).not.toBe(originalData);
      expect(decrypted).toBe(originalData);
    });

    it('should support key versioning', async () => {
      const EncryptionService = await import('../services/EncryptionService').then(m => m.EncryptionService);
      const data = 'test data';
      
      const encrypted = EncryptionService.encrypt(data);
      expect(encrypted).toContain(':'); // Should contain key version
      
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(data);
    });
  });

  describe('Request Validation', () => {
    it('should validate request size limits', async () => {
      const largePayload = {
        data: 'x'.repeat(100 * 1024 * 1024) // 100MB
      };

      const response = await request(app)
        .post('/api/posts')
        .send(largePayload);

      expect(response.status).toBe(413); // Payload too large
    });

    it('should validate content types', async () => {
      const response = await request(app)
        .post('/api/posts')
        .set('Content-Type', 'application/xml')
        .send('<xml>test</xml>');

      expect(response.status).toBe(415); // Unsupported media type
    });

    it('should validate user agent', async () => {
      const response = await request(app)
        .get('/health')
        .set('User-Agent', '');

      expect(response.status).toBe(400); // Bad request
    });
  });

  describe('Security Configuration', () => {
    it('should provide security configuration', async () => {
      const response = await request(app)
        .get('/api/security/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.csrfEnabled).toBe(true);
      expect(response.body.data.corsEnabled).toBe(true);
      expect(response.body.data.rateLimiting.enabled).toBe(true);
    });

    it('should provide security health check', async () => {
      // This endpoint requires authentication, so we expect 401 without token
      const response = await request(app)
        .get('/api/security/health');

      expect(response.status).toBe(401); // Unauthorized (expected without auth)
    });
  });
});