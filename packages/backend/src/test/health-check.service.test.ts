import { HealthCheckService } from '../services/HealthCheckService';
import { db } from '../database/connection';
import { redis } from '../database/redis';
import { loggerService } from '../services/LoggerService';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../database/redis');
jest.mock('../services/LoggerService');
jest.mock('axios');

describe('HealthCheckService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(10000); // Increase timeout for health checks
  });

  describe('Basic Health Check', () => {
    it('should return basic health status', async () => {
      const health = await HealthCheckService.getBasicHealth();
      
      expect(health).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('Database Health Check', () => {
    it('should return healthy status for successful database connection', async () => {
      // Mock successful database query
      (db.query as jest.Mock).mockResolvedValue({ rows: [{ test: 1 }] });
      (db as any).totalCount = 10;
      (db as any).idleCount = 5;
      (db as any).waitingCount = 0;

      const result = await HealthCheckService.checkService('database');
      
      expect(result.service).toBe('database');
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details).toEqual({
        connectionPool: {
          total: 10,
          idle: 5,
          waiting: 0,
        },
      });
    });

    it('should return degraded status for slow database response', async () => {
      // Mock slow database query
      (db.query as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [{ test: 1 }] }), 2500))
      );
      (db as any).totalCount = 10;
      (db as any).idleCount = 5;
      (db as any).waitingCount = 0;

      const result = await HealthCheckService.checkService('database');
      
      expect(result.service).toBe('database');
      expect(result.status).toBe('degraded');
      expect(result.responseTime).toBeGreaterThan(2000);
    });

    it('should return unhealthy status for database connection failure', async () => {
      // Mock database connection failure
      (db.query as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await HealthCheckService.checkService('database');
      
      expect(result.service).toBe('database');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection failed');
    });

    it('should handle database timeout', async () => {
      // Mock database query that never resolves
      (db.query as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const result = await HealthCheckService.checkService('database');
      
      expect(result.service).toBe('database');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Database timeout');
    });
  });

  describe('Redis Health Check', () => {
    it('should return healthy status for successful Redis connection', async () => {
      // Mock successful Redis ping
      (redis.ping as jest.Mock).mockResolvedValue('PONG');
      (redis.info as jest.Mock).mockResolvedValue('used_memory:1024\nused_memory_human:1K');
      (redis as any).isReady = true;

      const result = await HealthCheckService.checkService('redis');
      
      expect(result.service).toBe('redis');
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details).toEqual({
        memoryUsage: {
          used_memory: '1024',
          used_memory_human: '1K',
        },
        connected: true,
      });
    });

    it('should return degraded status for slow Redis response', async () => {
      // Mock slow Redis ping
      (redis.ping as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('PONG'), 1500))
      );
      (redis.info as jest.Mock).mockResolvedValue('used_memory:1024');
      (redis as any).isReady = true;

      const result = await HealthCheckService.checkService('redis');
      
      expect(result.service).toBe('redis');
      expect(result.status).toBe('degraded');
      expect(result.responseTime).toBeGreaterThan(1000);
    });

    it('should return unhealthy status for Redis connection failure', async () => {
      // Mock Redis connection failure
      (redis.ping as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const result = await HealthCheckService.checkService('redis');
      
      expect(result.service).toBe('redis');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Redis connection failed');
    });

    it('should handle Redis timeout', async () => {
      // Mock Redis ping that never resolves
      (redis.ping as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const result = await HealthCheckService.checkService('redis');
      
      expect(result.service).toBe('redis');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Redis timeout');
    });
  });

  describe('Memory Health Check', () => {
    it('should return healthy status for normal memory usage', async () => {
      // Mock process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 120 * 1024 * 1024, // 120MB
        arrayBuffers: 5 * 1024 * 1024, // 5MB
      });

      const result = await HealthCheckService.checkService('memory');
      
      expect(result.service).toBe('memory');
      expect(result.status).toBe('healthy');
      expect(result.details).toEqual({
        heapUsed: 50,
        heapTotal: 100,
        external: 10,
        utilization: 45, // (50 / (100 + 10)) * 100
      });

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should return degraded status for high memory usage', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 80 * 1024 * 1024, // 80MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 0,
        rss: 100 * 1024 * 1024,
        arrayBuffers: 0,
      });

      const result = await HealthCheckService.checkService('memory');
      
      expect(result.service).toBe('memory');
      expect(result.status).toBe('degraded');
      expect(result.details.utilization).toBe(80);

      process.memoryUsage = originalMemoryUsage;
    });

    it('should return unhealthy status for critical memory usage', async () => {
      // Mock critical memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 95 * 1024 * 1024, // 95MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 0,
        rss: 100 * 1024 * 1024,
        arrayBuffers: 0,
      });

      const result = await HealthCheckService.checkService('memory');
      
      expect(result.service).toBe('memory');
      expect(result.status).toBe('unhealthy');
      expect(result.details.utilization).toBe(95);

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Disk Health Check', () => {
    it('should return healthy status when disk is writable', async () => {
      // Mock fs operations
      const mockFs = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined),
      };
      jest.doMock('fs/promises', () => mockFs);

      const result = await HealthCheckService.checkService('disk');
      
      expect(result.service).toBe('disk');
      expect(result.status).toBe('healthy');
      expect(result.details).toEqual({
        writable: true,
      });
    });

    it('should return unhealthy status when disk is not writable', async () => {
      // Mock fs operations to fail
      const mockFs = {
        writeFile: jest.fn().mockRejectedValue(new Error('Disk full')),
        unlink: jest.fn().mockResolvedValue(undefined),
      };
      jest.doMock('fs/promises', () => mockFs);

      const result = await HealthCheckService.checkService('disk');
      
      expect(result.service).toBe('disk');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Disk full');
    });
  });

  describe('External APIs Health Check', () => {
    it('should return healthy status for successful external API call', async () => {
      // Mock axios
      const axios = require('axios');
      axios.default.get = jest.fn().mockResolvedValue({ status: 200 });

      const result = await HealthCheckService.checkService('external_apis');
      
      expect(result.service).toBe('external_apis');
      expect(result.status).toBe('healthy');
      expect(result.details).toEqual({
        internetConnectivity: true,
      });
    });

    it('should return degraded status for slow external API response', async () => {
      // Mock slow axios response
      const axios = require('axios');
      axios.default.get = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ status: 200 }), 3500))
      );

      const result = await HealthCheckService.checkService('external_apis');
      
      expect(result.service).toBe('external_apis');
      expect(result.status).toBe('degraded');
      expect(result.responseTime).toBeGreaterThan(3000);
    });

    it('should return degraded status for external API failure', async () => {
      // Mock axios failure
      const axios = require('axios');
      axios.default.get = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await HealthCheckService.checkService('external_apis');
      
      expect(result.service).toBe('external_apis');
      expect(result.status).toBe('degraded'); // External API issues are degraded, not unhealthy
      expect(result.error).toBe('Network error');
    });
  });

  describe('Comprehensive Health Check', () => {
    it('should return overall healthy status when all services are healthy', async () => {
      // Mock all services as healthy
      (db.query as jest.Mock).mockResolvedValue({ rows: [{ test: 1 }] });
      (db as any).totalCount = 10;
      (db as any).idleCount = 5;
      (db as any).waitingCount = 0;
      
      (redis.ping as jest.Mock).mockResolvedValue('PONG');
      (redis.info as jest.Mock).mockResolvedValue('used_memory:1024');
      (redis as any).isReady = true;

      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const mockFs = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined),
      };
      jest.doMock('fs/promises', () => mockFs);

      const axios = require('axios');
      axios.default.get = jest.fn().mockResolvedValue({ status: 200 });

      const health = await HealthCheckService.performHealthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.services).toHaveLength(5);
      expect(health.summary.healthy).toBe(5);
      expect(health.summary.unhealthy).toBe(0);
      expect(health.summary.degraded).toBe(0);
      expect(health.summary.total).toBe(5);

      process.memoryUsage = originalMemoryUsage;
    });

    it('should return overall degraded status when some services are degraded', async () => {
      // Mock database as degraded (slow response)
      (db.query as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [{ test: 1 }] }), 2500))
      );
      (db as any).totalCount = 10;
      (db as any).idleCount = 5;
      (db as any).waitingCount = 0;

      // Mock other services as healthy
      (redis.ping as jest.Mock).mockResolvedValue('PONG');
      (redis.info as jest.Mock).mockResolvedValue('used_memory:1024');
      (redis as any).isReady = true;

      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const mockFs = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined),
      };
      jest.doMock('fs/promises', () => mockFs);

      const axios = require('axios');
      axios.default.get = jest.fn().mockResolvedValue({ status: 200 });

      const health = await HealthCheckService.performHealthCheck();
      
      expect(health.status).toBe('degraded');
      expect(health.summary.healthy).toBe(4);
      expect(health.summary.degraded).toBe(1);
      expect(health.summary.unhealthy).toBe(0);

      process.memoryUsage = originalMemoryUsage;
    });

    it('should return overall unhealthy status when any service is unhealthy', async () => {
      // Mock database as unhealthy
      (db.query as jest.Mock).mockRejectedValue(new Error('Database down'));

      // Mock other services as healthy
      (redis.ping as jest.Mock).mockResolvedValue('PONG');
      (redis.info as jest.Mock).mockResolvedValue('used_memory:1024');
      (redis as any).isReady = true;

      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const mockFs = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined),
      };
      jest.doMock('fs/promises', () => mockFs);

      const axios = require('axios');
      axios.default.get = jest.fn().mockResolvedValue({ status: 200 });

      const health = await HealthCheckService.performHealthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.summary.healthy).toBe(4);
      expect(health.summary.unhealthy).toBe(1);
      expect(health.summary.degraded).toBe(0);
      expect(loggerService.warn).toHaveBeenCalledWith(
        'System health check failed',
        { health }
      );

      process.memoryUsage = originalMemoryUsage;
    });

    it('should include system metadata in health response', async () => {
      // Mock all services as healthy
      (db.query as jest.Mock).mockResolvedValue({ rows: [{ test: 1 }] });
      (db as any).totalCount = 10;
      (db as any).idleCount = 5;
      (db as any).waitingCount = 0;
      
      (redis.ping as jest.Mock).mockResolvedValue('PONG');
      (redis.info as jest.Mock).mockResolvedValue('used_memory:1024');
      (redis as any).isReady = true;

      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const mockFs = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined),
      };
      jest.doMock('fs/promises', () => mockFs);

      const axios = require('axios');
      axios.default.get = jest.fn().mockResolvedValue({ status: 200 });

      const health = await HealthCheckService.performHealthCheck();
      
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('version');
      expect(health.uptime).toBeGreaterThan(0);

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown service', async () => {
      await expect(HealthCheckService.checkService('unknown-service'))
        .rejects.toThrow('Unknown service: unknown-service');
    });

    it('should handle service check failures gracefully in comprehensive check', async () => {
      // Mock all services to fail
      (db.query as jest.Mock).mockRejectedValue(new Error('DB error'));
      (redis.ping as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory error');
      });

      const health = await HealthCheckService.performHealthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.services.every(s => s.status === 'unhealthy')).toBe(true);

      process.memoryUsage = originalMemoryUsage;
    });
  });
});
