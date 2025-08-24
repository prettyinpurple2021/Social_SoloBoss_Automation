import { Pool, PoolClient } from 'pg';
import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { cacheService } from './CacheService';

export interface QueryMetrics {
  query: string;
  executionTime: number;
  rowCount: number;
  timestamp: Date;
  cached: boolean;
}

export interface QueryOptimizationOptions {
  enableCache?: boolean;
  cacheTTL?: number;
  enableMetrics?: boolean;
  slowQueryThreshold?: number;
}

export class QueryOptimizationService {
  private static instance: QueryOptimizationService;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryThreshold = 1000; // 1 second
  private maxMetricsHistory = 1000;

  private constructor() {}

  static getInstance(): QueryOptimizationService {
    if (!QueryOptimizationService.instance) {
      QueryOptimizationService.instance = new QueryOptimizationService();
    }
    return QueryOptimizationService.instance;
  }

  /**
   * Execute optimized query with caching and metrics
   */
  async executeQuery<T = any>(
    pool: Pool,
    query: string,
    params: any[] = [],
    options: QueryOptimizationOptions = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, params);
    
    // Try cache first if enabled
    if (options.enableCache !== false) {
      const cached = await cacheService.get<T[]>(cacheKey);
      if (cached) {
        this.recordMetrics(query, Date.now() - startTime, cached.length, true);
        return cached;
      }
    }

    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      const result = await client.query(query, params);
      const executionTime = Date.now() - startTime;
      
      // Cache result if enabled
      if (options.enableCache !== false && result.rows.length > 0) {
        const ttl = options.cacheTTL || 300; // 5 minutes default
        await cacheService.set(cacheKey, result.rows, { ttl });
      }

      // Record metrics
      this.recordMetrics(query, executionTime, result.rows.length, false);
      
      // Log slow queries
      if (executionTime > (options.slowQueryThreshold || this.slowQueryThreshold)) {
        loggerService.warn('Slow query detected', {
          query: this.sanitizeQuery(query),
          executionTime,
          rowCount: result.rows.length
        });
      }

      return result.rows;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      loggerService.error('Query execution failed', error as Error, {
        query: this.sanitizeQuery(query),
        executionTime
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute query with connection pooling optimization
   */
  async executeTransaction<T>(
    pool: Pool,
    queries: Array<{ query: string; params?: any[] }>
  ): Promise<T[]> {
    const client = await pool.connect();
    const results: T[] = [];
    
    try {
      await client.query('BEGIN');
      
      for (const { query, params = [] } of queries) {
        const startTime = Date.now();
        const result = await client.query(query, params);
        const executionTime = Date.now() - startTime;
        
        results.push(result.rows as T);
        this.recordMetrics(query, executionTime, result.rows.length, false);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      loggerService.error('Transaction failed', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch execute queries for better performance
   */
  async executeBatch<T = any>(
    pool: Pool,
    queries: Array<{ query: string; params?: any[] }>,
    options: QueryOptimizationOptions = {}
  ): Promise<T[][]> {
    const batchSize = 10; // Process in batches of 10
    const results: T[][] = [];
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchPromises = batch.map(({ query, params = [] }) =>
        this.executeQuery<T>(pool, query, params, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQueryPerformance(pool: Pool, query: string, params: any[] = []): Promise<{
    executionPlan: any;
    suggestions: string[];
    estimatedCost: number;
  }> {
    const client = await pool.connect();
    
    try {
      // Get execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const planResult = await client.query(explainQuery, params);
      const executionPlan = planResult.rows[0]['QUERY PLAN'][0];
      
      // Analyze and generate suggestions
      const suggestions = this.generateOptimizationSuggestions(executionPlan);
      const estimatedCost = executionPlan['Total Cost'] || 0;
      
      return {
        executionPlan,
        suggestions,
        estimatedCost
      };
    } catch (error) {
      loggerService.error('Query analysis failed', error as Error, {
        query: this.sanitizeQuery(query)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    cacheHitRate: number;
    recentMetrics: QueryMetrics[];
  } {
    const totalQueries = this.queryMetrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries 
      : 0;
    
    const slowQueries = this.queryMetrics.filter(m => m.executionTime > this.slowQueryThreshold).length;
    const cachedQueries = this.queryMetrics.filter(m => m.cached).length;
    const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;
    
    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      cacheHitRate,
      recentMetrics: this.queryMetrics.slice(-50) // Last 50 queries
    };
  }

  /**
   * Clear query metrics history
   */
  clearMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Generate cache key for query and parameters
   */
  private generateCacheKey(query: string, params: any[]): string {
    const queryHash = Buffer.from(query).toString('base64').slice(0, 32);
    const paramsHash = Buffer.from(JSON.stringify(params)).toString('base64').slice(0, 16);
    return `query:${queryHash}:${paramsHash}`;
  }

  /**
   * Record query metrics
   */
  private recordMetrics(query: string, executionTime: number, rowCount: number, cached: boolean): void {
    const metric: QueryMetrics = {
      query: this.sanitizeQuery(query),
      executionTime,
      rowCount,
      timestamp: new Date(),
      cached
    };

    this.queryMetrics.push(metric);
    
    // Keep only recent metrics
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsHistory);
    }

    // Record monitoring metrics
    monitoringService.recordTimer('database_query_duration', executionTime, {
      cached: cached.toString(),
      slow: (executionTime > this.slowQueryThreshold).toString()
    });
    
    monitoringService.incrementCounter('database_queries_total', 1, {
      cached: cached.toString()
    });
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Replace parameter placeholders
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .slice(0, 200); // Limit length
  }

  /**
   * Generate optimization suggestions based on execution plan
   */
  private generateOptimizationSuggestions(executionPlan: any): string[] {
    const suggestions: string[] = [];
    
    // Check for sequential scans
    if (this.hasSequentialScan(executionPlan)) {
      suggestions.push('Consider adding indexes to avoid sequential scans');
    }
    
    // Check for high cost operations
    if (executionPlan['Total Cost'] > 1000) {
      suggestions.push('Query has high execution cost, consider optimization');
    }
    
    // Check for nested loops
    if (this.hasNestedLoop(executionPlan)) {
      suggestions.push('Nested loop detected, consider using hash joins or merge joins');
    }
    
    // Check for sorting operations
    if (this.hasSortOperation(executionPlan)) {
      suggestions.push('Sort operation detected, consider adding appropriate indexes');
    }
    
    return suggestions;
  }

  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') return true;
    if (plan.Plans) {
      return plan.Plans.some((subPlan: any) => this.hasSequentialScan(subPlan));
    }
    return false;
  }

  private hasNestedLoop(plan: any): boolean {
    if (plan['Node Type'] === 'Nested Loop') return true;
    if (plan.Plans) {
      return plan.Plans.some((subPlan: any) => this.hasNestedLoop(subPlan));
    }
    return false;
  }

  private hasSortOperation(plan: any): boolean {
    if (plan['Node Type'] === 'Sort') return true;
    if (plan.Plans) {
      return plan.Plans.some((subPlan: any) => this.hasSortOperation(subPlan));
    }
    return false;
  }
}

// Export singleton instance
export const queryOptimizationService = QueryOptimizationService.getInstance();