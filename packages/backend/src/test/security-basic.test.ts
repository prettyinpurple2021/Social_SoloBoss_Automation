import request from 'supertest';
import express from 'express';
import { 
  enforceHTTPS, 
  securityHeaders, 
  sanitizeRequest, 
  validateUserAgent
} from '../middleware/security';
import { 
  handleValidationErrors,
  validateEmail,
  validatePassword,
  sanitizeContent
} from '../middleware/validation';

// Mock dependencies
jest.mock('../services/LoggerService');
jest.mock('../database/connection');
jest.mock('../database/redis');

describe('Basic Security Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
  });

  describe('Security Headers', () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.get('/test', (req, res) => res.json({ success: true }));
    });

    it('should set basic security headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Input Sanitization', () => {
    beforeEach(() => {
      app.use(sanitizeRequest);
      app.post('/test', (req, res) => res.json(req.body));
    });

    it('should remove null bytes', async () => {
      const response = await request(app)
        .post('/test')
        .send({ content: 'test\0content' });

      expect(response.body.content).toBe('testcontent');
    });
  });

  describe('Content Validation', () => {
    beforeEach(() => {
      app.post('/test', sanitizeContent(), handleValidationErrors, (req: any, res: any) => {
        res.json({ content: req.body.content });
      });
    });

    it('should remove dangerous HTML', async () => {
      const response = await request(app)
        .post('/test')
        .send({ content: '<script>alert("xss")</script>Safe content' });

      expect(response.status).toBe(200);
      expect(response.body.content).not.toContain('<script>');
      expect(response.body.content).toContain('Safe content');
    });
  });

  describe('Email Validation', () => {
    beforeEach(() => {
      app.post('/test', validateEmail(), handleValidationErrors, (req: any, res: any) => {
        res.json({ email: req.body.email });
      });
    });

    it('should accept valid email', async () => {
      const response = await request(app)
        .post('/test')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/test')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('Password Validation', () => {
    beforeEach(() => {
      app.post('/test', validatePassword(), handleValidationErrors, (req: any, res: any) => {
        res.json({ success: true });
      });
    });

    it('should accept strong password', async () => {
      const response = await request(app)
        .post('/test')
        .send({ password: 'StrongPass123!' });

      expect(response.status).toBe(200);
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/test')
        .send({ password: 'weak' });

      expect(response.status).toBe(400);
    });
  });
});