import { loggerService } from './LoggerService';
import { circuitBreakerService } from './CircuitBreakerService';
import { HealthCheckService } from './HealthCheckService';
import { EventEmitter } from 'events';

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // in milliseconds
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  description?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    utilization: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    total: number;
    utilization: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  process: {
    uptime: number;
    pid: number;
    version: string;
  };
}

export interface ApplicationMetrics {
  timestamp: Date;
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  database: {
    connections: number;
    queries: number;
    slowQueries: number;
    averageQueryTime: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  circuitBreakers: Record<string, any>;
  errors: {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
}

export class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  private metrics: Map<string, MetricData[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private metricsRetentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval!: NodeJS.Timeout;
  private metricsCollectionInterval!: NodeJS.Timeout;

  // Application metrics counters
  private requestCount = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private totalResponseTime = 0;
  private databaseQueries = 0;
  private slowQueries = 0;
  private totalQueryTime = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private errorCounts: Map<string, number> = new Map();
  private endpointErrors: Map<string, number> = new Map();

  private constructor() {
    super();
    this.setupDefaultAlertRules();
    this.startMetricsCollection();
    this.startCleanupTask();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, type: MetricData['type'] = 'gauge', tags?: Record<string, string>): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: new Date(),
      tags,
      type
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    this.checkAlertRules(metric);

    // Emit metric event for real-time monitoring
    this.emit('metric', metric);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.recordMetric(name, value, 'counter', tags);
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, 'gauge', tags);
  }

