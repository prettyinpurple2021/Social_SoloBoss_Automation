import { db } from './connection';
import fs from 'fs';
import path from 'path';

/**
 * Database seeding utility for development and testing environments
 */
export class DatabaseSeeder {
  private seedsDir: string;

  constructor() {
    this.seedsDir = path.join(__dirname, 'seeds');
  }

  /**
   * Run seed files for the specified environment
   */
  async seed(environment: 'development' | 'test' = 'development'): Promise<void> {
    try {
      console.log(`Starting database seeding for ${environment} environment...`);

      // Check if database is healthy
      const isHealthy = await db.healthCheck();
      if (!isHealthy) {
        throw new Error('Database connection failed');
      }

      // Clear existing data in test environment
      if (environment === 'test') {
        await this.clearTestData();
      }

      // Run seed file for the environment
      const seedFile = path.join(this.seedsDir, `${environment}.sql`);
      
      if (!fs.existsSync(seedFile)) {
        console.warn(`Seed file not found: ${seedFile}`);
        return;
      }

      const seedSQL = fs.readFileSync(seedFile, 'utf8');
      
      await db.transaction(async (client) => {
        // Split SQL file by statements and execute each one
        const statements = seedSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== 'COMMIT');

        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement);
          }
        }
      });

      console.log(`Database seeding completed for ${environment} environment`);
    } catch (error) {
      console.error('Failed to seed database:', error);
      throw error;
    }
  }

  /**
   * Clear test data from all tables
   */
  private async clearTestData(): Promise<void> {
    console.log('Clearing existing test data...');
    
    await db.transaction(async (client) => {
      // Disable foreign key checks temporarily
      await client.query('SET session_replication_role = replica;');
      
      // Get all table names
      const result = await client.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename != 'migrations'
        ORDER BY tablename
      `);
      
      // Truncate all tables
      for (const row of result.rows) {
        await client.query(`TRUNCATE TABLE ${row.tablename} RESTART IDENTITY CASCADE`);
      }
      
      // Re-enable foreign key checks
      await client.query('SET session_replication_role = DEFAULT;');
    });
    
    console.log('Test data cleared successfully');
  }

  /**
   * Create a custom seed with provided data
   */
  async customSeed(data: {
    users?: any[];
    posts?: any[];
    platformConnections?: any[];
    integrations?: any[];
  }): Promise<void> {
    try {
      console.log('Running custom seed...');

      await db.transaction(async (client) => {
        // Seed users
        if (data.users && data.users.length > 0) {
          for (const user of data.users) {
            await client.query(`
              INSERT INTO users (id, email, name, password_hash, email_verified, timezone, settings)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (email) DO NOTHING
            `, [
              user.id,
              user.email,
              user.name,
              user.password_hash,
              user.email_verified || false,
              user.timezone || 'UTC',
              JSON.stringify(user.settings || {})
            ]);
          }
        }

        // Seed platform connections
        if (data.platformConnections && data.platformConnections.length > 0) {
          for (const connection of data.platformConnections) {
            await client.query(`
              INSERT INTO platform_connections (id, user_id, platform, platform_user_id, platform_username, access_token, refresh_token, token_expires_at, scopes, is_active, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (user_id, platform) DO NOTHING
            `, [
              connection.id,
              connection.user_id,
              connection.platform,
              connection.platform_user_id,
              connection.platform_username,
              connection.access_token,
              connection.refresh_token,
              connection.token_expires_at,
              connection.scopes || [],
              connection.is_active !== false,
              JSON.stringify(connection.metadata || {})
            ]);
          }
        }

        // Seed posts
        if (data.posts && data.posts.length > 0) {
          for (const post of data.posts) {
            await client.query(`
              INSERT INTO posts (id, user_id, content, images, hashtags, platforms, platform_specific_content, scheduled_time, status, source, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (id) DO NOTHING
            `, [
              post.id,
              post.user_id,
              post.content,
              post.images || [],
              post.hashtags || [],
              post.platforms,
              JSON.stringify(post.platform_specific_content || {}),
              post.scheduled_time,
              post.status || 'draft',
              post.source || 'manual',
              JSON.stringify(post.metadata || {})
            ]);
          }
        }

        // Seed integrations
        if (data.integrations && data.integrations.length > 0) {
          for (const integration of data.integrations) {
            await client.query(`
              INSERT INTO integrations (user_id, integration_type, configuration, is_active)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (user_id, integration_type) DO NOTHING
            `, [
              integration.user_id,
              integration.integration_type,
              JSON.stringify(integration.configuration),
              integration.is_active !== false
            ]);
          }
        }
      });

      console.log('Custom seed completed successfully');
    } catch (error) {
      console.error('Failed to run custom seed:', error);
      throw error;
    }
  }

  /**
   * Generate test data for performance testing
   */
  async generatePerformanceTestData(userCount: number = 100, postsPerUser: number = 50): Promise<void> {
    console.log(`Generating performance test data: ${userCount} users, ${postsPerUser} posts per user...`);

    await db.transaction(async (client) => {
      // Generate users
      for (let i = 1; i <= userCount; i++) {
        await client.query(`
          INSERT INTO users (email, name, password_hash, email_verified, timezone)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (email) DO NOTHING
        `, [
          `perftest${i}@example.com`,
          `Performance Test User ${i}`,
          '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQq',
          true,
          'UTC'
        ]);

        // Generate posts for each user
        for (let j = 1; j <= postsPerUser; j++) {
          await client.query(`
            INSERT INTO posts (user_id, content, platforms, status, source)
            SELECT id, $1, $2, $3, $4
            FROM users 
            WHERE email = $5
          `, [
            `Performance test post ${j} content for user ${i}`,
            ['facebook', 'instagram'],
            Math.random() > 0.5 ? 'published' : 'draft',
            'manual',
            `perftest${i}@example.com`
          ]);
        }
      }
    });

    console.log('Performance test data generated successfully');
  }
}

// Export singleton instance
export const seeder = new DatabaseSeeder();

// Run seeding if this file is executed directly
if (require.main === module) {
  const environment = (process.argv[2] as 'development' | 'test') || 'development';
  
  seeder.seed(environment)
    .then(() => {
      console.log(`Database seeding completed for ${environment}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database seeding failed:', error);
      process.exit(1);
    });
}