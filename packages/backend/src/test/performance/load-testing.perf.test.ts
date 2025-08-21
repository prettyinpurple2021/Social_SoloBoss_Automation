import request from 'supertest';
import { app } from '../../index';
import { DatabaseConnection } from '../../database/connection';
import { RedisConnection } from '../../database/redis';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  let authTokens: string[] = [];
  const NUM_USERS = 50;
  const POSTS_PER_USER = 20;

  beforeAll(async () => {
    // Initialize test database with performance optimizations
    const db = DatabaseConnection.getInstance();
    const redis = RedisConnection.getInstance();
    await redis.connect();
    
    // Create test users for load testing
    console.log(`Creating ${NUM_USERS} test users...`);
    for (let i = 0; i < NUM_USERS; i++) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `loadtest${i}@example.com`,
          password: 'LoadTest123!',
          name: `Load Test User ${i}`
        });
      
      if (response.status === 201) {
        authTokens.push(response.body.token);
      }
    }
    
    console.log(`Created ${authTokens.length} test users`);
  });

  afterAll(async () => {
    // Clean up test data
    const db = DatabaseConnection.getInstance();
    const redis = RedisConnection.getInstance();
    await db.query('DELETE FROM platform_posts');
    await db.query('DELETE FROM posts');
    await db.query('DELETE FROM platform_connections');
    await db.query("DELETE FROM users WHERE email LIKE '%loadtest%'");
    await db.close();
    await redis.disconnect();
  });

  describe('High-Volume Post Scheduling', () => {
    it('should handle concurrent post creation from multiple users', async () => {
      const startTime = performance.now();
      const promises: Promise<any>[] = [];

      // Create posts concurrently from all users
      for (let userIndex = 0; userIndex < authTokens.length; userIndex++) {
        for (let postIndex = 0; postIndex < 5; postIndex++) {
          const promise = request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
            .send({
              content: `Load test post ${postIndex} from user ${userIndex}`,
              platforms: ['facebook'],
              hashtags: ['#loadtest', `#user${userIndex}`],
              scheduledTime: new Date(Date.now() + (postIndex * 60000)).toISOString()
            });
          
          promises.push(promise);
        }
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      
      const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const failedRequests = results.filter(r => r.status === 'rejected' || r.value.status !== 201);
      
      console.log(`Performance Results:`);
      console.log(`- Total requests: ${promises.length}`);
      console.log(`- Successful: ${successfulRequests.length}`);
      console.log(`- Failed: ${failedRequests.length}`);
      console.log(`- Total time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`- Average time per request: ${((endTime - startTime) / promises.length).toFixed(2)}ms`);
      
      // Performance assertions
      expect(successfulRequests.length).toBeGreaterThan(promises.length * 0.95); // 95% success rate
      expect(endTime - startTime).toBeLessThan(30000); // Complete within 30 seconds
      expect((endTime - startTime) / promises.length).toBeLessThan(1000); // Average < 1 second per request
    });

    it('should handle bulk post scheduling efficiently', async () => {
      const authToken = authTokens[0];
      const bulkPosts = [];
      
      // Create bulk post data
      for (let i = 0; i < POSTS_PER_USER; i++) {
        bulkPosts.push({
          content: `Bulk scheduled post ${i}`,
          platforms: ['facebook', 'instagram'],
          hashtags: ['#bulk', '#scheduled'],
          scheduledTime: new Date(Date.now() + (i * 300000)).toISOString() // 5 minutes apart
        });
      }

      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/posts/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ posts: bulkPosts })
        .expect(201);

      const endTime = performance.now();
      
      console.log(`Bulk Scheduling Performance:`);
      console.log(`- Posts scheduled: ${response.body.scheduledPosts.length}`);
      console.log(`- Time taken: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`- Time per post: ${((endTime - startTime) / bulkPosts.length).toFixed(2)}ms`);
      
      expect(response.body.scheduledPosts).toHaveLength(POSTS_PER_USER);
      expect(endTime - startTime).toBeLessThan(5000); // Complete within 5 seconds
      expect((endTime - startTime) / bulkPosts.length).toBeLessThan(250); // < 250ms per post
    });

    it('should handle high-frequency scheduler execution', async () => {
      const authToken = authTokens[0];
      
      // Create posts scheduled for immediate execution
      const immediatePosts = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Immediate post ${i}`,
            platforms: ['facebook'],
            scheduledTime: new Date(Date.now() + 1000).toISOString() // 1 second from now
          });
        
        immediatePosts.push(response.body.id);
      }

      // Wait for scheduler to process
      await new Promise(resolve => setTimeout(resolve, 5000));

      const startTime = performance.now();
      
      // Check execution status
      const statusPromises = immediatePosts.map(postId =>
        request(app)
          .get(`/api/posts/${postId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const statusResults = await Promise.all(statusPromises);
      const endTime = performance.now();
      
      const publishedPosts = statusResults.filter(r => r.body.status === 'published').length;
      const processingPosts = statusResults.filter(r => r.body.status === 'publishing').length;
      
      console.log(`Scheduler Performance:`);
      console.log(`- Posts processed: ${publishedPosts + processingPosts}/${immediatePosts.length}`);
      console.log(`- Status check time: ${(endTime - startTime).toFixed(2)}ms`);
      
      expect(publishedPosts + processingPosts).toBeGreaterThan(immediatePosts.length * 0.8); // 80% processed
    });
  });

  describe('Database Performance', () => {
    it('should handle large dataset queries efficiently', async () => {
      const authToken = authTokens[0];
      
      // Create a large number of posts for pagination testing
      const createPromises = [];
      for (let i = 0; i < 100; i++) {
        createPromises.push(
          request(app)
            .post('/api/posts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              content: `Database test post ${i}`,
              platforms: ['facebook'],
              status: 'published',
              publishedAt: new Date(Date.now() - (i * 3600000)).toISOString() // 1 hour apart
            })
        );
      }
      
      await Promise.all(createPromises);

      // Test pagination performance
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/posts?page=1&limit=20&sort=publishedAt&order=desc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = performance.now();
      
      console.log(`Database Query Performance:`);
      console.log(`- Query time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`- Results returned: ${response.body.posts.length}`);
      console.log(`- Total count: ${response.body.totalCount}`);
      
      expect(response.body.posts).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Query should complete within 1 second
    });

    it('should handle concurrent database operations', async () => {
      const concurrentOperations = [];
      
      // Mix of read and write operations
      for (let i = 0; i < 20; i++) {
        const authToken = authTokens[i % authTokens.length];
        
        if (i % 3 === 0) {
          // Read operation
          concurrentOperations.push(
            request(app)
              .get('/api/posts')
              .set('Authorization', `Bearer ${authToken}`)
          );
        } else {
          // Write operation
          concurrentOperations.push(
            request(app)
              .post('/api/posts')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                content: `Concurrent test post ${i}`,
                platforms: ['facebook']
              })
          );
        }
      }

      const startTime = performance.now();
      const results = await Promise.allSettled(concurrentOperations);
      const endTime = performance.now();
      
      const successfulOps = results.filter(r => r.status === 'fulfilled' && r.value.status < 400);
      
      console.log(`Concurrent Operations Performance:`);
      console.log(`- Total operations: ${concurrentOperations.length}`);
      console.log(`- Successful: ${successfulOps.length}`);
      console.log(`- Total time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`- Average time per operation: ${((endTime - startTime) / concurrentOperations.length).toFixed(2)}ms`);
      
      expect(successfulOps.length).toBeGreaterThan(concurrentOperations.length * 0.9); // 90% success rate
      expect(endTime - startTime).toBeLessThan(10000); // Complete within 10 seconds
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        const authToken = authTokens[i % authTokens.length];
        operations.push(
          request(app)
            .get('/api/posts/analytics')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      
      await Promise.all(operations);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory Usage:`);
      console.log(`- Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});