  /**
   * Record a timer metric
   */
  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric(name, duration, 'timer', tags);
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, endpoint: string, statusCode: number, duration: number): void {
    this.requestCount++;
    this.totalResponseTime += duration;

    if (statusCode >= 200 && statusCode < 400) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
      const errorKey = `${statusCode}`;
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
      this.endpointErrors.set(endpoint, (this.endpointErrors.get(endpoint) || 0) + 1);
    }

    this.recordMetric('http_requests_total', 1, 'counter', { method, endpoint, status: statusCode.toString() });
    this.recordMetric('http_request_duration', duration, 'timer', { method, endpoint });
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(duration: number, slow: boolean = false): void {
    this.databaseQueries++;
    this.totalQueryTime += duration;

    if (slow) {
      this.slowQueries++;
    }

    this.recordMetric('database_queries_total', 1, 'counter');
    this.recordMetric('database_query_duration', duration, 'timer');
    
    if (slow) {
      this.recordMetric('database_slow_queries_total', 1, 'counter');
    }
  }

  /**
   * Record cache metrics
   */
  recordCacheHit(): void {
    this.cacheHits++;
    this.recordMetric('cache_hits_total', 1, 'counter');
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
    this.recordMetric('cache_misses_total', 1, 'counter');
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date(),
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: require('os').loadavg()
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        utilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      disk: {
        used: 0, // Would need additional library to get disk usage
        total: 0,
        utilization: 0
      },
      network: {
        bytesIn: 0, // Would need additional monitoring
        bytesOut: 0
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version
      }
    };
  }

  /**
   * Get application metrics
   */
  getApplicationMetrics(): ApplicationMetrics {
    const averageResponseTime = this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;
    const averageQueryTime = this.databaseQueries > 0 ? this.totalQueryTime / this.databaseQueries : 0;
    const hitRate = (this.cacheHits + this.cacheMisses) > 0 ? 
      (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 : 0;

    return {
      timestamp: new Date(),
      requests: {
        total: this.requestCount,
        successful: this.successfulRequests,
        failed: this.failedRequests,
        averageResponseTime
      },
      database: {
        connections: 0, // Would need to get from database connection pool
        queries: this.databaseQueries,
        slowQueries: this.slowQueries,
        averageQueryTime
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate
      },
      circuitBreakers: circuitBreakerService.getAllStats(),
      errors: {
        total: this.failedRequests,
        byType: Object.fromEntries(this.errorCounts),
        byEndpoint: Object.fromEntries(this.endpointErrors)
      }
    };
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getMonitoringDashboard(): Promise<{
    system: SystemMetrics;
    application: ApplicationMetrics;
    health: any;
    alerts: Alert[];
    circuitBreakers: Record<string, any>;
  }> {
    const [systemMetrics, health] = await Promise.all([
      this.getSystemMetrics(),
      HealthCheckService.performHealthCheck()
    ]);

    return {
      system: systemMetrics,
      application: this.getApplicationMetrics(),
      health,
      alerts: Array.from(this.alerts.values()).filter(alert => !alert.resolved),
      circuitBreakers: circuitBreakerService.getAllStats()
    };
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    loggerService.info(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      loggerService.info(`Alert rule removed`, { ruleId });
    }
    return removed;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
      loggerService.info(`Alert resolved: ${alert.ruleName}`, { alertId });
      return true;
    }
    return false;
  }

  /**
   * Check alert rules against a metric
   */
  private checkAlertRules(metric: MetricData): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metric !== metric.name) {
        continue;
      }

      const shouldAlert = this.evaluateCondition(metric.value, rule.condition, rule.threshold);
      
      if (shouldAlert) {
        this.triggerAlert(rule, metric.value);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, value: number): void {
    const alertId = `${rule.id}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      condition: rule.condition,
      severity: rule.severity,
      timestamp: new Date(),
      resolved: false,
      description: rule.description
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);
    
    loggerService.warn(`Alert triggered: ${rule.name}`, {
      alertId,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity
    });
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'error_rate',
        condition: 'gt',
        threshold: 5, // 5% error rate
        duration: 300000, // 5 minutes
        enabled: true,
        severity: 'high',
        description: 'Error rate is above 5%'
      },
      {
        id: 'high_response_time',
        name: 'High Response Time',
        metric: 'avg_response_time',
        condition: 'gt',
        threshold: 2000, // 2 seconds
        duration: 300000, // 5 minutes
        enabled: true,
        severity: 'medium',
        description: 'Average response time is above 2 seconds'
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        metric: 'memory_utilization',
        condition: 'gt',
        threshold: 85, // 85%
        duration: 600000, // 10 minutes
        enabled: true,
        severity: 'high',
        description: 'Memory utilization is above 85%'
      },
      {
        id: 'circuit_breaker_open',
        name: 'Circuit Breaker Open',
        metric: 'circuit_breaker_open',
        condition: 'gt',
        threshold: 0,
        duration: 0, // Immediate
        enabled: true,
        severity: 'critical',
        description: 'Circuit breaker is in open state'
      }
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        // Collect system metrics
        const systemMetrics = await this.getSystemMetrics();
        this.recordGauge('memory_utilization', systemMetrics.memory.utilization);
        this.recordGauge('cpu_usage', systemMetrics.cpu.usage);
        
        // Collect application metrics
        const appMetrics = this.getApplicationMetrics();
        this.recordGauge('avg_response_time', appMetrics.requests.averageResponseTime);
        
        if (appMetrics.requests.total > 0) {
          const errorRate = (appMetrics.requests.failed / appMetrics.requests.total) * 100;
          this.recordGauge('error_rate', errorRate);
        }

        // Check circuit breaker states
        const circuitBreakers = circuitBreakerService.getAllStats();
        for (const [name, stats] of Object.entries(circuitBreakers)) {
          this.recordGauge('circuit_breaker_open', stats.state === 'OPEN' ? 1 : 0, { name });
        }

      } catch (error) {
        loggerService.error('Failed to collect metrics', error as Error);
      }
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Start cleanup task for old metrics
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - this.metricsRetentionPeriod;
      
      for (const [name, metrics] of this.metrics.entries()) {
        const filteredMetrics = metrics.filter(metric => 
          metric.timestamp.getTime() > cutoffTime
        );
        
        if (filteredMetrics.length !== metrics.length) {
          this.metrics.set(name, filteredMetrics);
        }
      }

      // Clean up resolved alerts older than 24 hours
      for (const [id, alert] of this.alerts.entries()) {
        if (alert.resolved && alert.resolvedAt && 
            Date.now() - alert.resolvedAt.getTime() > this.metricsRetentionPeriod) {
          this.alerts.delete(id);
        }
      }
    }, 3600000); // Run every hour
  }

  /**
   * Shutdown monitoring service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    this.removeAllListeners();
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string, limit?: number): MetricData[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }
}

// Export singleton instance
export const monitoringService = MonitoringService.getInstance();