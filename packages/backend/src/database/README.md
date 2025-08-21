# Database Implementation

This directory contains the database schema, models, and utilities for the Social Media Automation platform.

## Structure

```
database/
├── migrations/           # SQL migration files
├── connection.ts        # Database connection utilities
├── init.ts             # Database initialization script
└── README.md           # This file

models/
├── User.ts             # User model with CRUD operations
├── PlatformConnection.ts # Social media platform connections
├── Post.ts             # Post management
├── PlatformPost.ts     # Platform-specific post data
└── index.ts            # Model exports

types/
└── database.ts         # TypeScript interfaces and enums
```

## Database Schema

### Tables

1. **users** - User accounts and settings
2. **platform_connections** - OAuth connections to social media platforms
3. **posts** - Main post content and metadata
4. **platform_posts** - Platform-specific post instances

### Key Features

- **UUID Primary Keys**: All tables use UUID primary keys for better scalability
- **Automatic Timestamps**: `created_at` and `updated_at` fields with triggers
- **JSON Settings**: Flexible user settings stored as JSONB
- **Referential Integrity**: Foreign key constraints with CASCADE deletes
- **Indexes**: Optimized indexes for common query patterns
- **Constraints**: Data validation at the database level

## Models

Each model provides static methods for CRUD operations:

### UserModel
- `create(input)` - Create new user
- `findById(id)` - Find user by ID
- `findByEmail(email)` - Find user by email
- `update(id, input)` - Update user fields
- `delete(id)` - Delete user
- `list(limit, offset)` - List users with pagination
- `updateSettings(id, settings)` - Update user settings

### PlatformConnectionModel
- `create(input)` - Create/update platform connection (upsert)
- `findByUserAndPlatform(userId, platform)` - Find specific connection
- `findByUserId(userId)` - Find all user connections
- `findActiveByUserId(userId)` - Find active connections only
- `findExpiringSoon(hours)` - Find tokens expiring soon
- `update(id, input)` - Update connection
- `deactivate(id)` - Deactivate connection
- `delete(id)` - Delete connection

### PostModel
- `create(input)` - Create new post
- `findById(id)` - Find post by ID
- `findByUserId(userId)` - Find user's posts
- `findByStatus(status)` - Find posts by status
- `findScheduledPosts(beforeTime?)` - Find scheduled posts
- `findBySource(source)` - Find posts by source
- `update(id, input)` - Update post
- `updateStatus(id, status)` - Update post status
- `delete(id)` - Delete post
- `getPostStats(userId)` - Get post statistics

### PlatformPostModel
- `create(input)` - Create platform post (upsert)
- `findByPostId(postId)` - Find all platform posts for a post
- `findByPostAndPlatform(postId, platform)` - Find specific platform post
- `findByStatus(status)` - Find platform posts by status
- `findFailedPosts(maxRetries)` - Find retryable failed posts
- `update(id, input)` - Update platform post
- `updateStatus(id, status, error?)` - Update status with optional error
- `incrementRetryCount(id)` - Increment retry counter
- `delete(id)` - Delete platform post
- `getPlatformStats(platform)` - Get platform statistics

## Connection Management

The `DatabaseConnection` class provides:

- **Connection Pooling**: Configurable pool size and timeouts
- **Health Checks**: Database connectivity monitoring
- **Migrations**: Automatic schema migration system
- **Transactions**: Transaction support with rollback
- **Error Handling**: Comprehensive error logging
- **Singleton Pattern**: Single instance across the application

### Configuration

Environment variables:
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_POOL_MAX` - Maximum pool connections (default: 20)
- `DB_IDLE_TIMEOUT` - Idle timeout in ms (default: 30000)
- `DB_CONNECTION_TIMEOUT` - Connection timeout in ms (default: 2000)

## Usage

### Initialize Database
```bash
npm run db:init
```

### Run Migrations
```bash
npm run db:migrate
```

### Example Usage
```typescript
import { UserModel } from './models';
import { db } from './database';

// Create a user
const user = await UserModel.create({
  email: 'user@example.com',
  name: 'John Doe',
  password_hash: 'hashed_password'
});

// Use transactions
await db.transaction(async (client) => {
  // Multiple operations in transaction
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
});
```

## Testing

The database implementation includes comprehensive unit tests that verify:

- Model method signatures and functionality
- Database schema structure
- Migration file validity
- TypeScript type definitions
- Enum value correctness

Run tests with:
```bash
npm test
```

## Migration System

Migrations are automatically applied in order based on filename. Each migration:

1. Creates tables with proper constraints
2. Adds indexes for performance
3. Sets up triggers for automatic timestamps
4. Includes rollback-safe operations

New migrations should follow the naming pattern:
`XXX_description.sql` where XXX is a sequential number.