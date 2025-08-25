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