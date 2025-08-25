import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import postsRoutes from './routes/posts';
import bloggerRoutes from './routes/blogger';
import settingsRoutes from './routes/settings';
import healthRoutes from './routes/health';
import securityRoutes from './routes/security';
import performanceRoutes from './routes/performance';
import templatesRoutes from './routes/templates';
import integrationErrorsRoutes from './routes/integration-errors';
import analyticsRoutes from './routes/analytics';
import schedulingRoutes from './routes/scheduling';
import categoriesRoutes from './routes/categories';
import contentApprovalRoutes from './routes/content-approval';
import contentVersioningRoutes from './routes/content-versioning';
import contentCalendarRoutes from './routes/content-calendar';
import { createSoloBossRoutes } from './routes/soloboss';
import sandboxRoutes from './routes/sandbox';
import developerRoutes from './routes/developer';
import { setupSwagger } from './docs/swagger';
import { TokenRefreshService } from './services/TokenRefreshService';
import { sandboxMiddleware } from './services/SandboxService';
import { apiAnalyticsMiddleware } from './services/ApiAnalyticsService';
import { schedulerService } from './services/SchedulerService';
import { BloggerMonitorService } from './services/BloggerMonitorService';
import { retryQueueService } from './services/RetryQueueService';
import { IntegrationErrorRecoveryService } from './services/IntegrationErrorRecoveryService';
import { loggerService } from './services/LoggerService';
import { monitoringService } from './services/MonitoringService';
import { ErrorHandlerMiddleware, requestIdMiddleware, notFoundHandler } from './middleware/errorHandler';
import { tracingMiddleware, userContextMiddleware, correlationMiddleware } from './middleware/tracing';
import { 
  enforceHTTPS, 
  securityHeaders, 
  sanitizeRequest, 
  validateUserAgent,
  limitRequestSize,
  corsOptions,
  productionSecurityHardening,
  productionInputValidation,
  securityMonitoring,
  requestTimeout
} from './middleware/security';
import { ResponseUtils } from './utils/responseUtils';
import { 
  performanceMiddleware, 
  requestTimeoutMiddleware, 
  resourceMonitoringMiddleware 
} from './middleware/performance';
import { 
  generalRateLimit, 
  authRateLimit, 
  oauthRateLimit,
  postCreationRateLimit,
  healthCheckRateLimit,
  webhookRateLimit,
  strictRateLimit,
  AdaptiveRateLimit
} from './middleware/rateLimiting';
import { redis } from './database/redis';
import { db } from './database/connection';
import { csrfProtection } from './middleware/csrf';
import { inputValidation, strictInputValidation } from './middleware/inputValidation';

// Load environment variables
dotenv.config();

const app = express();

// Export app for testing
export { app };
const PORT = process.env.PORT || 3001;

// Security middleware - order is important
app.use(enforceHTTPS);
app.use(productionSecurityHardening);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(requestTimeout(30000)); // 30 second timeout
app.use(validateUserAgent);
app.use(productionInputValidation);
app.use(sanitizeRequest);
app.use(limitRequestSize());
app.use(securityMonitoring);

// General rate limiting
app.use(generalRateLimit);

// Request ID and tracing middleware
app.use(requestIdMiddleware);
app.use(correlationMiddleware);
app.use(tracingMiddleware);

// Response time tracking for enhanced API analytics
app.use(ResponseUtils.responseTimeMiddleware());

// API analytics middleware
app.use(apiAnalyticsMiddleware);

// Sandbox middleware for development testing
app.use(sandboxMiddleware);

// Performance monitoring middleware
app.use(performanceMiddleware({ enableLoadBalancing: true }));
app.use(resourceMonitoringMiddleware());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input validation and CSRF protection
app.use(inputValidation);
app.use(csrfProtection);

// User context middleware (after auth middleware would be applied)
app.use(userContextMiddleware);

// Setup enhanced API documentation
setupSwagger(app);

// Health check routes (with permissive rate limiting)
app.use('/health', healthCheckRateLimit, healthRoutes);

// Security routes (for CSRF tokens, etc.)
app.use('/api/security', generalRateLimit, securityRoutes);

// Performance monitoring routes
app.use('/api/performance', generalRateLimit, performanceRoutes);

