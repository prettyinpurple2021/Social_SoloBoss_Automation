import request from 'supertest';
import { app } from '../../index';
import { setupTestDatabase, cleanupTestDatabase } from '../setup';
import { performance } from 'perf_hooks';

describe('Performance and Load Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('API Performance', () => {
    test('should handle concurrent post creation', async () => {
      const token = await getValidToken();
      const startTime = performance.now();
      
      // Create 100 concurrent post requests
      const requests = Array.from({ length: 100 }, (_, i) =>
        request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${token}`)
          .send({
            content: `Test post ${i}`,
            platforms: ['facebook'],
            scheduled_time: new Date(Date.now() + 3600000).toISOString()
          })
      );

      const results = await Promise.allSettled(requests);
      const endTime = performance.now();
      
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      ).length;
      
      const avgResponseTime = (endTime - startTime) / 100;
      
      expect(successCount).toBeGreaterThan(90); // 90% success rate
      expect(avgResponseTime).toBeLessThan(1000); // Under 1 second average
    });

    test('should maintain performance under database load', async () => {
      const token = await getValidToken();
      
      // Create test data
      await createTestPosts(1000);
      
      const startTime = performance.now();
      
      // Test pagination performance
      const response = await request(app)
        .get('/api/posts?page=1&limit=50')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(500); // Under 500ms
      expect(response.body.posts).toHaveLength(50);
      expect(response.body.total).toBeGreaterThan(1000);
    });

    test('should handle analytics queries efficiently', async () => {
      const token = await getValidToken();
      
      // Create analytics data
      await createTestAnalytics(10000);
      
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/analytics/dashboard?period=30d')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(2000); // Under 2 seconds
      expect(response.body.metrics).toBeDefined();
      expect(response.body.charts).toBeDefined();
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during bulk operations', async () => {
      const token = await getValidToken();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform bulk operations
      for (let i = 0; i < 10; i++) {
        const requests = Array.from({ length: 50 }, () =>
          request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({
              content: `Bulk test post ${i}`,
              platforms: ['facebook']
            })
        );
        
        await Promise.all(requests);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    test('should handle file upload stress', async () => {
      const token = await getValidToken();
      
      // Create multiple concurrent file uploads
      const uploads = Array.from({ length: 20 }, () => {
        const fileData = Buffer.alloc(1024 * 1024); // 1MB file
        return request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', fileData, 'test.jpg');
      });
      
      const startTime = performance.now();
      const results = await Promise.allSettled(uploads);
      const endTime = performance.now();
      
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      const avgTime = (endTime - startTime) / 20;
      
      expect(successCount).toBeGreaterThan(18); // 90% success rate
      expect(avgTime).toBeLessThan(5000); // Under 5 seconds average
    });
  });

  describe('Database Performance', () => {
    test('should optimize complex queries', async () => {
      const token = await getValidToken();
      
      // Create complex query scenario
      await createTestData();
      
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/analytics/advanced?metrics=engagement,reach,clicks&platforms=facebook,instagram&period=90d')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(3000); // Under 3 seconds
      expect(response.body.data).toBeDefined();
    });

    test('should handle connection pool efficiently', async () => {
      const token = await getValidToken();
      
      // Create many concurrent database operations
      const operations = Array.from({ length: 200 }, () =>
        request(app)
          .get('/api/posts')
          .set('Authorization', `Bearer ${token}`)
      );
      
      const startTime = performance.now();
      const results = await Promise.allSettled(operations);
      const endTime = performance.now();
      
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      const avgTime = (endTime - startTime) / 200;
      
      expect(successCount).toBeGreaterThan(190); // 95% success rate
      expect(avgTime).toBeLessThan(100); // Under 100ms average
    });
  });

  describe('Caching Performance', () => {
    test('should improve response times with Redis cache', async () => {
      const token = await getValidToken();
      
      // First request (cache miss)
      const startTime1 = performance.now();
      await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const endTime1 = performance.now();
      const firstRequestTime = endTime1 - startTime1;
      
      // Second request (cache hit)
      const startTime2 = performance.now();
      await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const endTime2 = performance.now();
      const secondRequestTime = endTime2 - startTime2;
      
      // Cached request should be significantly faster
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
    });
  });
});

async function getValidToken(): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'test@example.com',
      password: 'testpassword'
    });

  return response.body.token;
}

async function createTestPosts(count: number): Promise<void> {
  // Implementation to create test posts in database
  // This would use the database connection to insert test data
}

async function createTestAnalytics(count: number): Promise<void> {
  // Implementation to create test analytics data
}

async function createTestData(): Promise<void> {
  // Implementation to create comprehensive test data
}