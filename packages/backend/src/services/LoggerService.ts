import winston from 'winston';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  trace: 'cyan',
};

// Tell winston that you want to link the colors
winston.addColors(logColors);

// Async local storage for request context
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export interface RequestContext {
  requestId: string;
  traceId: string;
  spanId: string;
  userId?: string;
  operation?: string;
  startTime: number;
  parentSpanId?: string;
}

export interface LogContext {
  userId?: string;
  postId?: string;
  platform?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

export interface StructuredLogEntry {
  level: string;
  message: string;
  timestamp: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context?: LogContext;
  service: string;
  version: string;
  environment: string;
  hostname: string;
  pid: number;
}

// Enhanced log format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const context = asyncLocalStorage.getStore();
    const structured: StructuredLogEntry = {
      level: info.level,
      message: info.message,
      timestamp: info.timestamp,
      requestId: context?.requestId || info.requestId,
      traceId: context?.traceId || info.traceId,
      spanId: context?.spanId || info.spanId,
      userId: context?.userId || info.userId,
      operation: context?.operation || info.operation,
      duration: info.duration,
      error: info.error,
      context: info.context,
      service: 'social-media-automation',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      hostname: require('os').hostname(),
      pid: process.pid,
    };

    return JSON.stringify(structured);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const context = asyncLocalStorage.getStore();
    const requestId = context?.requestId || info.requestId || 'no-req';
    const traceId = context?.traceId || info.traceId;
    const operation = context?.operation || info.operation;
    
    let prefix = `${info.timestamp} [${requestId.slice(-8)}]`;
    if (traceId) {
      prefix += ` [${traceId.slice(-8)}]`;
    }
    if (operation) {
      prefix += ` [${operation}]`;
    }
    
    return `${prefix} ${info.level}: ${info.message}`;
  })
);

// Define which transports the logger must use
const transports = [
  // Console transport with enhanced format
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? structuredFormat : consoleFormat,
  }),
  // File transport for errors with structured format
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: structuredFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }),
  // File transport for all logs with structured format
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: structuredFormat,
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
  }),
  // Separate file for HTTP requests
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'http.log'),
    level: 'http',
    format: structuredFormat,
    maxsize: 20 * 1024 * 1024, // 20MB
    maxFiles: 5,
  }),
];

// Add performance log transport for production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'performance.log'),
      level: 'info',
      format: structuredFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 5,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  transports,
  exitOnError: false,
});

export class LoggerService {
  private static instance: LoggerService;
  private logger: winston.Logger;

  private constructor() {
    this.logger = logger;
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Set request context for distributed tracing
   */
  setRequestContext(context: RequestContext): void {
    asyncLocalStorage.enterWith(context);
  }

  /**
   * Get current request context
   */
  getRequestContext(): RequestContext | undefined {
    return asyncLocalStorage.getStore();
  }

  /**
   * Run function with request context
   */
  runWithContext<T>(context: RequestContext, fn: () => T): T {
    return asyncLocalStorage.run(context, fn);
  }

  /**
   * Create a new span for operation tracing
   */
  createSpan(operation: string, parentSpanId?: string): string {
    const context = this.getRequestContext();
    const spanId = this.generateId();
    
    if (context) {
      context.spanId = spanId;
      context.operation = operation;
      context.parentSpanId = parentSpanId || context.spanId;
    }

    this.trace(`Starting operation: ${operation}`, { 
      spanId, 
      parentSpanId,
      operation 
    });

    return spanId;
  }

  /**
   * End a span and log duration
   */
  endSpan(spanId: string, success: boolean = true, error?: Error): void {
    const context = this.getRequestContext();
    if (context && context.spanId === spanId) {
      const duration = Date.now() - context.startTime;
      
      this.trace(`Completed operation: ${context.operation}`, {
        spanId,
        operation: context.operation,
        duration,
        success,
        error: error ? {
          name: error.name,
          message: error.message,
        } : undefined
      });
    }
  }

  /**
   * Generate unique ID for tracing
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const logData = {
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
      context,
    };

    this.logger.error(logData);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn({ message, context });
  }

  info(message: string, context?: LogContext): void {
    this.logger.info({ message, context });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug({ message, context });
  }

  http(message: string, context?: LogContext): void {
    this.logger.http({ message, context });
  }

  trace(message: string, context?: LogContext): void {
    this.logger.log('trace', { message, context });
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      operation,
      duration,
      type: 'performance'
    });
  }

  /**
   * Log security events
   */
  security(event: string, context?: LogContext): void {
    this.warn(`Security: ${event}`, {
      ...context,
      type: 'security',
      event
    });
  }

  /**
   * Log business events
   */
  business(event: string, context?: LogContext): void {
    this.info(`Business: ${event}`, {
      ...context,
      type: 'business',
      event
    });
  }

  /**
   * Log audit events
   */
  audit(action: string, context?: LogContext): void {
    this.info(`Audit: ${action}`, {
      ...context,
      type: 'audit',
      action
    });
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): LoggerService {
    const childLogger = new LoggerService();
    const originalMethods = ['error', 'warn', 'info', 'debug', 'http', 'trace'];
    
    originalMethods.forEach(method => {
      const originalMethod = (childLogger as any)[method];
      (childLogger as any)[method] = (message: string, error?: Error | LogContext, additionalContext?: LogContext) => {
        const mergedContext = {
          ...context,
          ...(error && typeof error === 'object' && !error.message ? error : additionalContext)
        };
        
        if (error && error.message) {
          originalMethod.call(childLogger, message, error, mergedContext);
        } else {
          originalMethod.call(childLogger, message, mergedContext);
        }
      };
    });

    return childLogger;
  }

  /**
   * Flush all logs (useful for testing and shutdown)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    level: string;
    transports: number;
    uptime: number;
  } {
    return {
      level: this.logger.level,
      transports: this.logger.transports.length,
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
export const loggerService = LoggerService.getInstance();

// Export async local storage for middleware use
export { asyncLocalStorage };