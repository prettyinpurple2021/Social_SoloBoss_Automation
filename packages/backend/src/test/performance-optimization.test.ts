import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performanceService } from '../services/PerformanceService';
import { cacheService } from '../services/CacheService';
import { queryOptimizationService } from '../services/QueryOptimizationService';
import { Pool } from 'pg';

// Mock dependencies
jest.mock('../services/LoggerService');
jest.mock('../services/MonitoringService');
jest.mock('../database/redis');

describe('Performance Optimization', () => {
  beforeEach(() => {
    // Reset services before each test
    performanceService.clearMetrics();
    cacheService.resetStats();
    queryOptimizationService.clearMetrics();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PerformanceService', () => {
    it('should handle concurrent requests with load balancing', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        () => Promise.resolve(`result-${i}`)
      );

      const startTime = Date.now();
      const results = await Promise.all(
        operations.map(op => performanceService.executeWithLoadBalancing(op))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(results.every(result => typeof result === 'string')).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should queue requests when at capacity', async () => {
      // Update config to have low concurrent request limit
      performanceService.updateLoadBalancingConfig({
        maxConcurrentRequests: 2,
        queueTimeout: 5000
      });

      const slowOperation = () => new Promise(resolve => 
        setTimeout(() => resolve('slow-result'), 100)
      );

      const operations = Array.from({ length: 5 }, () => slowOperation);
      
      const startTime = Date.now();
      const results = await Promise.all(
        operations.map(op => performanceService.executeWithLoadBalancing(op))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(results.every(result => result === 'slow-result')).toBe(true);
      // Should take longer due to queuing
      expect(endTime - startTime).toBeGreaterThan(200);
    });

    it('should timeout requests that take too long', async () => {
      performanceService.updateLoadBalancingConfig({
        requestTimeout: 100 // 100ms timeout
      });

      const slowOperation = () => new Promise(resolve => 
        setTimeout(() => resolve('should-timeout'), 200)
      );

      await expect(
        performanceService.executeWithLoadBalancing(slowOperation)
      ).rejects.toThrow('Request timeout');
    });

    it('should provide accurate performance metrics', async () => {
      // Execute some operations
      await performanceService.executeWithLoadBalancing(() => Promise.resolve('test1'));
      await performanceService.executeWithLoadBalancing(() => Promise.resolve('test2'));

      const metrics = performanceService.getPerformanceMetrics();

      expect(metrics.current).toBeDefined();
      expect(metrics.averages).toBeDefined();
      expect(metrics.benchmarks).toBeDefined();
      expect(metrics.queueStatus).toBeDefined();
      expect(typeof metrics.current.responseTime).toBe('number');
    });

    it('should detect performance benchmark violations', async () => {
      // Set very strict benchmarks
      performanceService.updateBenchmarks({
        maxResponseTime: 1, // 1ms - very strict
        maxConcurrentRequests: 1
      });

      const slowOperation = () => new Promise(resolve => 
        setTimeout(() => resolve('slow'), 10)
      );

      await performanceService.executeWithLoadBalancing(slowOperation);

      const healthStatus = performanceService.getHealthStatus();
      expect(healthStatus.issues.length).toBeGreaterThan(0);
    });
  });

  describe('CacheService', () => {
    it('should cache and retrieve values correctly', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };

      // Set value
      const setResult = await cacheService.set(key, value, { ttl: 60 });
      expect(setResult).toBe(true);

      // Get value
      const retrievedValue = await cacheService.get(key);
      expect(retrievedValue).toEqual(value);
    });

    it('should handle cache misses gracefully', async () => {
      const nonExistentKey = 'non-existent-key';
      const result = await cacheService.get(nonExistentKey);
      expect(result).toBeNull();
    });

    it('should support getOrSet pattern', async () => {
      const key = 'compute-key';
      const computeFn = jest.fn(() => Promise.resolve('computed-value'));

      // First call should compute
      const result1 = await cacheService.getOrSet(key, computeFn, { ttl: 60 });
      expect(result1).toBe('computed-value');
      expect(computeFn).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await cacheService.getOrSet(key, computeFn, { ttl: 60 });
      expect(result2).toBe('computed-value');
      expect(computeFn).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle multiple get/set operations', async () => {
      const keyValuePairs = [
        { key: 'key1', value: 'value1', ttl: 60 },
        { key: 'key2', value: 'value2', ttl: 60 },
        { key: 'key3', value: 'value3', ttl: 60 }
      ];

      // Set multiple values
      const setResult = await cacheService.mset(keyValuePairs);
      expect(setResult).toBe(true);

      // Get multiple values
      const keys = keyValuePairs.map(pair => pair.key);
      const values = await cacheService.mget(keys);
      
      expect(values).toHaveLength(3);
      expect(values[0]).toBe('value1');
      expect(values[1]).toBe('value2');
      expect(values[2]).toBe('value3');
    });

    it('should provide accurate cache statistics', async () => {
      // Perform some cache operations
      await cacheService.set('stats-key-1', 'value1');
      await cacheService.set('stats-key-2', 'value2');
      await cacheService.get('stats-key-1'); // Hit
      await cacheService.get('non-existent'); // Miss

      const stats = await cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  describe('QueryOptimizationService', () => {
    let mockPool: jest.Mocked<Pool>;

    beforeEach(() => {
      mockPool = {
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn()
      } as any;
    });

    it('should execute queries with caching', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 1, name: 'test' }] }),
        release: jest.fn()
      };
      
      mockPool.connect.mockResolvedValue(mockClient as any);

      const query = 'SELECT * FROM users WHERE id = $1';
      const params = [1];

      // First execution should hit database
      const result1 = await queryOptimizationService.executeQuery(
        mockPool, 
        query, 
        params, 
        { enableCache: true }
      );

      expect(result1).toEqual([{ id: 1, name: 'test' }]);
      expect(mockClient.query).toHaveBeenCalledWith(query, params);

      // Second execution should use cache (mock won't be called again)
      const result2 = await queryOptimizationService.executeQuery(
        mockPool, 
        query, 
        params, 
        { enableCache: true }
      );

      expect(result2).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should handle query execution errors', async () => {
      const mockClient = {
        query: jest.fn().mockRejectedValue(new Error('Database error')),
        release: jest.fn()
      };
      
      mockPool.connect.mockResolvedValue(mockClient as any);

      const query = 'SELECT * FROM invalid_table';
      
      await expect(
        queryOptimizationService.executeQuery(mockPool, query)
      ).rejects.toThrow('Database error');
    });

    it('should execute transactions correctly', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // First query
          .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Second query
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };
      
      mockPool.connect.mockResolvedValue(mockClient as any);

      const queries = [
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['user1'] },
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['user2'] }
      ];

      const results = await queryOptimizationService.executeTransaction(mockPool, queries);

      expect(results).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should provide query performance metrics', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
        release: jest.fn()
      };
      
      mockPool.connect.mockResolvedValue(mockClient as any);

      // Execute some queries
      await queryOptimizationService.executeQuery(mockPool, 'SELECT 1');
      await queryOptimizationService.executeQuery(mockPool, 'SELECT 2');

      const metrics = queryOptimizationService.getQueryMetrics();

      expect(metrics.totalQueries).toBe(2);
      expect(typeof metrics.averageExecutionTime).toBe('number');
      expect(typeof metrics.slowQueries).toBe('number');
      expect(typeof metrics.cacheHitRate).toBe('number');
      expect(Array.isArray(metrics.recentMetrics)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle high concurrent load', async () => {
      const concurrentOperations = 50;
      const operations = Array.from({ length: concurrentOperations }, (_, i) => 
        async () => {
          // Simulate mixed operations
          await cacheService.set(`load-test-${i}`, `value-${i}`);
          const cached = await cacheService.get(`load-test-${i}`);
          return cached;
        }
      );

      const startTime = Date.now();
      const results = await Promise.all(
        operations.map(op => performanceService.executeWithLoadBalancing(op))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(concurrentOperations);
      expect(results.every(result => typeof result === 'string')).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain performance under sustained load', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await performanceService.executeWithLoadBalancing(async () => {
          await cacheService.set(`sustained-${i}`, `value-${i}`);
          return await cacheService.get(`sustained-${i}`);
        });
        
        responseTimes.push(Date.now() - startTime);
      }

      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      expect(averageResponseTime).toBeLessThan(100); // Average should be under 100ms
      expect(maxResponseTime).toBeLessThan(1000); // Max should be under 1 second
    });
  });
});