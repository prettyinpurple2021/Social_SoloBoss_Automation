import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  acquireTimeoutMillis: number;
  ssl?: boolean | object;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool!: Pool;
  private config: DatabaseConfig;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;

  private constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'social_media_automation',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_POOL_MAX || '20'), // maximum number of clients in the pool
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // close idle clients after 30 seconds
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'), // return an error after 2 seconds if connection could not be established
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'), // timeout for acquiring a client from the pool
    };

    // Add SSL configuration for production
    if (process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true') {
      this.config.ssl = {
        rejectUnauthorized: false
      };
    }

    this.initializePool();
  }

  private initializePool(): void {
    this.pool = new Pool(this.config);

    // Handle pool errors with retry logic
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      this.isConnected = false;
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`Attempting to reconnect to database (attempt ${this.connectionRetries}/${this.maxRetries})`);
        setTimeout(() => this.reconnect(), 5000 * this.connectionRetries); // exponential backoff
      } else {
        console.error('Max database connection retries exceeded. Exiting...');
        process.exit(-1);
      }
    });

    // Handle successful connections
    this.pool.on('connect', () => {
      this.isConnected = true;
      this.connectionRetries = 0;
      console.log('Database connection established');
    });

    // Handle client acquisition
    this.pool.on('acquire', () => {
      console.log('Database client acquired from pool');
    });

    // Handle client release
    this.pool.on('release', () => {
      console.log('Database client released back to pool');
    });
  }

  private async reconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.initializePool();
      await this.healthCheck();
    } catch (error) {
      console.error('Failed to reconnect to database:', error);
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        setTimeout(() => this.reconnect(), 5000 * this.connectionRetries);
      } else {
        process.exit(-1);
      }
    }
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    const queryId = Math.random().toString(36).substring(7);
    
    try {
      // Check if pool is healthy before executing query
      if (!this.isConnected) {
        await this.healthCheck();
      }

      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      // Log query performance (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Query executed', { 
          queryId, 
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
          duration, 
          rows: result.rowCount 
        });
      }
      
      // Log slow queries in production
      if (duration > 1000) {
        console.warn('Slow query detected', { 
          queryId, 
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
          duration, 
          rows: result.rowCount 
        });
      }
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      console.error('Database query error', { 
        queryId,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
        params: params ? '[REDACTED]' : undefined, 
        duration,
        error: error.message,
        code: error.code,
        detail: error.detail
      });
      
      // Handle specific database errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        this.isConnected = false;
        throw new Error('Database connection lost. Please try again.');
      }
      
      if (error.code === '23505') { // Unique violation
        throw new Error('A record with this information already exists.');
      }
      
      if (error.code === '23503') { // Foreign key violation
        throw new Error('Referenced record does not exist.');
      }
      
      if (error.code === '23514') { // Check constraint violation
        throw new Error('Data validation failed.');
      }
      
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    const transactionId = Math.random().toString(36).substring(7);
    const start = Date.now();
    
    try {
      await client.query('BEGIN');
      console.log(`Transaction started: ${transactionId}`);
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      const duration = Date.now() - start;
      console.log(`Transaction committed: ${transactionId} (${duration}ms)`);
      
      return result;
    } catch (error: any) {
      try {
        await client.query('ROLLBACK');
        const duration = Date.now() - start;
        console.error(`Transaction rolled back: ${transactionId} (${duration}ms)`, {
          error: error.message,
          code: error.code
        });
      } catch (rollbackError: any) {
        console.error(`Failed to rollback transaction: ${transactionId}`, {
          originalError: error.message,
          rollbackError: rollbackError.message
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async runMigrations(): Promise<void> {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Create migrations table if it doesn't exist
    await this.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get executed migrations
    const executedMigrations = await this.query<{ filename: string }>(
      'SELECT filename FROM migrations ORDER BY id'
    );
    const executedFilenames = new Set(executedMigrations.rows.map(row => row.filename));

    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (!executedFilenames.has(filename)) {
        console.log(`Running migration: ${filename}`);
        const migrationPath = path.join(migrationsDir, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await this.transaction(async (client) => {
          await client.query(migrationSQL);
          await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
        });
        
        console.log(`Migration completed: ${filename}`);
      }
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const start = Date.now();
      await this.query('SELECT 1 as health_check');
      const duration = Date.now() - start;
      
      this.isConnected = true;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Database health check passed (${duration}ms)`);
      }
      
      return true;
    } catch (error: any) {
      this.isConnected = false;
      console.error('Database health check failed:', {
        error: error.message,
        code: error.code,
        host: this.config.host,
        database: this.config.database
      });
      return false;
    }
  }

  public async getPoolStats(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance();