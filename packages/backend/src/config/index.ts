import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Encryption
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  
  // Social Media APIs
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  PINTEREST_APP_ID: z.string().optional(),
  PINTEREST_APP_SECRET: z.string().optional(),
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  
  // External Integrations
  BLOGGER_API_KEY: z.string().optional(),
  SOLOBOSS_API_KEY: z.string().optional(),
  SOLOBOSS_WEBHOOK_SECRET: z.string().optional(),
  
  // File Storage
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  
  // Queue Configuration
  QUEUE_REDIS_URL: z.string().optional(),
  QUEUE_CONCURRENCY: z.string().transform(Number).default(5),
  
  // Webhook Configuration
  WEBHOOK_TIMEOUT_MS: z.string().transform(Number).default(10000),
  WEBHOOK_RETRY_ATTEMPTS: z.string().transform(Number).default(3),
  
  // Analytics
  ANALYTICS_RETENTION_DAYS: z.string().transform(Number).default(365),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default(12),
  SESSION_TIMEOUT_HOURS: z.string().transform(Number).default(24),
  
  // Feature Flags
  ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default(true),
  ENABLE_WEBHOOKS: z.string().transform(val => val === 'true').default(true),
  ENABLE_RATE_LIMITING: z.string().transform(val => val === 'true').default(true),
  ENABLE_CACHING: z.string().transform(val => val === 'true').default(true)
});

// Validate and parse environment variables
let config: z.infer<typeof envSchema>;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment configuration:');
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Derived configuration
export const Config = {
  ...config,
  
  // Computed values
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  isTest: config.NODE_ENV === 'test',
  
  // Database configuration
  database: {
    url: config.DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    }
  },
  
  // Redis configuration
  redis: {
    url: config.REDIS_URL,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true
  },
  
  // JWT configuration
  jwt: {
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
    algorithm: 'HS256' as const
  },
  
  // CORS configuration
  cors: {
    origin: config.CORS_ORIGIN.split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },
  
  // Platform OAuth configurations
  platforms: {
    facebook: {
      appId: config.FACEBOOK_APP_ID,
      appSecret: config.FACEBOOK_APP_SECRET,
      enabled: !!(config.FACEBOOK_APP_ID && config.FACEBOOK_APP_SECRET)
    },
    instagram: {
      clientId: config.INSTAGRAM_CLIENT_ID,
      clientSecret: config.INSTAGRAM_CLIENT_SECRET,
      enabled: !!(config.INSTAGRAM_CLIENT_ID && config.INSTAGRAM_CLIENT_SECRET)
    },
    pinterest: {
      appId: config.PINTEREST_APP_ID,
      appSecret: config.PINTEREST_APP_SECRET,
      enabled: !!(config.PINTEREST_APP_ID && config.PINTEREST_APP_SECRET)
    },
    x: {
      apiKey: config.X_API_KEY,
      apiSecret: config.X_API_SECRET,
      enabled: !!(config.X_API_KEY && config.X_API_SECRET)
    }
  },
  
  // Integration configurations
  integrations: {
    blogger: {
      apiKey: config.BLOGGER_API_KEY,
      enabled: !!config.BLOGGER_API_KEY
    },
    soloboss: {
      apiKey: config.SOLOBOSS_API_KEY,
      webhookSecret: config.SOLOBOSS_WEBHOOK_SECRET,
      enabled: !!(config.SOLOBOSS_API_KEY && config.SOLOBOSS_WEBHOOK_SECRET)
    }
  },
  
  // File storage configuration
  storage: {
    aws: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      region: config.AWS_REGION,
      bucket: config.AWS_S3_BUCKET,
      enabled: !!(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY && config.AWS_S3_BUCKET)
    }
  },
  
  // Queue configuration
  queue: {
    redis: config.QUEUE_REDIS_URL || config.REDIS_URL,
    concurrency: config.QUEUE_CONCURRENCY,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  },
  
  // Webhook configuration
  webhooks: {
    timeout: config.WEBHOOK_TIMEOUT_MS,
    retryAttempts: config.WEBHOOK_RETRY_ATTEMPTS,
    enabled: config.ENABLE_WEBHOOKS
  },
  
  // Security configuration
  security: {
    bcryptRounds: config.BCRYPT_ROUNDS,
    sessionTimeoutHours: config.SESSION_TIMEOUT_HOURS,
    encryptionKey: config.ENCRYPTION_KEY
  }
};

// Validate required configurations based on enabled features
export function validateConfiguration(): void {
  const errors: string[] = [];
  
  // Check platform configurations
  const enabledPlatforms = Object.entries(Config.platforms)
    .filter(([, config]) => config.enabled)
    .map(([platform]) => platform);
  
  if (enabledPlatforms.length === 0) {
    console.warn('⚠️  No social media platforms are configured. Users will not be able to connect accounts.');
  }
  
  // Check storage configuration
  if (!Config.storage.aws.enabled) {
    console.warn('⚠️  AWS S3 storage is not configured. File uploads will be disabled.');
  }
  
  // Check integration configurations
  if (!Config.integrations.blogger.enabled) {
    console.warn('⚠️  Blogger integration is not configured.');
  }
  
  if (!Config.integrations.soloboss.enabled) {
    console.warn('⚠️  SoloBoss integration is not configured.');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  console.log('✅ Configuration validated successfully');
  console.log(`🚀 Starting in ${Config.NODE_ENV} mode on port ${Config.PORT}`);
}

export default Config;