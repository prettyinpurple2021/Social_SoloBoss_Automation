import { Config } from '../config';

export interface MetricTags {
  [key: string]: string | number;
}

export interface TimerMetric {
  name: string;
  value: number;
  tags?: MetricTags;
  timestamp: Date;
}

export interface CounterMetric {
  name: string;
  value: number;
  tags?: MetricTags;
  timestamp: Date;
}

export interface HistogramMetric {
  name: string;
  value: number;
  tags?: MetricTags;
  timestamp: Date;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Array<TimerMetric | CounterMetric | HistogramMetric> = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startMetricsFlush();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Record a timer metric (duration in milliseconds)
   */
  recordTimer(name: string, value: number, tags?: MetricTags): void {
    const metric: TimerMetric = {
      name,
      value,
      tags,
      timestamp: new Date()
    };

    this.metrics.push(metric);
    
    if (Config.isDevelopment) {
      console.log(`[TIMER] ${name}: ${value}ms`, tags);
    }
  }

  /**
   * Record a counter metric
   */
  recordCounter(name: string, value: number = 1, tags?: MetricTags): void {
    const metric: CounterMetric = {
      name,
      value,
      tags,
      timestamp: new Date()
    };

    this.metrics.push(metric);
    
    if (Config.isDevelopment) {
      console.log(`[COUNTER] ${name}: ${value}`, tags);
    }
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(name: string, value: number, tags?: MetricTags): void {
    const metric: HistogramMetric = {
      name,
      value,
      tags,
      timestamp: new Date()
    };

    this.metrics.push(metric);
    
    if (Config.isDevelopment) {
      console.log(`[HISTOGRAM] ${name}: ${value}`, tags);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): Array<TimerMetric | CounterMetric | HistogramMetric> {
    return [...this.metrics];
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalMetrics: number;
    timers: number;
    counters: number;
    histograms: number;
  } {
    const timers = this.metrics.filter(m => 'value' in m && typeof m.value === 'number').length;
    const counters = this.metrics.filter(m => 'value' in m && typeof m.value === 'number').length;
    const histograms = this.metrics.filter(m => 'value' in m && typeof m.value === 'number').length;

    return {
      totalMetrics: this.metrics.length,
      timers,
      counters,
      histograms
    };
  }

  /**
   * Start periodic metrics flush
   */
  private startMetricsFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush metrics every 60 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 60000);
  }

  /**
   * Flush metrics to external monitoring system
   */
  private async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    try {
      // In a real implementation, you would send metrics to your monitoring system
      // For now, we'll just log them in production and clear the buffer
      if (Config.isProduction) {
        console.log(`Flushing ${this.metrics.length} metrics to monitoring system`);
      }

      // Clear metrics after flushing
      this.clearMetrics();
    } catch (error) {
      console.error('Failed to flush metrics:', error);
    }
  }

  /**
   * Record a generic metric
   */
  recordMetric(name: string, value: number, type: 'counter' | 'timer' | 'histogram' | 'gauge', tags?: MetricTags): void {
    switch (type) {
      case 'counter':
        this.recordCounter(name, value, tags);
        break;
      case 'timer':
        this.recordTimer(name, value, tags);
        break;
      case 'histogram':
        this.recordHistogram(name, value, tags);
        break;
      case 'gauge':
        this.recordGauge(name, value, tags);
        break;
    }
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, tags?: MetricTags): void {
    const metric: HistogramMetric = {
      name,
      value,
      tags,
      timestamp: new Date()
    };

    this.metrics.push(metric);
    
    if (Config.isDevelopment) {
      console.log(`[GAUGE] ${name}: ${value}`, tags);
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: MetricTags): void {
    this.recordCounter(name, value, tags);
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.recordTimer('http_request_duration', duration, {
      method,
      path,
      status_code: statusCode
    });
    
    this.recordCounter('http_requests_total', 1, {
      method,
      path,
      status_code: statusCode
    });
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(duration: number, isSlowQuery: boolean = false): void {
    this.recordTimer('database_query_duration', duration, {
      slow_query: isSlowQuery ? 'true' : 'false'
    });
    
    this.recordCounter('database_queries_total', 1, {
      slow_query: isSlowQuery ? 'true' : 'false'
    });
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.recordCounter('cache_hits_total', 1);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.recordCounter('cache_misses_total', 1);
  }

  /**
   * Get monitoring dashboard data
   */
  async getMonitoringDashboard(): Promise<any> {
    return {
      metrics: this.getMetricsSummary(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<any> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get application metrics
   */
  getApplicationMetrics(): any {
    return {
      metrics: this.getMetricsSummary(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get active alerts (placeholder)
   */
  getActiveAlerts(): any[] {
    return [];
  }

  /**
   * Get alert rules (placeholder)
   */
  getAlertRules(): any[] {
    return [];
  }

  /**
   * Resolve alert (placeholder)
   */
  resolveAlert(alertId: string): boolean {
    console.log(`Resolving alert: ${alertId}`);
    return true;
  }

  /**
   * Get metric names
   */
  getMetricNames(): string[] {
    const names = new Set<string>();
    this.metrics.forEach(metric => names.add(metric.name));
    return Array.from(names);
  }

  /**
   * Shutdown monitoring service
   */
  shutdown(): void {
    this.stop();
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushMetrics();
  }
}

// Export singleton instance
export const monitoringService = MonitoringService.getInstance();