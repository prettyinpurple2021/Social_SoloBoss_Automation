import { Platform, PostStatus, PostSource } from '../types/database';
import { UserModel, PlatformConnectionModel, PostModel, PlatformPostModel } from '../models';

describe('Database Schema and Models', () => {
  describe('Enums', () => {
    it('should have correct Platform enum values', () => {
      expect(Platform.FACEBOOK).toBe('facebook');
      expect(Platform.INSTAGRAM).toBe('instagram');
      expect(Platform.PINTEREST).toBe('pinterest');
      expect(Platform.X).toBe('x');
    });

    it('should have correct PostStatus enum values', () => {
      expect(PostStatus.DRAFT).toBe('draft');
      expect(PostStatus.SCHEDULED).toBe('scheduled');
      expect(PostStatus.PUBLISHING).toBe('publishing');
      expect(PostStatus.PUBLISHED).toBe('published');
      expect(PostStatus.FAILED).toBe('failed');
    });

    it('should have correct PostSource enum values', () => {
      expect(PostSource.MANUAL).toBe('manual');
      expect(PostSource.BLOGGER).toBe('blogger');
      expect(PostSource.SOLOBOSS).toBe('soloboss');
    });
  });

  describe('Model Classes', () => {
    it('should have UserModel with required static methods', () => {
      expect(typeof UserModel.create).toBe('function');
      expect(typeof UserModel.findById).toBe('function');
      expect(typeof UserModel.findByEmail).toBe('function');
      expect(typeof UserModel.update).toBe('function');
      expect(typeof UserModel.delete).toBe('function');
      expect(typeof UserModel.list).toBe('function');
      expect(typeof UserModel.updateSettings).toBe('function');
    });

    it('should have PlatformConnectionModel with required static methods', () => {
      expect(typeof PlatformConnectionModel.create).toBe('function');
      expect(typeof PlatformConnectionModel.findById).toBe('function');
      expect(typeof PlatformConnectionModel.findByUserAndPlatform).toBe('function');
      expect(typeof PlatformConnectionModel.findByUserId).toBe('function');
      expect(typeof PlatformConnectionModel.findActiveByUserId).toBe('function');
      expect(typeof PlatformConnectionModel.update).toBe('function');
      expect(typeof PlatformConnectionModel.delete).toBe('function');
      expect(typeof PlatformConnectionModel.deactivate).toBe('function');
      expect(typeof PlatformConnectionModel.findExpiringSoon).toBe('function');
    });

    it('should have PostModel with required static methods', () => {
      expect(typeof PostModel.create).toBe('function');
      expect(typeof PostModel.findById).toBe('function');
      expect(typeof PostModel.findByUserId).toBe('function');
      expect(typeof PostModel.findByStatus).toBe('function');
      expect(typeof PostModel.findScheduledPosts).toBe('function');
      expect(typeof PostModel.findByUserAndStatus).toBe('function');
      expect(typeof PostModel.findBySource).toBe('function');
      expect(typeof PostModel.update).toBe('function');
      expect(typeof PostModel.updateStatus).toBe('function');
      expect(typeof PostModel.delete).toBe('function');
      expect(typeof PostModel.getPostStats).toBe('function');
    });

    it('should have PlatformPostModel with required static methods', () => {
      expect(typeof PlatformPostModel.create).toBe('function');
      expect(typeof PlatformPostModel.findById).toBe('function');
      expect(typeof PlatformPostModel.findByPostId).toBe('function');
      expect(typeof PlatformPostModel.findByPostAndPlatform).toBe('function');
      expect(typeof PlatformPostModel.findByStatus).toBe('function');
      expect(typeof PlatformPostModel.findByPlatform).toBe('function');
      expect(typeof PlatformPostModel.findFailedPosts).toBe('function');
      expect(typeof PlatformPostModel.update).toBe('function');
      expect(typeof PlatformPostModel.updateStatus).toBe('function');
      expect(typeof PlatformPostModel.incrementRetryCount).toBe('function');
      expect(typeof PlatformPostModel.delete).toBe('function');
      expect(typeof PlatformPostModel.deleteByPostId).toBe('function');
      expect(typeof PlatformPostModel.getPlatformStats).toBe('function');
    });
  });

  describe('Database Connection', () => {
    it('should have database connection utilities', () => {
      // Since we're mocking the database, just check that the mock exists
      const { db } = require('../database/connection');
      
      expect(db).toBeDefined();
      expect(typeof db.query).toBe('function');
      expect(typeof db.healthCheck).toBe('function');
      expect(typeof db.runMigrations).toBe('function');
      expect(typeof db.transaction).toBe('function');
      expect(typeof db.close).toBe('function');
    });
  });

  describe('Migration Files', () => {
    it('should have migration files for all required tables', () => {
      const fs = require('fs');
      const path = require('path');
      
      const migrationsDir = path.join(__dirname, '../database/migrations');
      const migrationFiles = fs.readdirSync(migrationsDir);
      
      expect(migrationFiles).toContain('001_create_users_table.sql');
      expect(migrationFiles).toContain('002_create_platform_connections_table.sql');
      expect(migrationFiles).toContain('003_create_posts_table.sql');
      expect(migrationFiles).toContain('004_create_platform_posts_table.sql');
    });

    it('should have valid SQL in migration files', () => {
      const fs = require('fs');
      const path = require('path');
      
      const migrationsDir = path.join(__dirname, '../database/migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter((file: string) => file.endsWith('.sql'))
        .sort();
      
      migrationFiles.forEach((filename: string) => {
        const migrationPath = path.join(migrationsDir, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Basic SQL validation - should contain CREATE TABLE
        expect(migrationSQL).toContain('CREATE TABLE');
        expect(migrationSQL.length).toBeGreaterThan(0);
      });
    });
  });
});