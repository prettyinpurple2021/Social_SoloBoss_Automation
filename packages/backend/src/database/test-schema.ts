import fs from 'fs';
import path from 'path';

/**
 * Test utility to validate database schema without requiring a live database connection
 */
export class DatabaseSchemaTest {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Validate all migration files exist and have correct structure
   */
  async validateMigrationFiles(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    migrationCount: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('Validating database migration files...');

      // Check if migrations directory exists
      if (!fs.existsSync(this.migrationsDir)) {
        errors.push('Migrations directory does not exist');
        return { isValid: false, errors, warnings, migrationCount: 0 };
      }

      // Get all migration files
      const migrationFiles = fs.readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      console.log(`Found ${migrationFiles.length} migration files`);

      // Validate each migration file
      for (const filename of migrationFiles) {
        await this.validateMigrationFile(filename, errors, warnings);
      }

      // Check for sequential numbering
      this.validateMigrationSequence(migrationFiles, warnings);

      const isValid = errors.length === 0;
      
      console.log(`Migration validation completed. Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`);
      
      return { isValid, errors, warnings, migrationCount: migrationFiles.length };
    } catch (error) {
      console.error('Migration validation failed:', error);
      errors.push(`Validation process failed: ${error}`);
      return { isValid: false, errors, warnings, migrationCount: 0 };
    }
  }

  /**
   * Validate individual migration file
   */
  private async validateMigrationFile(filename: string, errors: string[], warnings: string[]): Promise<void> {
    const filePath = path.join(this.migrationsDir, filename);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file is not empty
      if (content.trim().length === 0) {
        errors.push(`Migration file '${filename}' is empty`);
        return;
      }

      // Check for basic SQL structure
      if (!content.includes('CREATE TABLE') && !content.includes('ALTER TABLE') && !content.includes('CREATE INDEX')) {
        warnings.push(`Migration file '${filename}' may not contain table operations`);
      }

      // Check for proper IF NOT EXISTS usage
      if (content.includes('CREATE TABLE') && !content.includes('IF NOT EXISTS')) {
        warnings.push(`Migration file '${filename}' should use 'IF NOT EXISTS' for CREATE TABLE statements`);
      }

      // Check for proper indexing
      if (content.includes('CREATE TABLE') && !content.includes('CREATE INDEX')) {
        warnings.push(`Migration file '${filename}' creates tables but may be missing indexes`);
      }

      // Check for comments
      if (!content.includes('--') && !content.includes('COMMENT ON')) {
        warnings.push(`Migration file '${filename}' lacks documentation comments`);
      }

      // Validate specific migration content based on filename
      this.validateSpecificMigration(filename, content, errors, warnings);

    } catch (error) {
      errors.push(`Failed to read migration file '${filename}': ${error}`);
    }
  }

  /**
   * Validate specific migration content
   */
  private validateSpecificMigration(filename: string, content: string, errors: string[], warnings: string[]): void {
    const isCreateMigration = content.includes('CREATE TABLE');
    const isAlterMigration = content.includes('ALTER TABLE');

    // Validate users table creation migration
    if (filename.includes('users') && filename.includes('create') && isCreateMigration) {
      const requiredColumns = ['id', 'email', 'name', 'password_hash', 'created_at', 'updated_at'];
      for (const column of requiredColumns) {
        if (!content.includes(column)) {
          errors.push(`Users migration '${filename}' missing required column: ${column}`);
        }
      }
      
      if (!content.includes('UNIQUE') || !content.includes('email')) {
        errors.push(`Users migration '${filename}' should have unique constraint on email`);
      }
    }

    // Validate posts table creation migration
    if (filename.includes('posts') && filename.includes('create') && isCreateMigration && !filename.includes('platform_posts')) {
      const requiredColumns = ['id', 'user_id', 'content', 'platforms', 'status'];
      for (const column of requiredColumns) {
        if (!content.includes(column)) {
          errors.push(`Posts migration '${filename}' missing required column: ${column}`);
        }
      }
      
      if (!content.includes('REFERENCES users(id)')) {
        errors.push(`Posts migration '${filename}' should have foreign key to users table`);
      }
    }

    // Validate platform_posts table creation migration
    if (filename.includes('platform_posts') && filename.includes('create') && isCreateMigration) {
      const requiredColumns = ['id', 'post_id', 'platform', 'content', 'status'];
      for (const column of requiredColumns) {
        if (!content.includes(column)) {
          errors.push(`Platform posts migration '${filename}' missing required column: ${column}`);
        }
      }
      
      if (!content.includes('REFERENCES posts(id)')) {
        errors.push(`Platform posts migration '${filename}' should have foreign key to posts table`);
      }
    }

    // Validate platform_connections table creation migration
    if (filename.includes('platform_connections') && filename.includes('create') && isCreateMigration) {
      const requiredColumns = ['id', 'user_id', 'platform', 'access_token'];
      for (const column of requiredColumns) {
        if (!content.includes(column)) {
          errors.push(`Platform connections migration '${filename}' missing required column: ${column}`);
        }
      }
    }

    // Validate analytics table creation migration
    if (filename.includes('analytics') && filename.includes('create') && isCreateMigration) {
      const requiredColumns = ['id', 'platform_post_id', 'metric_type', 'metric_value'];
      for (const column of requiredColumns) {
        if (!content.includes(column)) {
          errors.push(`Analytics migration '${filename}' missing required column: ${column}`);
        }
      }
    }

    // Validate enhancement migrations have proper ALTER statements
    if (filename.includes('enhance') && isAlterMigration) {
      if (!content.includes('ADD COLUMN IF NOT EXISTS')) {
        warnings.push(`Enhancement migration '${filename}' should use 'ADD COLUMN IF NOT EXISTS' for safety`);
      }
    }
  }

  /**
   * Validate migration file numbering sequence
   */
  private validateMigrationSequence(migrationFiles: string[], warnings: string[]): void {
    const numbers: number[] = [];
    
    for (const filename of migrationFiles) {
      const match = filename.match(/^(\d+)_/);
      if (match) {
        numbers.push(parseInt(match[1]));
      } else {
        warnings.push(`Migration file '${filename}' does not follow naming convention (number_description.sql)`);
      }
    }

    // Check for sequential numbering
    numbers.sort((a, b) => a - b);
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i-1] + 1) {
        warnings.push(`Migration numbering gap detected: ${numbers[i-1]} -> ${numbers[i]}`);
      }
    }
  }

  /**
   * Validate seed files exist and have correct structure
   */
  async validateSeedFiles(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seedsDir = path.join(__dirname, 'seeds');

    try {
      console.log('Validating database seed files...');

      // Check if seeds directory exists
      if (!fs.existsSync(seedsDir)) {
        warnings.push('Seeds directory does not exist');
        return { isValid: true, errors, warnings };
      }

      // Check for required seed files
      const requiredSeedFiles = ['development.sql', 'test.sql'];
      
      for (const seedFile of requiredSeedFiles) {
        const seedPath = path.join(seedsDir, seedFile);
        
        if (!fs.existsSync(seedPath)) {
          warnings.push(`Seed file '${seedFile}' does not exist`);
          continue;
        }

        const content = fs.readFileSync(seedPath, 'utf8');
        
        if (content.trim().length === 0) {
          warnings.push(`Seed file '${seedFile}' is empty`);
          continue;
        }

        // Check for INSERT statements
        if (!content.includes('INSERT INTO')) {
          warnings.push(`Seed file '${seedFile}' does not contain INSERT statements`);
        }

        // Check for conflict handling
        if (!content.includes('ON CONFLICT')) {
          warnings.push(`Seed file '${seedFile}' should handle conflicts with ON CONFLICT`);
        }
      }

      const isValid = errors.length === 0;
      console.log(`Seed validation completed. Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`);
      
      return { isValid, errors, warnings };
    } catch (error) {
      console.error('Seed validation failed:', error);
      errors.push(`Seed validation process failed: ${error}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Generate a comprehensive schema report
   */
  async generateSchemaReport(): Promise<{
    migrations: any;
    seeds: any;
    summary: {
      totalMigrations: number;
      totalErrors: number;
      totalWarnings: number;
      isValid: boolean;
    };
  }> {
    const migrations = await this.validateMigrationFiles();
    const seeds = await this.validateSeedFiles();

    const summary = {
      totalMigrations: migrations.migrationCount,
      totalErrors: migrations.errors.length + seeds.errors.length,
      totalWarnings: migrations.warnings.length + seeds.warnings.length,
      isValid: migrations.isValid && seeds.isValid
    };

    return { migrations, seeds, summary };
  }
}

// Export singleton instance
export const schemaTest = new DatabaseSchemaTest();

// Run schema test if this file is executed directly
if (require.main === module) {
  schemaTest.generateSchemaReport()
    .then((report) => {
      console.log('\n=== Database Schema Test Results ===');
      console.log(`Total Migrations: ${report.summary.totalMigrations}`);
      console.log(`Total Errors: ${report.summary.totalErrors}`);
      console.log(`Total Warnings: ${report.summary.totalWarnings}`);
      console.log(`Schema Valid: ${report.summary.isValid}`);
      
      if (report.migrations.errors.length > 0) {
        console.log('\nMigration Errors:');
        report.migrations.errors.forEach((error: string) => console.log(`  ❌ ${error}`));
      }
      
      if (report.migrations.warnings.length > 0) {
        console.log('\nMigration Warnings:');
        report.migrations.warnings.forEach((warning: string) => console.log(`  ⚠️  ${warning}`));
      }
      
      if (report.seeds.errors.length > 0) {
        console.log('\nSeed Errors:');
        report.seeds.errors.forEach((error: string) => console.log(`  ❌ ${error}`));
      }
      
      if (report.seeds.warnings.length > 0) {
        console.log('\nSeed Warnings:');
        report.seeds.warnings.forEach((warning: string) => console.log(`  ⚠️  ${warning}`));
      }
      
      if (report.summary.isValid && report.summary.totalWarnings === 0) {
        console.log('\n✅ Database schema is valid with no issues!');
      }
      
      process.exit(report.summary.isValid ? 0 : 1);
    })
    .catch((error) => {
      console.error('Schema test failed:', error);
      process.exit(1);
    });
}