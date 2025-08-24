import { redis } from '../database/redis';
import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  serialize?: boolean;
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

export class CacheService {
  private static instance: CacheService;
  private defaultTTL = 3600; // 1 hour
  private defaultPrefix = 'sma:';
  
  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const client = redis.getClient();
      const fullKey = this.buildKey(key, options.prefix);
      
      const start = Date.now();
      const value = await client.get(fullKey);
      const duration = Date.now() - start;
      
      if (value === null) {
        this.stats.misses++;
        monitoringService.recordCacheMiss();
        monitoringService.recordTimer('cache_operation_duration', duration, { operation: 'get', result: 'miss' });
        return null;
      }

      this.stats.hits++;
      monitoringService.recordCacheHit();
      monitoringService.recordTimer('cache_operation_duration', duration, { operation: 'get', result: 'hit' });

      // Deserialize if needed
      if (options.serialize !== false) {
        try {
          return JSON.parse(value);
        } catch (error) {
          loggerService.warn('Failed to parse cached value', { key: fullKey, error });
          return value as T;
        }
      }

      return value as T;
    } catch (error) {
      this.stats.errors++;
      loggerService.error('Cache get error', error as Error, { key });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = redis.getClient();
      const fullKey = this.buildKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      
      let serializedValue: string;
      if (options.serialize !== false && typeof value !== 'string') {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = String(value);
      }

      const start = Date.now();
      await client.setEx(fullKey, ttl, serializedValue);
      const duration = Date.now() - start;
      
      this.stats.sets++;
      monitoringService.recordTimer('cache_operation_duration', duration, { operation: 'set' });
      
      return true;
    } catch (error) {
      this.stats.errors++;
      loggerService.error('Cache set error', error as Error, { key });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = redis.getClient();
      const fullKey = this.buildKey(key, options.prefix);
      
      const start = Date.now();
      const result = await client.del(fullKey);
      const duration = Date.now() - start;
      
      this.stats.deletes++;
      monitoringService.recordTimer('cache_operation_duration', duration, { operation: 'delete' });
      
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      loggerService.error('Cache delete error', error as Error, { key });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = redis.getClient();
      const fullKey = this.buildKey(key, options.prefix);
      
      const result = await client.exists(fullKey);
      return result > 0;
    } catch (error) {
      loggerService.error('Cache exists error', error as Error, { key });
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const client = redis.getClient();
      const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
      
      const start = Date.now();
      const values = await client.mGet(fullKeys);
      const duration = Date.now() - start;
      
      monitoringService.recordTimer('cache_operation_duration', duration, { operation: 'mget', count: keys.length });

      return values.map((value, index) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        
        if (options.serialize !== false) {
          try {
            return JSON.parse(value);
          } catch (error) {
            loggerService.warn('Failed to parse cached value in mget', { key: fullKeys[index], error });
            return value as T;
          }
        }

        return value as T;
      });
    } catch (error) {
      this.stats.errors++;
      loggerService.error('Cache mget error', error as Error, { keys });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = redis.getClient();
      const pipeline = client.multi();
      
      for (const { key, value, ttl } of keyValuePairs) {
        const fullKey = this.buildKey(key, options.prefix);
        const cacheTTL = ttl || options.ttl || this.defaultTTL;
        
        let serializedValue: string;
        if (options.serialize !== false && typeof value !== 'string') {
          serializedValue = JSON.stringify(value);
        } else {
          serializedValue = String(value);
        }
        
        pipeline.setEx(fullKey, cacheTTL, serializedValue);
      }

      const start = Date.now();
      await pipeline.exec();
      const duration = Date.now() - start;
      
      this.stats.sets += keyValuePairs.length;
      monitoringService.recordTimer('cache_operation_duration', duration, { operation: 'mset', count: keyValuePairs.length });
      
      return true;
    } catch (error) {
      this.stats.errors++;
      loggerService.error('Cache mset error', error as Error, { count: keyValuePairs.length });
      return false;
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number | null> {
    try {
      const client = redis.getClient();
      const fullKey = this.buildKey(key, options.prefix);
      
      const result = await client.incrBy(fullKey, amount);
      
      // Set TTL if this is a new key
      if (result === amount) {
        const ttl = options.ttl || this.defaultTTL;
        await client.expire(fullKey, ttl);
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      loggerService.error('Cache increment error', error as Error, { key });
      return null;
    }
  }

  /**
   * Get or set pattern - get value, if not exists, compute and cache it
   */
  async getOrSet<T = any>(
    key: string, 
    computeFn: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T | null> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    try {
      // Compute the value
      const computed = await computeFn();
      
      // Cache the computed value
      await this.set(key, computed, options);
      
      return computed;
    } catch (error) {
      loggerService.error('Cache getOrSet computation error', error as Error, { key });
      return null;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    try {
      const client = redis.getClient();
      const fullPattern = this.buildKey(pattern, options.prefix);
      
      const keys = await client.keys(fullPattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await client.del(keys);
      this.stats.deletes += result;
      
      return result;
    } catch (error) {
      this.stats.errors++;
      loggerService.error('Cache clear by pattern error', error as Error, { pattern });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const client = redis.getClient();
      const info = await client.info('memory');
      const keyspace = await client.info('keyspace');
      
      // Parse memory usage
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      // Parse total keys
      const keysMatch = keyspace.match(/keys=(\d+)/);
      const totalKeys = keysMatch ? parseInt(keysMatch[1]) : 0;
      
      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate,
        totalKeys,
        memoryUsage
      };
    } catch (error) {
      loggerService.error('Failed to get cache stats', error as Error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: this.stats.hits + this.stats.misses > 0 ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0,
        totalKeys: 0,
        memoryUsage: 0
      };
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmUpFunctions: Array<{ key: string; fn: () => Promise<any>; ttl?: number }>): Promise<void> {
    loggerService.info('Starting cache warm-up', { count: warmUpFunctions.length });
    
    const promises = warmUpFunctions.map(async ({ key, fn, ttl }) => {
      try {
        const value = await fn();
        await this.set(key, value, { ttl });
        loggerService.debug('Cache warm-up completed for key', { key });
      } catch (error) {
        loggerService.error('Cache warm-up failed for key', error as Error, { key });
      }
    });

    await Promise.allSettled(promises);
    loggerService.info('Cache warm-up completed');
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.defaultPrefix;
    return `${keyPrefix}${key}`;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();