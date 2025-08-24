#!/usr/bin/env node

/**
 * Performance Regression Check Script
 * Compares current performance metrics with baseline and historical data
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  PERFORMANCE_FILE: 'packages/backend/performance-results.json',
  LOAD_TEST_FILE: 'load-test-results.json',
  BASELINE_FILE: 'performance-baseline.json',
  HISTORY_DIR: 'performance-history',
  THRESHOLDS: {
    RESPONSE_TIME_INCREASE: 0.2, // 20% increase threshold
    THROUGHPUT_DECREASE: 0.15,   // 15% decrease threshold
    ERROR_RATE_INCREASE: 0.05,   // 5% increase threshold
    MEMORY_INCREASE: 0.3,        // 30% increase threshold
    CPU_INCREASE: 0.25           // 25% increase threshold
  }
};

class PerformanceChecker {
  constructor() {
    this.results = {
      passed: true,
      issues: [],
      metrics: {},
      recommendations: []
    };
  }

  async run() {
    console.log('🔍 Starting performance regression check...');
    
    try {
      // Load current performance data
      const currentMetrics = await this.loadCurrentMetrics();
      
      // Load baseline data
      const baselineMetrics = await this.loadBaselineMetrics();
      
      // Load historical data
      const historicalMetrics = await this.loadHistoricalMetrics();
      
      // Perform regression analysis
      await this.analyzeResponseTime(currentMetrics, baselineMetrics);
      await this.analyzeThroughput(currentMetrics, baselineMetrics);
      await this.analyzeErrorRate(currentMetrics, baselineMetrics);
      await this.analyzeResourceUsage(currentMetrics, baselineMetrics);
      await this.analyzeLoadTestResults(currentMetrics);
      
      // Check trends
      await this.analyzeTrends(currentMetrics, historicalMetrics);
      
      // Save current metrics to history
      await this.saveToHistory(currentMetrics);
      
      // Generate report
      await this.generateReport();
      
      // Exit with appropriate code
      process.exit(this.results.passed ? 0 : 1);
      
    } catch (error) {
      console.error('❌ Performance check failed:', error.message);
      process.exit(1);
    }
  }

  async loadCurrentMetrics() {
    console.log('📊 Loading current performance metrics...');
    
    const performanceData = this.loadJsonFile(CONFIG.PERFORMANCE_FILE);
    const loadTestData = this.loadJsonFile(CONFIG.LOAD_TEST_FILE);
    
    return {
      timestamp: new Date().toISOString(),
      performance: performanceData,
      loadTest: loadTestData
    };
  }

  async loadBaselineMetrics() {
    console.log('📈 Loading baseline metrics...');
    
    if (!fs.existsSync(CONFIG.BASELINE_FILE)) {
      console.log('⚠️  No baseline file found, creating from current metrics...');
      return null;
    }
    
    return this.loadJsonFile(CONFIG.BASELINE_FILE);
  }

  async loadHistoricalMetrics() {
    console.log('📚 Loading historical metrics...');
    
    if (!fs.existsSync(CONFIG.HISTORY_DIR)) {
      fs.mkdirSync(CONFIG.HISTORY_DIR, { recursive: true });
      return [];
    }
    
    const historyFiles = fs.readdirSync(CONFIG.HISTORY_DIR)
      .filter(file => file.endsWith('.json'))
      .sort()
      .slice(-10); // Keep last 10 entries
    
    return historyFiles.map(file => 
      this.loadJsonFile(path.join(CONFIG.HISTORY_DIR, file))
    );
  }

  async analyzeResponseTime(current, baseline) {
    console.log('⏱️  Analyzing response time...');
    
    if (!baseline || !current.performance) return;
    
    const currentAvgTime = current.performance.averageResponseTime || 0;
    const baselineAvgTime = baseline.performance?.averageResponseTime || 0;
    
    if (baselineAvgTime === 0) return;
    
    const increase = (currentAvgTime - baselineAvgTime) / baselineAvgTime;
    
    this.results.metrics.responseTime = {
      current: currentAvgTime,
      baseline: baselineAvgTime,
      change: increase,
      changePercent: (increase * 100).toFixed(2)
    };
    
    if (increase > CONFIG.THRESHOLDS.RESPONSE_TIME_INCREASE) {
      this.results.passed = false;
      this.results.issues.push({
        type: 'response_time_regression',
        severity: 'high',
        message: `Response time increased by ${(increase * 100).toFixed(2)}% (${currentAvgTime}ms vs ${baselineAvgTime}ms baseline)`,
        threshold: `${(CONFIG.THRESHOLDS.RESPONSE_TIME_INCREASE * 100).toFixed(0)}%`,
        actual: `${(increase * 100).toFixed(2)}%`
      });
      
      this.results.recommendations.push(
        'Consider optimizing database queries and API endpoints',
        'Review recent code changes that might impact performance',
        'Check for resource constraints in the deployment environment'
      );
    }
  }

  async analyzeThroughput(current, baseline) {
    console.log('🚀 Analyzing throughput...');
    
    if (!baseline || !current.performance) return;
    
    const currentThroughput = current.performance.requestsPerSecond || 0;
    const baselineThroughput = baseline.performance?.requestsPerSecond || 0;
    
    if (baselineThroughput === 0) return;
    
    const decrease = (baselineThroughput - currentThroughput) / baselineThroughput;
    
    this.results.metrics.throughput = {
      current: currentThroughput,
      baseline: baselineThroughput,
      change: -decrease,
      changePercent: (-decrease * 100).toFixed(2)
    };
    
    if (decrease > CONFIG.THRESHOLDS.THROUGHPUT_DECREASE) {
      this.results.passed = false;
      this.results.issues.push({
        type: 'throughput_regression',
        severity: 'high',
        message: `Throughput decreased by ${(decrease * 100).toFixed(2)}% (${currentThroughput} vs ${baselineThroughput} req/s baseline)`,
        threshold: `${(CONFIG.THRESHOLDS.THROUGHPUT_DECREASE * 100).toFixed(0)}%`,
        actual: `${(decrease * 100).toFixed(2)}%`
      });
      
      this.results.recommendations.push(
        'Investigate bottlenecks in request processing',
        'Consider scaling up resources or optimizing algorithms',
        'Review database connection pooling and caching strategies'
      );
    }
  }

  async analyzeErrorRate(current, baseline) {
    console.log('🚨 Analyzing error rate...');
    
    if (!baseline || !current.performance) return;
    
    const currentErrorRate = current.performance.errorRate || 0;
    const baselineErrorRate = baseline.performance?.errorRate || 0;
    
    const increase = currentErrorRate - baselineErrorRate;
    
    this.results.metrics.errorRate = {
      current: currentErrorRate,
      baseline: baselineErrorRate,
      change: increase,
      changePercent: (increase * 100).toFixed(2)
    };
    
    if (increase > CONFIG.THRESHOLDS.ERROR_RATE_INCREASE) {
      this.results.passed = false;
      this.results.issues.push({
        type: 'error_rate_regression',
        severity: 'critical',
        message: `Error rate increased by ${(increase * 100).toFixed(2)}% (${(currentErrorRate * 100).toFixed(2)}% vs ${(baselineErrorRate * 100).toFixed(2)}% baseline)`,
        threshold: `${(CONFIG.THRESHOLDS.ERROR_RATE_INCREASE * 100).toFixed(2)}%`,
        actual: `${(increase * 100).toFixed(2)}%`
      });
      
      this.results.recommendations.push(
        'Investigate recent code changes for potential bugs',
        'Check external service dependencies and their health',
        'Review error logs for patterns and root causes'
      );
    }
  }

  async analyzeResourceUsage(current, baseline) {
    console.log('💾 Analyzing resource usage...');
    
    if (!baseline || !current.performance) return;
    
    // Memory usage analysis
    const currentMemory = current.performance.memoryUsage || 0;
    const baselineMemory = baseline.performance?.memoryUsage || 0;
    
    if (baselineMemory > 0) {
      const memoryIncrease = (currentMemory - baselineMemory) / baselineMemory;
      
      this.results.metrics.memoryUsage = {
        current: currentMemory,
        baseline: baselineMemory,
        change: memoryIncrease,
        changePercent: (memoryIncrease * 100).toFixed(2)
      };
      
      if (memoryIncrease > CONFIG.THRESHOLDS.MEMORY_INCREASE) {
        this.results.passed = false;
        this.results.issues.push({
          type: 'memory_regression',
          severity: 'medium',
          message: `Memory usage increased by ${(memoryIncrease * 100).toFixed(2)}% (${currentMemory}MB vs ${baselineMemory}MB baseline)`,
          threshold: `${(CONFIG.THRESHOLDS.MEMORY_INCREASE * 100).toFixed(0)}%`,
          actual: `${(memoryIncrease * 100).toFixed(2)}%`
        });
        
        this.results.recommendations.push(
          'Check for memory leaks in recent code changes',
          'Review caching strategies and data structures',
          'Consider optimizing object creation and garbage collection'
        );
      }
    }
    
    // CPU usage analysis
    const currentCpu = current.performance.cpuUsage || 0;
    const baselineCpu = baseline.performance?.cpuUsage || 0;
    
    if (baselineCpu > 0) {
      const cpuIncrease = (currentCpu - baselineCpu) / baselineCpu;
      
      this.results.metrics.cpuUsage = {
        current: currentCpu,
        baseline: baselineCpu,
        change: cpuIncrease,
        changePercent: (cpuIncrease * 100).toFixed(2)
      };
      
      if (cpuIncrease > CONFIG.THRESHOLDS.CPU_INCREASE) {
        this.results.passed = false;
        this.results.issues.push({
          type: 'cpu_regression',
          severity: 'medium',
          message: `CPU usage increased by ${(cpuIncrease * 100).toFixed(2)}% (${(currentCpu * 100).toFixed(1)}% vs ${(baselineCpu * 100).toFixed(1)}% baseline)`,
          threshold: `${(CONFIG.THRESHOLDS.CPU_INCREASE * 100).toFixed(0)}%`,
          actual: `${(cpuIncrease * 100).toFixed(2)}%`
        });
        
        this.results.recommendations.push(
          'Profile CPU-intensive operations and optimize algorithms',
          'Review database query performance and indexing',
          'Consider implementing more efficient data processing'
        );
      }
    }
  }

  async analyzeLoadTestResults(current) {
    console.log('🔥 Analyzing load test results...');
    
    if (!current.loadTest) return;
    
    const loadTest = current.loadTest;
    
    // Check for high error rates under load
    if (loadTest.summary && loadTest.summary.errors) {
      const errorRate = loadTest.summary.errors.rate || 0;
      
      if (errorRate > 0.01) { // 1% error rate threshold
        this.results.passed = false;
        this.results.issues.push({
          type: 'load_test_errors',
          severity: 'high',
          message: `High error rate under load: ${(errorRate * 100).toFixed(2)}%`,
          threshold: '1%',
          actual: `${(errorRate * 100).toFixed(2)}%`
        });
      }
    }
    
    // Check response time percentiles
    if (loadTest.summary && loadTest.summary.response_time) {
      const p95 = loadTest.summary.response_time.p95 || 0;
      const p99 = loadTest.summary.response_time.p99 || 0;
      
      if (p95 > 2000) { // 2 second threshold for P95
        this.results.issues.push({
          type: 'load_test_p95',
          severity: 'medium',
          message: `P95 response time under load is high: ${p95}ms`,
          threshold: '2000ms',
          actual: `${p95}ms`
        });
      }
      
      if (p99 > 5000) { // 5 second threshold for P99
        this.results.issues.push({
          type: 'load_test_p99',
          severity: 'medium',
          message: `P99 response time under load is high: ${p99}ms`,
          threshold: '5000ms',
          actual: `${p99}ms`
        });
      }
    }
  }

  async analyzeTrends(current, historical) {
    console.log('📈 Analyzing performance trends...');
    
    if (historical.length < 3) return; // Need at least 3 data points
    
    // Analyze response time trend
    const responseTimes = historical
      .map(h => h.performance?.averageResponseTime)
      .filter(rt => rt !== undefined)
      .slice(-5); // Last 5 measurements
    
    if (responseTimes.length >= 3) {
      const trend = this.calculateTrend(responseTimes);
      
      if (trend > 0.1) { // 10% upward trend
        this.results.issues.push({
          type: 'response_time_trend',
          severity: 'medium',
          message: `Response time shows upward trend over recent deployments`,
          trend: `+${(trend * 100).toFixed(1)}%`
        });
        
        this.results.recommendations.push(
          'Monitor performance closely in upcoming releases',
          'Consider performance optimization in the next sprint'
        );
      }
    }
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return slope / avgY; // Normalized slope
  }

  async saveToHistory(metrics) {
    console.log('💾 Saving metrics to history...');
    
    if (!fs.existsSync(CONFIG.HISTORY_DIR)) {
      fs.mkdirSync(CONFIG.HISTORY_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(CONFIG.HISTORY_DIR, `performance-${timestamp}.json`);
    
    fs.writeFileSync(filename, JSON.stringify(metrics, null, 2));
  }

  async generateReport() {
    console.log('📋 Generating performance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      status: this.results.passed ? 'PASSED' : 'FAILED',
      summary: {
        totalIssues: this.results.issues.length,
        criticalIssues: this.results.issues.filter(i => i.severity === 'critical').length,
        highIssues: this.results.issues.filter(i => i.severity === 'high').length,
        mediumIssues: this.results.issues.filter(i => i.severity === 'medium').length
      },
      metrics: this.results.metrics,
      issues: this.results.issues,
      recommendations: this.results.recommendations
    };
    
    // Save detailed report
    fs.writeFileSync('performance-regression-report.json', JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n📊 Performance Regression Check Results:');
    console.log('==========================================');
    console.log(`Status: ${report.status}`);
    console.log(`Total Issues: ${report.summary.totalIssues}`);
    
    if (report.summary.criticalIssues > 0) {
      console.log(`❌ Critical Issues: ${report.summary.criticalIssues}`);
    }
    if (report.summary.highIssues > 0) {
      console.log(`🔴 High Issues: ${report.summary.highIssues}`);
    }
    if (report.summary.mediumIssues > 0) {
      console.log(`🟡 Medium Issues: ${report.summary.mediumIssues}`);
    }
    
    if (this.results.issues.length > 0) {
      console.log('\n🔍 Issues Found:');
      this.results.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
        if (issue.threshold && issue.actual) {
          console.log(`   Threshold: ${issue.threshold}, Actual: ${issue.actual}`);
        }
      });
    }
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.results.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n📄 Detailed report saved to: performance-regression-report.json');
  }

  loadJsonFile(filepath) {
    try {
      if (!fs.existsSync(filepath)) {
        console.log(`⚠️  File not found: ${filepath}`);
        return null;
      }
      
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error loading ${filepath}:`, error.message);
      return null;
    }
  }
}

// Run the performance check
if (require.main === module) {
  const checker = new PerformanceChecker();
  checker.run().catch(error => {
    console.error('❌ Performance regression check failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceChecker;