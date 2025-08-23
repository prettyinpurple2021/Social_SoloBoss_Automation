import { loggerService } from './LoggerService';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
  name: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  uptime: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private readonly startTime: Date = new Date();

  constructor(private config: CircuitBreakerConfig) {
    loggerService.info(`Circuit breaker initialized: ${config.name}`, {
      config: this.config
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        loggerService.info(`Circuit breaker transitioning to HALF_OPEN: ${this.config.name}`);
      } else {
        const error = new AppError(
          `Circuit breaker is OPEN for ${this.config.name}`,
          ErrorCode.SERVICE_UNAVAILABLE,
          503,
          ErrorSeverity.HIGH,
          true,
          {
            circuitBreaker: this.config.name,
            state: this.state,
            nextAttemptTime: this.nextAttemptTime
          }
        );
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.reset();
      loggerService.info(`Circuit breaker reset to CLOSED: ${this.config.name}`);
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = new Date();

    // Check if error should be ignored
    if (this.shouldIgnoreError(error)) {
      loggerService.debug(`Circuit breaker ignoring expected error: ${this.config.name}`, {
        error: error.message
      });
      return;
    }

    loggerService.warn(`Circuit breaker failure recorded: ${this.config.name}`, {
      error: error.message,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold
    });

    if (this.failureCount >= this.config.failureThreshold) {
      this.trip();
    }
  }

  /**
   * Trip the circuit breaker to OPEN state
   */
  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    
    loggerService.error(`Circuit breaker TRIPPED: ${this.config.name}`, undefined, {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      nextAttemptTime: this.nextAttemptTime
    });
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? Date.now() >= this.nextAttemptTime.getTime() : false;
  }

  /**
   * Check if an error should be ignored (not counted as failure)
   */
  private shouldIgnoreError(error: Error): boolean {
    if (!this.config.expectedErrors) {
      return false;
    }

    return this.config.expectedErrors.some(expectedError => 
      error.message.includes(expectedError) || 
      error.name.includes(expectedError)
    );
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force reset the circuit breaker (for testing/admin purposes)
   */
  forceReset(): void {
    this.reset();
    loggerService.info(`Circuit breaker force reset: ${this.config.name}`);
  }

  /**
   * Force trip the circuit breaker (for testing/admin purposes)
   */
  forceTrip(): void {
    this.trip();
    loggerService.info(`Circuit breaker force tripped: ${this.config.name}`);
  }
}

/**
 * Circuit Breaker Service for managing multiple circuit breakers
 */
export class CircuitBreakerService {
  private static instance: CircuitBreakerService;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  /**
   * Create or get a circuit breaker
   */
  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 10000, // 10 seconds
        name,
        ...config
      };

      this.circuitBreakers.set(name, new CircuitBreaker(defaultConfig));
    }

    return this.circuitBreakers.get(name)!;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    name: string, 
    fn: () => Promise<T>, 
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(name, config);
    return circuitBreaker.execute(fn);
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }

    return stats;
  }

  /**
   * Get statistics for a specific circuit breaker
   */
  getStats(name: string): CircuitBreakerStats | undefined {
    const circuitBreaker = this.circuitBreakers.get(name);
    return circuitBreaker?.getStats();
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.forceReset();
    }
    loggerService.info('All circuit breakers reset');
  }

  /**
   * Reset a specific circuit breaker
   */
  reset(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.forceReset();
      return true;
    }
    return false;
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.circuitBreakers.delete(name);
  }

  /**
   * Get list of all circuit breaker names
   */
  getCircuitBreakerNames(): string[] {
    return Array.from(this.circuitBreakers.keys());
  }
}

// Export singleton instance
export const circuitBreakerService = CircuitBreakerService.getInstance();

// Predefined circuit breakers for common services
export const CircuitBreakers = {
  FACEBOOK_API: 'facebook_api',
  INSTAGRAM_API: 'instagram_api',
  PINTEREST_API: 'pinterest_api',
  X_API: 'x_api',
  BLOGGER_API: 'blogger_api',
  SOLOBOSS_API: 'soloboss_api',
  DATABASE: 'database',
  REDIS: 'redis',
  FILE_UPLOAD: 'file_upload',
  EMAIL_SERVICE: 'email_service'
} as const;