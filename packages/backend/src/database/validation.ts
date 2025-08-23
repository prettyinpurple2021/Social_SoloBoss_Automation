import { db } from './connection';

/**
 * Database validation utility for checking schema integrity and constraints
 */
export class DatabaseValidator {
  
  /**
   * Validate database schema and constraints
   */
  async validateSchema(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('Starting database schema validation...');

      // Check if all required tables exist
      await this.validateTables(errors);
      
      // Check if all required indexes exist
      await this.validateIndexes(warnings);
      
      // Check foreign key constraints
      await this.validateForeignKeys(errors);
      
      // Check data integrity
      await this.validateDataIntegrity(warnings);
      
      // Check performance-related issues
      await this.validatePerformance(warnings);

      const isValid = errors.length === 0;
      
      console.log(`Schema validation completed. Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`);
      
      return { isValid, errors, warnings };
    } catch (error) {
      console.error('Schema validation failed:', error);
      errors.push(`Validation process failed: ${error}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Check if all required tables exist with correct structure
   */
  private async validateTables(errors: string[]): Promise<void> {
    const requiredTables = [
      'users',
      'platform_connections',
      'posts',
      'platform_posts',
      'post_analytics',
      'integrations',
      'content_templates',
      'user_sessions',
      'failed_login_attempts',
      'rate_limits',
      'audit_logs',
      'security_events',
      'blogger_integrations',
      'soloboss_integrations'
    ];

    for (const tableName of requiredTables) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);

      if (!result.rows[0].exists) {
        errors.push(`Required table '${tableName}' does not exist`);
      }
    }

    // Check specific column requirements
    await this.validateTableColumns(errors);
  }

  /**
   * Validate specific table columns and their types
   */
  private async validateTableColumns(errors: string[]): Promise<void> {
    const columnChecks = [
      { table: 'users', column: 'id', type: 'uuid' },
      { table: 'users', column: 'email', type: 'character varying' },
      { table: 'users', column: 'email_verified', type: 'boolean' },
      { table: 'posts', column: 'platform_specific_content', type: 'jsonb' },
      { table: 'platform_connections', column: 'scopes', type: 'ARRAY' },
      { table: 'post_analytics', column: 'metric_value', type: 'integer' }
    ];

    for (const check of columnChecks) {
      const result = await db.query(`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [check.table, check.column]);

      if (result.rows.length === 0) {
        errors.push(`Column '${check.column}' missing from table '${check.table}'`);
      } else {
        const actualType = result.rows[0].data_type || result.rows[0].udt_name;
        if (!actualType.includes(check.type) && check.type !== 'ARRAY') {
          errors.push(`Column '${check.table}.${check.column}' has incorrect type. Expected: ${check.type}, Actual: ${actualType}`);
        }
      }
    }
  }

  /**
   * Check if all required indexes exist
   */
  private async validateIndexes(warnings: string[]): Promise<void> {
    const requiredIndexes = [
      { table: 'users', column: 'email' },
      { table: 'posts', column: 'user_id' },
      { table: 'posts', column: 'status' },
      { table: 'posts', column: 'scheduled_time' },
      { table: 'platform_connections', column: 'user_id' },
      { table: 'platform_posts', column: 'post_id' },
      { table: 'post_analytics', column: 'platform_post_id' },
      { table: 'audit_logs', column: 'user_id' },
      { table: 'audit_logs', column: 'created_at' }
    ];

    for (const indexCheck of requiredIndexes) {
      const result = await db.query(`
        SELECT COUNT(*) as index_count
        FROM pg_indexes
        WHERE tablename = $1 
        AND indexdef LIKE '%' || $2 || '%'
      `, [indexCheck.table, indexCheck.column]);

      if (parseInt(result.rows[0].index_count) === 0) {
        warnings.push(`Missing index on ${indexCheck.table}.${indexCheck.column}`);
      }
    }
  }

  /**
   * Validate foreign key constraints
   */
  private async validateForeignKeys(errors: string[]): Promise<void> {
    const foreignKeyChecks = [
      { table: 'platform_connections', column: 'user_id', references: 'users(id)' },
      { table: 'posts', column: 'user_id', references: 'users(id)' },
      { table: 'platform_posts', column: 'post_id', references: 'posts(id)' },
      { table: 'post_analytics', column: 'platform_post_id', references: 'platform_posts(id)' },
      { table: 'integrations', column: 'user_id', references: 'users(id)' }
    ];

    for (const fkCheck of foreignKeyChecks) {
      const result = await db.query(`
        SELECT COUNT(*) as fk_count
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 
        AND kcu.column_name = $2
        AND tc.constraint_type = 'FOREIGN KEY'
      `, [fkCheck.table, fkCheck.column]);

      if (parseInt(result.rows[0].fk_count) === 0) {
        errors.push(`Missing foreign key constraint on ${fkCheck.table}.${fkCheck.column} -> ${fkCheck.references}`);
      }
    }
  }

  /**
   * Check data integrity issues
   */
  private async validateDataIntegrity(warnings: string[]): Promise<void> {
    // Check for orphaned records
    const orphanChecks = [
      {
        name: 'platform_posts without posts',
        query: `
          SELECT COUNT(*) as count
          FROM platform_posts pp
          LEFT JOIN posts p ON pp.post_id = p.id
          WHERE p.id IS NULL
        `
      },
      {
        name: 'post_analytics without platform_posts',
        query: `
          SELECT COUNT(*) as count
          FROM post_analytics pa
          LEFT JOIN platform_posts pp ON pa.platform_post_id = pp.id
          WHERE pp.id IS NULL
        `
      },
      {
        name: 'posts with invalid status',
        query: `
          SELECT COUNT(*) as count
          FROM posts
          WHERE status NOT IN ('draft', 'scheduled', 'publishing', 'published', 'failed')
        `
      }
    ];

    for (const check of orphanChecks) {
      const result = await db.query(check.query);
      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        warnings.push(`Data integrity issue: ${count} records found for ${check.name}`);
      }
    }
  }

  /**
   * Check for performance-related issues
   */
  private async validatePerformance(warnings: string[]): Promise<void> {
    // Check for tables without primary keys
    const result = await db.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT IN (
        SELECT tablename
        FROM pg_indexes
        WHERE indexdef LIKE '%PRIMARY KEY%'
      )
    `);

    for (const row of result.rows) {
      warnings.push(`Table '${row.tablename}' may be missing a primary key`);
    }

    // Check for large tables without proper indexing
    const largeTableResult = await db.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins + n_tup_upd + n_tup_del as total_operations
      FROM pg_stat_user_tables
      WHERE n_tup_ins + n_tup_upd + n_tup_del > 10000
    `);

    for (const row of largeTableResult.rows) {
      warnings.push(`Table '${row.tablename}' has high activity (${row.total_operations} operations) - ensure proper indexing`);
    }
  }

  /**
   * Generate a database health report
   */
  async generateHealthReport(): Promise<{
    connectionHealth: boolean;
    poolStats: any;
    tableStats: any[];
    indexUsage: any[];
    slowQueries: any[];
  }> {
    const connectionHealth = await db.healthCheck();
    const poolStats = await db.getPoolStats();

    // Get table statistics
    const tableStatsResult = await db.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);

    // Get index usage statistics
    const indexUsageResult = await db.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan
      FROM pg_stat_user_indexes
      WHERE idx_scan > 0
      ORDER BY idx_scan DESC
      LIMIT 20
    `);

    return {
      connectionHealth,
      poolStats,
      tableStats: tableStatsResult.rows,
      indexUsage: indexUsageResult.rows,
      slowQueries: [] // Would need pg_stat_statements extension for this
    };
  }
}

// Export singleton instance
export const validator = new DatabaseValidator();

// Run validation if this file is executed directly
if (require.main === module) {
  validator.validateSchema()
    .then((result) => {
      console.log('\n=== Database Validation Results ===');
      console.log(`Valid: ${result.isValid}`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => console.log(`  ❌ ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
      }
      
      if (result.isValid && result.warnings.length === 0) {
        console.log('\n✅ Database schema is valid with no issues!');
      }
      
      process.exit(result.isValid ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}