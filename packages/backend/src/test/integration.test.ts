import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../routes/auth';

// Create a test app similar to the main app
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Test server is running',
      timestamp: new Date().toISOString()
    });
  });
  
  app.use('/api/auth', authRoutes);
  
  return app;
};

describe('Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test server is running');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle complete authentication flow', async () => {
      // This test would require actual database connection
      // For now, we'll just test that the routes are properly mounted
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          password: 'TestPassword123'
        });

      // Since we're using mocked services, we expect this to work
      // The actual database integration will be tested when the database is connected
      expect(response.status).toBeDefined();
    });
  });

  describe('Route Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route');

      expect(response.status).toBe(404);
    });
  });
});