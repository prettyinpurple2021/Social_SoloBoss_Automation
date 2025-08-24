import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { cacheService } from './CacheService';
import { queryOptimizationService } from './QueryOptimizationService';

export interface PerformanceBenchmarks {
  maxResponseTime: number; // milliseconds
  maxConcurrentRequests: number;
  maxMemoryUsage: number; // bytes
  maxCpuUsage: number; // percentage
}

export interface ResourceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queueLength: number;
  responseTime: number;
}

export interface LoadBalancingConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  queueTimeout: number;
  enableThrottling: boolean;
}

export class PerformanceService {
  private static instance: PerformanceService;
  private activeRequests = 0;
  private requestQueue: Array<{ resolve: Function; reject: Function; timestamp: number }> = [];
  private resourceMetrics: ResourceMetrics[] = [];
  private maxMetricsHistory = 1000;
  
  private benchmarks: PerformanceBenchmarks = {
    maxResponseTime: 2000, // 2 seconds
    maxConcurrentRequests: 100,
    maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
    maxCpuUsage: 80 // 80%
  };

  private loadBalancingConfig: LoadBalancingConfig = {
    maxConcurrentRequests: 50,
    requestTimeout: 30000, // 30 seconds
    queueTimeout: 10000, // 10 seconds
    enableThrottling: true
  };

  private constructor() {
    // Start resource monitoring
    this.startResourceMonitoring();
  }

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  /**
   * Execute request with load balancing and throttling
   */
  async executeWithLoadBalancing<T>(
    operation: () => Promise<T>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    // Check if we can execute immediately
    if (this.activeRequests < this.loadBalancingConfig.maxConcurrentRequests) {
      return this.executeRequest(operation);
    }

    // Queue the request if throttling is enabled
    if (this.loadBalancingConfig.enableThrottling) {
      return this.queueRequest(operation, priority);
    }

    // Execute immediately if throttling is disabled (may cause performance issues)
    return this.executeRequest(operation);
  }

  /**
   * Execute request with performance monitoring
   */
  private async executeRequest<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.activeRequests++;

