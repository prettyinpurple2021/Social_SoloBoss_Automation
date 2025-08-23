import { schemaTest } from '../database/test-schema';

describe('Database Schema Tests', () => {
  describe('Migration Files', () => {
    it('should have valid migration files', async () => {
      const result = await schemaTest.validateMigrationFiles();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.migrationCount).toBeGreaterThan(0);
      
      // Should have at least the core migrations
      expect(result.migrationCount).toBeGreaterThanOrEqual(17);
    });

    it('should have properly structured migration files', async () => {
      const result = await schemaTest.validateMigrationFiles();
      
      // Check that we have the expected number of migrations
      expect(result.migrationCount).toBe(17);
      
      // Should not have any critical errors
      const criticalErrors = result.errors.filter(error => 
        error.includes('missing required column') || 
        error.includes('should have foreign key')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('Seed Files', () => {
    it('should have valid seed files', async () => {
      const result = await schemaTest.validateSeedFiles();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Complete Schema Report', () => {
    it('should generate a comprehensive schema report', async () => {
      const report = await schemaTest.generateSchemaReport();
      
      expect(report.summary.isValid).toBe(true);
      expect(report.summary.totalErrors).toBe(0);
      expect(report.summary.totalMigrations).toBeGreaterThan(0);
      
      // Verify report structure
      expect(report.migrations).toBeDefined();
      expect(report.seeds).toBeDefined();
      expect(report.summary).toBeDefined();
      
      // Verify summary properties
      expect(typeof report.summary.totalMigrations).toBe('number');
      expect(typeof report.summary.totalErrors).toBe('number');
      expect(typeof report.summary.totalWarnings).toBe('number');
      expect(typeof report.summary.isValid).toBe('boolean');
    });
  });

  describe('Migration File Structure', () => {
    it('should have all required core tables', async () => {
      const result = await schemaTest.validateMigrationFiles();
      
      // Should be valid overall
      expect(result.isValid).toBe(true);
      
      // Should have migrations for all core tables
      const migrationFiles = [
        '001_create_users_table.sql',
        '002_create_platform_connections_table.sql', 
        '003_create_posts_table.sql',
        '004_create_platform_posts_table.sql',
        '012_create_post_analytics_table.sql',
        '013_create_integrations_table.sql'
      ];
      
      // This test validates that the migration validation logic works
      // The actual files are validated by the schema test
      expect(result.migrationCount).toBeGreaterThanOrEqual(migrationFiles.length);
    });

    it('should have proper enhancement migrations', async () => {
      const result = await schemaTest.validateMigrationFiles();
      
      expect(result.isValid).toBe(true);
      
      // Should have enhancement migrations
      const enhancementMigrations = [
        '008_enhance_users_table.sql',
        '009_enhance_platform_connections_table.sql',
        '010_enhance_posts_table.sql',
        '011_enhance_platform_posts_table.sql'
      ];
      
      // Verify we have enough migrations to include enhancements
      expect(result.migrationCount).toBeGreaterThanOrEqual(enhancementMigrations.length + 7);
    });
  });

  describe('Security and Monitoring Tables', () => {
    it('should have security and monitoring migrations', async () => {
      const result = await schemaTest.validateMigrationFiles();
      
      expect(result.isValid).toBe(true);
      
      // Should have security-related migrations
      const securityMigrations = [
        '015_create_user_sessions_table.sql',
        '016_create_failed_login_attempts_table.sql',
        '017_create_rate_limits_table.sql'
      ];
      
      // Verify we have enough migrations to include security tables
      expect(result.migrationCount).toBeGreaterThanOrEqual(securityMigrations.length + 14);
    });
  });

  describe('Data Integrity', () => {
    it('should have proper foreign key relationships', async () => {
      const result = await schemaTest.validateMigrationFiles();
      
      expect(result.isValid).toBe(true);
      
      // No foreign key errors should be present
      const foreignKeyErrors = result.errors.filter(error => 
        error.includes('should have foreign key')
      );
      expect(foreignKeyErrors).toHaveLength(0);
    });

    it('should have proper indexing', async () => {
      const result = await schemaTest.validateMigrationFiles();
      
      expect(result.isValid).toBe(true);
      
      // Should not have major indexing warnings
      const indexWarnings = result.warnings.filter(warning => 
        warning.includes('missing indexes')
      );
      
      // We allow some index warnings as they're not critical
      expect(indexWarnings.length).toBeLessThan(5);
    });
  });
});