import axios from 'axios';
import { performance } from 'perf_hooks';

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  requestsPerUser: number;
  testDuration: number; // seconds
  endpoints: Array<{
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    headers?: Record<string, string>;
  }>;
}

interface LoadTestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: Array<{
    error: string;
    count: number;
  }>;
}

class LoadTester {
  private config: LoadTestConfig;
  private results: LoadTestResults;
  private responseTimes: number[] = [];
  private errors: Map<string, number> = new Map();

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      errors: []
    };
  }

  async runLoadTest(): Promise<LoadTestResults> {
    console.log(`Starting load test with ${this.config.concurrentUsers} concurrent users`);
    console.log(`Each user will make ${this.config.requestsPerUser} requests`);
    console.log(`Test duration: ${this.config.testDuration} seconds`);
    
    const startTime = performance.now();
    const endTime = startTime + (this.config.testDuration * 1000);
    
    // Create concurrent users
    const userPromises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      userPromises.push(this.simulateUser(i, endTime));
    }
    
    // Wait for all users to complete
    await Promise.allSettled(userPromises);
    
    const totalTime = (performance.now() - startTime) / 1000;
    
    // Calculate results
    this.calculateResults(totalTime);
    
    return this.results;
  }

  private async simulateUser(userId: number, endTime: number): Promise<void> {
    let requestCount = 0;
    
    while (performance.now() < endTime && requestCount < this.config.requestsPerUser) {
      // Select random endpoint
      const endpoint = this.config.endpoints[Math.floor(Math.random() * this.config.endpoints.length)];
      
      try {
        await this.makeRequest(endpoint);
        requestCount++;
        
        // Small delay between requests
        await this.sleep(Math.random() * 100); // 0-100ms
      } catch (error) {
        // Continue with next request even if one fails
      }
    }
  }

  private async makeRequest(endpoint: {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    headers?: Record<string, string>;
  }): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${this.config.baseUrl}${endpoint.path}`,
        data: endpoint.data,
        headers: endpoint.headers,
        timeout: 30000 // 30 second timeout
      });
      
      const responseTime = performance.now() - startTime;
      this.recordSuccess(responseTime);
      
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      this.recordError(error, responseTime);
    }
  }

  private recordSuccess(responseTime: number): void {
    this.results.totalRequests++;
    this.results.successfulRequests++;
    this.responseTimes.push(responseTime);
    
    this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
    this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
  }

  private recordError(error: any, responseTime: number): void {
    this.results.totalRequests++;
    this.results.failedRequests++;
    this.responseTimes.push(responseTime);
    
    const errorMessage = error.response?.status 
      ? `HTTP ${error.response.status}: ${error.response.statusText}`
      : error.message || 'Unknown error';
    
    const currentCount = this.errors.get(errorMessage) || 0;
    this.errors.set(errorMessage, currentCount + 1);
  }

  private calculateResults(totalTime: number): void {
    if (this.responseTimes.length > 0) {
      this.results.averageResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }
    
    this.results.requestsPerSecond = this.results.totalRequests / totalTime;
    this.results.errorRate = (this.results.failedRequests / this.results.totalRequests) * 100;
    
    // Convert errors map to array
    this.results.errors = Array.from(this.errors.entries()).map(([error, count]) => ({
      error,
      count
    }));
    
    if (this.results.minResponseTime === Infinity) {
      this.results.minResponseTime = 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example usage
async function runPerformanceTest() {
  const config: LoadTestConfig = {
    baseUrl: 'http://localhost:3001',
    concurrentUsers: 10,
    requestsPerUser: 50,
    testDuration: 60, // 1 minute
    endpoints: [
      {
        path: '/health',
        method: 'GET'
      },
      {
        path: '/api/performance/health',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token' // You'll need a valid token
        }
      },
      {
        path: '/api/performance/metrics',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      }
    ]
  };

  const loadTester = new LoadTester(config);
  
  try {
    console.log('Starting performance load test...');
    const results = await loadTester.runLoadTest();
    
    console.log('\n=== Load Test Results ===');
    console.log(`Total Requests: ${results.totalRequests}`);
    console.log(`Successful Requests: ${results.successfulRequests}`);
    console.log(`Failed Requests: ${results.failedRequests}`);
    console.log(`Success Rate: ${((results.successfulRequests / results.totalRequests) * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${results.errorRate.toFixed(2)}%`);
    console.log(`Average Response Time: ${results.averageResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${results.minResponseTime.toFixed(2)}ms`);
    console.log(`Max Response Time: ${results.maxResponseTime.toFixed(2)}ms`);
    console.log(`Requests Per Second: ${results.requestsPerSecond.toFixed(2)}`);
    
    if (results.errors.length > 0) {
      console.log('\n=== Errors ===');
      results.errors.forEach(({ error, count }) => {
        console.log(`${error}: ${count} occurrences`);
      });
    }
    
    // Performance benchmarks
    console.log('\n=== Performance Analysis ===');
    if (results.averageResponseTime < 500) {
      console.log('✅ Average response time is excellent (< 500ms)');
    } else if (results.averageResponseTime < 1000) {
      console.log('⚠️  Average response time is acceptable (< 1000ms)');
    } else {
      console.log('❌ Average response time is poor (> 1000ms)');
    }
    
    if (results.errorRate < 1) {
      console.log('✅ Error rate is excellent (< 1%)');
    } else if (results.errorRate < 5) {
      console.log('⚠️  Error rate is acceptable (< 5%)');
    } else {
      console.log('❌ Error rate is poor (> 5%)');
    }
    
    if (results.requestsPerSecond > 100) {
      console.log('✅ Throughput is excellent (> 100 RPS)');
    } else if (results.requestsPerSecond > 50) {
      console.log('⚠️  Throughput is acceptable (> 50 RPS)');
    } else {
      console.log('❌ Throughput is poor (< 50 RPS)');
    }
    
  } catch (error) {
    console.error('Load test failed:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runPerformanceTest().catch(console.error);
}

export { LoadTester, LoadTestConfig, LoadTestResults };