import { Request, Response, NextFunction } from 'express';
import { loggerService, RequestContext } from '../services/LoggerService';
import { monitoringService } from '../services/MonitoringService';

// Extend Express Request interface to include tracing context
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      traceId: string;
      spanId: string;
      startTime: number;
      context: RequestContext;
    }
  }
}

/**
 * Request tracing middleware
 */
export const tracingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Generate or extract tracing IDs
  const requestId = (req.headers['x-request-id'] as string) || generateId();
  const traceId = (req.headers['x-trace-id'] as string) || generateId();
  const spanId = generateId();

  // Set tracing headers
  req.requestId = requestId;
  req.traceId = traceId;
  req.spanId = spanId;
  req.startTime = startTime;

  // Create request context
  const context: RequestContext = {
    requestId,
    traceId,
    spanId,
    startTime,
    operation: `${req.method} ${req.path}`,
  };

  req.context = context;

  // Set response headers
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Trace-ID', traceId);

  // Set request context in async local storage
  loggerService.setRequestContext(context);

  // Log request start
  loggerService.http(`Request started: ${req.method} ${req.path}`, {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    contentLength: req.headers['content-length'],
  });

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Record metrics
    monitoringService.recordHttpRequest(req.method, req.route?.path || req.path, statusCode, duration);

    // Log request completion
    loggerService.http(`Request completed: ${req.method} ${req.path}`, {
      method: req.method,
      url: req.url,
      statusCode,
      duration,
      contentLength: res.get('content-length'),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Log performance if slow
    if (duration > 1000) {
      loggerService.performance(`Slow request: ${req.method} ${req.path}`, duration, {
        method: req.method,
        url: req.url,
        statusCode,
      });
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * User context middleware (should be used after authentication)
 */
export const userContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const context = loggerService.getRequestContext();
  if (context && (req as any).user) {
    context.userId = (req as any).user.id;
    loggerService.setRequestContext(context);
  }
  next();
};

/**
 * Operation tracing decorator for service methods
 */
export function traced(operationName?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function(...args: any[]) {
      const spanId = loggerService.createSpan(operation);
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        loggerService.endSpan(spanId, true);
        loggerService.performance(`Operation completed: ${operation}`, duration);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        loggerService.endSpan(spanId, false, error as Error);
        loggerService.error(`Operation failed: ${operation}`, error as Error, {
          operation,
          duration,
          args: JSON.stringify(args).substring(0, 1000) // Limit arg logging
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Database query tracing wrapper
 */
export function traceDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const spanId = loggerService.createSpan(`db:${queryName}`);

  return queryFn()
    .then(result => {
      const duration = Date.now() - startTime;
      const isSlowQuery = duration > 1000;
      
      loggerService.endSpan(spanId, true);
      monitoringService.recordDatabaseQuery(duration, isSlowQuery);
      
      if (isSlowQuery) {
        loggerService.warn(`Slow database query: ${queryName}`, {
          query: queryName,
          duration,
        });
      }

      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      
      loggerService.endSpan(spanId, false, error);
      monitoringService.recordDatabaseQuery(duration, false);
      
      loggerService.error(`Database query failed: ${queryName}`, error, {
        query: queryName,
        duration,
      });
      
      throw error;
    });
}

/**
 * External API call tracing wrapper
 */
export function traceExternalCall<T>(
  serviceName: string,
  operation: string,
  callFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const spanId = loggerService.createSpan(`external:${serviceName}:${operation}`);

  return callFn()
    .then(result => {
      const duration = Date.now() - startTime;
      
      loggerService.endSpan(spanId, true);
      loggerService.info(`External API call successful: ${serviceName}.${operation}`, {
        service: serviceName,
        operation,
        duration,
      });

      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      
      loggerService.endSpan(spanId, false, error);
      loggerService.error(`External API call failed: ${serviceName}.${operation}`, error, {
        service: serviceName,
        operation,
        duration,
      });
      
      throw error;
    });
}

/**
 * Generate unique ID for tracing
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Extract correlation ID from various sources
 */
export function extractCorrelationId(req: Request): string {
  return req.headers['x-correlation-id'] as string ||
         req.headers['x-request-id'] as string ||
         req.headers['x-trace-id'] as string ||
         generateId();
}

/**
 * Middleware to add correlation ID to all responses
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = extractCorrelationId(req);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};