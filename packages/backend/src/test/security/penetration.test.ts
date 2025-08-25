import request from 'supertest';
import { app } from '../../index';
import { setupTestDatabase, cleanupTestDatabase } from '../setup';

describe('Security Penetration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Authentication Security', () => {
    test('should prevent SQL injection in login', async () => {
      const maliciousPayload = {
        email: "admin@example.com'; DROP TABLE users; --",
        password: "password"
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body.error).toContain('Invalid email format');
    });

    test('should prevent brute force attacks', async () => {
      const loginAttempts = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const results = await Promise.all(loginAttempts);
      
      // Should start rate limiting after several attempts
      const rateLimited = results.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });

    test('should prevent session fixation', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        })
        .expect(200);

      const firstToken = loginResponse.body.token;

      // Second login should generate different token
      const secondLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        })
        .expect(200);

      const secondToken = secondLoginResponse.body.token;
      expect(firstToken).not.toBe(secondToken);
    });
  });

  describe('Input Validation Security', () => {
    test('should prevent XSS in post content', async () => {
      const token = await getValidToken();
      const maliciousContent = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: maliciousContent,
          platforms: ['facebook']
        })
        .expect(201);

      // Content should be sanitized
      expect(response.body.content).not.toContain('<script>');
      expect(response.body.content).toContain('&lt;script&gt;');
    });

    test('should prevent command injection in file uploads', async () => {
      const token = await getValidToken();
      const maliciousFilename = 'test.jpg; rm -rf /';

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake image data'), maliciousFilename)
        .expect(400);

      expect(response.body.error).toContain('Invalid filename');
    });

    test('should validate file types and sizes', async () => {
      const token = await getValidToken();
      
      // Test oversized file
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', largeFile, 'large.jpg')
        .expect(413);

      // Test invalid file type
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('executable content'), 'malware.exe')
        .expect(400);
    });
  });

  describe('Authorization Security', () => {
    test('should prevent privilege escalation', async () => {
      const userToken = await getValidToken('user');
      
      // Try to access admin endpoint
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('should prevent horizontal privilege escalation', async () => {
      const user1Token = await getValidToken('user1');
      const user2Id = 'user2-id';
      
      // Try to access another user's posts
      await request(app)
        .get(`/api/users/${user2Id}/posts`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);
    });
  });

  describe('API Security', () => {
    test('should enforce rate limiting', async () => {
      const token = await getValidToken();
      
      // Make many requests quickly
      const requests = Array.from({ length: 100 }, () =>
        request(app)
          .get('/api/posts')
          .set('Authorization', `Bearer ${token}`)
      );

      const results = await Promise.allSettled(requests);
      const rateLimited = results.some(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimited).toBe(true);
    });

    test('should prevent CSRF attacks', async () => {
      const token = await getValidToken();
      
      // Request without CSRF token should fail
      await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'https://malicious-site.com')
        .send({
          content: 'Test post',
          platforms: ['facebook']
        })
        .expect(403);
    });

    test('should enforce HTTPS in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/api/health')
        .expect(301);

      expect(response.headers.location).toMatch(/^https:/);
      
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Data Protection', () => {
    test('should not expose sensitive data in responses', async () => {
      const token = await getValidToken();
      
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Should not expose password hash or other sensitive fields
      expect(response.body.password_hash).toBeUndefined();
      expect(response.body.password).toBeUndefined();
      expect(response.body.secret_key).toBeUndefined();
    });

    test('should encrypt sensitive data at rest', async () => {
      const token = await getValidToken();
      
      // Create platform connection with sensitive token
      await request(app)
        .post('/api/platforms/connect')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'facebook',
          access_token: 'sensitive-token-123',
          refresh_token: 'refresh-token-456'
        })
        .expect(200);

      // Verify tokens are encrypted in database
      const connection = await db.query(
        'SELECT access_token FROM platform_connections WHERE platform = $1',
        ['facebook']
      );

      expect(connection.rows[0].access_token).not.toBe('sensitive-token-123');
      expect(connection.rows[0].access_token).toMatch(/^encrypted:/);
    });
  });
});

async function getValidToken(role: string = 'user'): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: `${role}@example.com`,
      password: 'testpassword'
    });

  return response.body.token;
}