    try {
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise<T>(this.loadBalancingConfig.requestTimeout)
      ]);

      const responseTime = Date.now() - startTime;
      this.recordPerformanceMetrics(responseTime, true);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordPerformanceMetrics(responseTime, false);
      throw error;
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Queue request when system is at capacity
   */
  private async queueRequest<T>(
    operation: () => Promise<T>,
    priority: 'high' | 'normal' | 'low'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queueItem = {
        resolve: async () => {
          try {
            const result = await this.executeRequest(operation);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        reject,
        timestamp: Date.now()
      };

      // Insert based on priority
      if (priority === 'high') {
        this.requestQueue.unshift(queueItem);
      } else {
        this.requestQueue.push(queueItem);
      }

      // Set queue timeout
      setTimeout(() => {
        const index = this.requestQueue.indexOf(queueItem);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Request queue timeout'));
        }
      }, this.loadBalancingConfig.queueTimeout);
    });
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (
      this.requestQueue.length > 0 && 
      this.activeRequests < this.loadBalancingConfig.maxConcurrentRequests
    ) {
      const queueItem = this.requestQueue.shift();
      if (queueItem) {
        // Check if request hasn't timed out
        if (Date.now() - queueItem.timestamp < this.loadBalancingConfig.queueTimeout) {
          queueItem.resolve();
        } else {
          queueItem.reject(new Error('Request queue timeout'));
        }
      }
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Record performance metrics
   */
  private recordPerformanceMetrics(responseTime: number, success: boolean): void {
    const metrics: ResourceMetrics = {
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to milliseconds
      activeConnections: this.activeRequests,
      queueLength: this.requestQueue.length,
      responseTime
    };

    this.resourceMetrics.push(metrics);
    
    // Keep only recent metrics
    if (this.resourceMetrics.length > this.maxMetricsHistory) {
      this.resourceMetrics = this.resourceMetrics.slice(-this.maxMetricsHistory);
    }

    // Record monitoring metrics
    monitoringService.recordTimer('request_duration', responseTime, {
      success: success.toString()
    });
    
    monitoringService.recordGauge('active_requests', this.activeRequests);
    monitoringService.recordGauge('request_queue_length', this.requestQueue.length);
    monitoringService.recordGauge('memory_usage_bytes', metrics.memoryUsage);

    // Check performance benchmarks
    this.checkPerformanceBenchmarks(metrics);
  }

  /**
   * Check if performance benchmarks are being met
   */
  private checkPerformanceBenchmarks(metrics: ResourceMetrics): void {
    const alerts: string[] = [];

    if (metrics.responseTime > this.benchmarks.maxResponseTime) {
      alerts.push(`Response time ${metrics.responseTime}ms exceeds benchmark ${this.benchmarks.maxResponseTime}ms`);
    }

    if (metrics.activeConnections > this.benchmarks.maxConcurrentRequests) {
      alerts.push(`Active connections ${metrics.activeConnections} exceeds benchmark ${this.benchmarks.maxConcurrentRequests}`);
    }

    if (metrics.memoryUsage > this.benchmarks.maxMemoryUsage) {
      alerts.push(`Memory usage ${metrics.memoryUsage} bytes exceeds benchmark ${this.benchmarks.maxMemoryUsage} bytes`);
    }

    if (alerts.length > 0) {
      loggerService.warn('Performance benchmark violations detected', { alerts, metrics });
      monitoringService.recordCounter('performance_benchmark_violations', alerts.length);
    }
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      monitoringService.recordGauge('memory_heap_used', memoryUsage.heapUsed);
      monitoringService.recordGauge('memory_heap_total', memoryUsage.heapTotal);
      monitoringService.recordGauge('memory_external', memoryUsage.external);
      monitoringService.recordGauge('cpu_user_time', cpuUsage.user);
      monitoringService.recordGauge('cpu_system_time', cpuUsage.system);
    }, 10000); // Every 10 seconds
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): {
    current: ResourceMetrics;
    averages: ResourceMetrics;
    benchmarks: PerformanceBenchmarks;
    queueStatus: {
      length: number;
      maxWaitTime: number;
    };
  } {
    const recent = this.resourceMetrics.slice(-10); // Last 10 metrics
    const current = recent[recent.length - 1] || {
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: this.activeRequests,
      queueLength: this.requestQueue.length,
      responseTime: 0
    };

    const averages: ResourceMetrics = {
      memoryUsage: recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length || 0,
      cpuUsage: recent.reduce((sum, m) => sum + m.cpuUsage, 0) / recent.length || 0,
      activeConnections: recent.reduce((sum, m) => sum + m.activeConnections, 0) / recent.length || 0,
      queueLength: recent.reduce((sum, m) => sum + m.queueLength, 0) / recent.length || 0,
      responseTime: recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length || 0
    };

    const maxWaitTime = this.requestQueue.length > 0 
      ? Math.max(...this.requestQueue.map(item => Date.now() - item.timestamp))
      : 0;

    return {
      current,
      averages,
      benchmarks: this.benchmarks,
      queueStatus: {
        length: this.requestQueue.length,
        maxWaitTime
      }
    };
  }

  /**
   * Update performance benchmarks
   */
  updateBenchmarks(benchmarks: Partial<PerformanceBenchmarks>): void {
    this.benchmarks = { ...this.benchmarks, ...benchmarks };
    loggerService.info('Performance benchmarks updated', { benchmarks: this.benchmarks });
  }

  /**
   * Update load balancing configuration
   */
  updateLoadBalancingConfig(config: Partial<LoadBalancingConfig>): void {
    this.loadBalancingConfig = { ...this.loadBalancingConfig, ...config };
    loggerService.info('Load balancing configuration updated', { config: this.loadBalancingConfig });
  }

  /**
   * Get system health status based on performance metrics
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.getPerformanceMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check response time
    if (metrics.averages.responseTime > this.benchmarks.maxResponseTime) {
      issues.push('High response times detected');
      recommendations.push('Consider scaling up resources or optimizing queries');
    }

    // Check memory usage
    if (metrics.current.memoryUsage > this.benchmarks.maxMemoryUsage * 0.8) {
      issues.push('High memory usage detected');
      recommendations.push('Consider increasing memory allocation or optimizing memory usage');
    }

    // Check queue length
    if (metrics.current.queueLength > 10) {
      issues.push('High request queue length');
      recommendations.push('Consider increasing concurrent request limit or scaling horizontally');
    }

    // Check cache performance
    cacheService.getStats().then(cacheStats => {
      if (cacheStats.hitRate < 70) {
        issues.push('Low cache hit rate');
        recommendations.push('Review caching strategy and TTL settings');
      }
    });

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 2) {
      status = 'unhealthy';
    } else if (issues.length > 0) {
      status = 'degraded';
    }

    return { status, issues, recommendations };
  }

  /**
   * Clear performance metrics history
   */
  clearMetrics(): void {
    this.resourceMetrics = [];
    queryOptimizationService.clearMetrics();
    cacheService.resetStats();
  }
}

// Export singleton instance
export const performanceService = PerformanceService.getInstance();