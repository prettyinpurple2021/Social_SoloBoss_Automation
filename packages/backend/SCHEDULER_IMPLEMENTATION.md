# Post Scheduler Execution Engine Implementation

## Overview

This document describes the implementation of the post scheduler execution engine for the social media automation platform. The scheduler handles background job processing using Redis queues for scheduled post execution with retry logic and error handling.

## Components Implemented

### 1. Redis Connection Service (`src/database/redis.ts`)
- Singleton Redis connection manager
- Connection health checking
- Graceful connection/disconnection handling
- Error handling and reconnection logic

### 2. Queue Service (`src/services/QueueService.ts`)
- Background job processor using Bull (Redis-based queue library)
- Two separate queues:
  - **Post Execution Queue**: Handles scheduled post execution
  - **Retry Queue**: Handles failed post retries with exponential backoff
- Job management (scheduling, cancellation, cleanup)
- Queue statistics and monitoring

### 3. Scheduler Service (`src/services/SchedulerService.ts`)
- Main orchestrator for post execution
- Integrates with PostService and IntegrationService
- Handles post execution workflow:
  - Retrieves post data
  - Updates post status during execution
  - Executes posts across multiple platforms
  - Handles partial failures and retries
- Implements exponential backoff retry logic (1min, 5min, 15min)
- Provides scheduler statistics and monitoring

### 4. Integration with Existing Services

#### PostService Updates
- Automatic scheduling when posts are created with scheduled times
- Automatic rescheduling when post scheduled times are updated
- Automatic cancellation when posts are deleted

#### IntegrationService Updates
- Added `publishPost` method for platform-specific publishing
- Made service a singleton for better resource management
- Fixed encryption service usage

#### API Routes Updates
- Added scheduler endpoints to posts routes:
  - `POST /api/posts/:id/execute` - Execute post immediately
  - `POST /api/posts/:id/cancel` - Cancel scheduled post
  - `GET /api/posts/scheduler/stats` - Get scheduler statistics
- Integrated scheduler cancellation in post deletion

#### Application Startup
- Redis connection initialization
- Scheduler service startup with background processing
- Graceful shutdown handling

## Key Features

### Retry Logic with Exponential Backoff
- Failed posts are retried up to 3 times
- Delays: 1 minute, 5 minutes, 15 minutes
- Distinguishes between retryable and non-retryable errors
- Automatic retry scheduling for platform failures

### Error Handling
- Comprehensive error categorization:
  - Authentication errors (token expired, insufficient permissions)
  - Rate limit errors (API quota exceeded, temporary throttling)
  - Content errors (invalid format, policy violations)
  - Network errors (connectivity issues, timeouts)
  - Platform errors (service unavailable, maintenance)
- Structured error responses with retry information
- Detailed logging for debugging and monitoring

### Queue Management
- Job deduplication using consistent job IDs
- Automatic cleanup of old completed/failed jobs
- Queue statistics for monitoring
- Graceful queue shutdown

### Platform Integration
- Supports multiple platforms (Facebook, Instagram, Pinterest, X)
- Platform-specific content formatting
- Handles platform-specific errors and rate limits
- Secure token management with encryption

## Testing

### Unit Tests
- `scheduler.service.test.ts` - SchedulerService unit tests
- `queue.service.test.ts` - QueueService unit tests
- Comprehensive mocking of dependencies
- Tests for success and failure scenarios

### Integration Tests
- `scheduler.integration.test.ts` - End-to-end scheduler tests
- Tests complete post execution workflows
- Tests retry logic and error handling
- Tests queue management and statistics

## Configuration

### Environment Variables
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Queue Configuration
- Post execution queue: `post-execution`
- Retry queue: `post-retry`
- Job retention: 100 completed, 50 failed jobs
- Cleanup intervals: 24 hours for completed, 7 days for failed

## Usage

### Scheduling a Post
```typescript
await schedulerService.schedulePost(postId, userId, scheduledTime);
```

### Executing a Post Immediately
```typescript
const result = await schedulerService.executePostNow(postId, userId);
```

### Canceling a Scheduled Post
```typescript
const canceled = await schedulerService.cancelScheduledPost(postId, userId);
```

### Getting Scheduler Statistics
```typescript
const stats = await schedulerService.getSchedulerStats();
```

## Requirements Fulfilled

This implementation fulfills the following requirements from the task:

- ✅ **1.5**: WHEN a scheduled time arrives THEN the system SHALL automatically publish the post to the specified platform
- ✅ **7.1**: WHEN a scheduled post fails THEN the system SHALL retry up to 3 times with exponential backoff
- ✅ **7.2**: WHEN retries are exhausted THEN the system SHALL notify the user and provide manual posting options
- ✅ **7.3**: WHEN platform APIs are unavailable THEN the system SHALL queue posts and retry when service resumes
- ✅ **7.4**: WHEN the user checks post status THEN the system SHALL display success, pending, or failed states clearly

## Architecture Benefits

1. **Scalability**: Redis-based queues can handle high volumes of scheduled posts
2. **Reliability**: Persistent job storage and retry mechanisms ensure posts aren't lost
3. **Monitoring**: Comprehensive statistics and logging for operational visibility
4. **Flexibility**: Configurable retry policies and queue management
5. **Integration**: Seamless integration with existing post management system

## Future Enhancements

1. **Priority Queues**: Support for high-priority posts
2. **Batch Processing**: Optimize for bulk post operations
3. **Advanced Scheduling**: Support for recurring posts and complex schedules
4. **Metrics Dashboard**: Real-time monitoring and alerting
5. **Load Balancing**: Distribute processing across multiple workers