// Authentication routes (with strict rate limiting)
app.use('/api/auth', authRateLimit, authRoutes);

// OAuth routes (with moderate rate limiting)
app.use('/api/oauth', oauthRateLimit, oauthRoutes);

// Posts routes (with creation rate limiting)
app.use('/api/posts', postCreationRateLimit, postsRoutes);

// Settings routes
app.use('/api/settings', settingsRoutes);

// Blogger integration routes (webhook rate limiting)
app.use('/api/blogger', webhookRateLimit, bloggerRoutes);

// SoloBoss integration routes (webhook rate limiting)
app.use('/api/soloboss', webhookRateLimit, createSoloBossRoutes(db.getPool()));

// Content templates routes
app.use('/api/templates', generalRateLimit, templatesRoutes);

// Integration errors routes
app.use('/api/integration-errors', generalRateLimit, integrationErrorsRoutes);

// Analytics routes
app.use('/api/analytics', generalRateLimit, analyticsRoutes);

// Advanced scheduling routes
app.use('/api/scheduling', generalRateLimit, schedulingRoutes);

// Categories and tags routes
app.use('/api/categories', generalRateLimit, categoriesRoutes);

// Advanced content management routes
app.use('/api/content-approval', generalRateLimit, contentApprovalRoutes);
app.use('/api/content-versioning', generalRateLimit, contentVersioningRoutes);
app.use('/api/content-calendar', generalRateLimit, contentCalendarRoutes);

// Sandbox routes for development testing (no rate limiting)
app.use('/sandbox', sandboxRoutes);

// Developer dashboard and tools
app.use('/api/developer', generalRateLimit, developerRoutes);

// 404 handler (must be before error handler)
app.use('*', notFoundHandler);

// Global error handler (must be last)
app.use(ErrorHandlerMiddleware.handle);

// Start server
app.listen(PORT, async () => {
  loggerService.info(`Social Media Automation Backend running on port ${PORT}`);
  loggerService.info(`Health check available at http://localhost:${PORT}/health`);
  
  try {
    // Initialize Redis connection
    await redis.connect();
    loggerService.info('Redis connection established');
    
    // Start scheduler service
    await schedulerService.start();
    loggerService.info('Scheduler service started');
    
    // Start token refresh service
    TokenRefreshService.start();
    loggerService.info('Token refresh service started');
    
    // Start blogger monitoring service
    BloggerMonitorService.start();
    loggerService.info('Blogger monitoring service started');
    
    // Start retry queue service
    retryQueueService.start();
    loggerService.info('Retry queue service started');
    
    // Start integration error recovery service
    IntegrationErrorRecoveryService.getInstance().start(5); // Run every 5 minutes
    loggerService.info('Integration error recovery service started');
    
    // Initialize monitoring service
    loggerService.info('Monitoring service initialized');
    
    // Log application startup metrics
    monitoringService.recordMetric('application_startup', 1, 'counter', {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    loggerService.error('Error starting services', error as Error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  loggerService.info('SIGTERM received, shutting down gracefully...');
  
  try {
    await schedulerService.stop();
    BloggerMonitorService.stop();
    retryQueueService.stop();
    IntegrationErrorRecoveryService.getInstance().stop();
    monitoringService.shutdown();
    await redis.disconnect();
    await loggerService.flush();
    loggerService.info('Services shut down successfully');
    process.exit(0);
  } catch (error) {
    loggerService.error('Error during shutdown', error as Error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  loggerService.info('SIGINT received, shutting down gracefully...');
  
  try {
    await schedulerService.stop();
    BloggerMonitorService.stop();
    retryQueueService.stop();
    IntegrationErrorRecoveryService.getInstance().stop();
    monitoringService.shutdown();
    await redis.disconnect();
    await loggerService.flush();
    loggerService.info('Services shut down successfully');
    process.exit(0);
  } catch (error) {
    loggerService.error('Error during shutdown', error as Error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggerService.error('Uncaught exception', error, {
    type: 'uncaughtException',
    stack: error.stack
  });
  
  // Give time for logs to be written
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  loggerService.error('Unhandled promise rejection', reason as Error, {
    type: 'unhandledRejection',
    promise: promise.toString()
  });
  
  // Give time for logs to be written
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});