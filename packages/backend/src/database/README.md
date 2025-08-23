# Database

This directory contains database-related files for the Social Media Automation Platform.

## Overview

The database system uses PostgreSQL with a comprehensive migration system, connection pooling, error handling, and development utilities.

## Files

- `connection.ts` - Enhanced database connection management with retry logic and performance monitoring
- `init.ts` - Database initialization and migration runner
- `seed.ts` - Database seeding utility for development and testing
- `validation.ts` - Database schema validation and health checking
- `migrations/` - SQL migration files for schema changes
- `seeds/` - Seed data files for different environments

## Database Schema

### Core Tables
- **users** - User accounts with authentication and profile information
- **platform_connections** - OAuth connections to social media platforms
- **posts** - Social media posts with content and scheduling information
- **platform_posts** - Individual platform posts tracking publication status
- **post_analytics** - Performance metrics for published posts

### Integration Tables
- **integrations** - External service integrations and configurations
- **content_templates** - Reusable content templates for post creation
- **blogger_integrations** - Blogger-specific integration settings
- **soloboss_integrations** - SoloBoss-specific integration settings

### Security & Monitoring Tables
- **user_sessions** - User authentication sessions with refresh tokens
- **failed_login_attempts** - Failed login attempts for security monitoring
- **rate_limits** - API rate limiting tracking
- **audit_logs** - General audit log for all user actions
- **security_events** - Security-specific events for monitoring

## Usage

### Database Management
```bash
# Initialize database and run migrations
npm run db:init

# Run migrations only
npm run db:migrate

# Validate database schema
npm run db:validate
```

### Development Data
```bash
# Seed development data
npm run db:seed:dev

# Seed test data
npm run db:seed:test

# Reset database with fresh development data
npm run db:reset

# Reset database with fresh test data
npm run db:reset:test
```

### Database Health
```bash
# Validate schema and check for issues
npm run db:validate
```

## Environment Variables

### Connection Settings
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: social_media_automation)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: password)

### Connection Pool Settings
- `DB_POOL_MAX` - Maximum pool connections (default: 20)
- `DB_IDLE_TIMEOUT` - Idle timeout in ms (default: 30000)
- `DB_CONNECTION_TIMEOUT` - Connection timeout in ms (default: 2000)
- `DB_ACQUIRE_TIMEOUT` - Client acquisition timeout in ms (default: 60000)

### Security Settings
- `DB_SSL` - Enable SSL connection (default: false, true in production)
- `NODE_ENV` - Environment mode (affects logging and SSL)

## Features

### Enhanced Connection Management
- **Connection Pooling**: Optimized connection pool with configurable limits
- **Retry Logic**: Automatic reconnection with exponential backoff
- **Health Monitoring**: Continuous health checks and connection status tracking
- **Performance Monitoring**: Query performance logging and slow query detection

### Migration System
- **Automatic Migration**: Runs pending migrations on startup
- **Transaction Safety**: All migrations run within transactions
- **Migration Tracking**: Tracks executed migrations to prevent duplicates
- **Rollback Support**: Transaction-based rollback on migration failures

### Development Tools
- **Database Seeding**: Populate database with test data for development
- **Schema Validation**: Validate database schema integrity and constraints
- **Performance Testing**: Generate large datasets for performance testing
- **Health Reports**: Comprehensive database health and performance reports

### Error Handling
- **Structured Errors**: Detailed error logging with context and metadata
- **User-Friendly Messages**: Convert database errors to user-friendly messages
- **Connection Recovery**: Automatic recovery from connection failures
- **Transaction Management**: Proper transaction handling with rollback support

## Migration Guidelines

### Creating Migrations
1. Create new migration file with sequential number: `018_description.sql`
2. Use `IF NOT EXISTS` for CREATE statements
3. Include proper indexes for performance
4. Add comments for documentation
5. Test migration with sample data

### Migration Best Practices
- Always use transactions for complex migrations
- Create indexes concurrently in production
- Add constraints after data validation
- Include rollback procedures in comments
- Test migrations on production-like data

## Performance Optimization

### Indexing Strategy
- Primary keys on all tables (UUID)
- Foreign key indexes for joins
- Composite indexes for common query patterns
- GIN indexes for JSONB and array columns
- Partial indexes for filtered queries

### Query Optimization
- Connection pooling for concurrent requests
- Query performance monitoring
- Slow query detection and logging
- Prepared statement caching
- Connection reuse and management

### Monitoring
- Pool statistics tracking
- Query performance metrics
- Connection health monitoring
- Database usage statistics
- Index usage analysis

## Security Features

### Data Protection
- Encrypted sensitive data (tokens, passwords)
- Audit logging for all operations
- Security event tracking
- Failed login attempt monitoring
- Rate limiting implementation

### Access Control
- Foreign key constraints for data integrity
- Check constraints for data validation
- Unique constraints for business rules
- Soft deletes for data retention
- Session management with refresh tokens

## Troubleshooting

### Common Issues
1. **Connection Failures**: Check database server status and network connectivity
2. **Migration Errors**: Review migration SQL and database permissions
3. **Performance Issues**: Check query performance and index usage
4. **Data Integrity**: Run schema validation to identify issues

### Debug Commands
```bash
# Check database connection
npm run db:validate

# View pool statistics
# (Available through health report API)

# Check migration status
# (Tracked in migrations table)
```