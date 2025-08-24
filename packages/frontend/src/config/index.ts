// Frontend configuration
interface AppConfig {
  apiUrl: string;
  appName: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  features: {
    analytics: boolean;
    notifications: boolean;
    pwa: boolean;
    darkMode: boolean;
  };
  limits: {
    maxFileSize: number; // bytes
    maxFilesPerPost: number;
    maxPostLength: number;
  };
  oauth: {
    redirectUrl: string;
  };
  cache: {
    defaultTTL: number; // seconds
    maxSize: number; // number of items
  };
}

// Get environment variables with defaults
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  return import.meta.env[key] || defaultValue;
};

const getBooleanEnvVar = (key: string, defaultValue: boolean = false): boolean => {
  const value = getEnvVar(key);
  return value === 'true' || (value === '' && defaultValue);
};

const getNumberEnvVar = (key: string, defaultValue: number): number => {
  const value = getEnvVar(key);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Configuration object
export const config: AppConfig = {
  apiUrl: getEnvVar('VITE_API_URL', 'http://localhost:3001/api'),
  appName: getEnvVar('VITE_APP_NAME', 'Social Media Automation'),
  version: getEnvVar('VITE_APP_VERSION', '1.0.0'),
  environment: (getEnvVar('VITE_NODE_ENV', 'development') as AppConfig['environment']),
  
  features: {
    analytics: getBooleanEnvVar('VITE_ENABLE_ANALYTICS', true),
    notifications: getBooleanEnvVar('VITE_ENABLE_NOTIFICATIONS', true),
    pwa: getBooleanEnvVar('VITE_ENABLE_PWA', true),
    darkMode: getBooleanEnvVar('VITE_ENABLE_DARK_MODE', true)
  },
  
  limits: {
    maxFileSize: getNumberEnvVar('VITE_MAX_FILE_SIZE', 50 * 1024 * 1024), // 50MB
    maxFilesPerPost: getNumberEnvVar('VITE_MAX_FILES_PER_POST', 10),
    maxPostLength: getNumberEnvVar('VITE_MAX_POST_LENGTH', 10000)
  },
  
  oauth: {
    redirectUrl: getEnvVar('VITE_OAUTH_REDIRECT_URL', `${window.location.origin}/auth/callback`)
  },
  
  cache: {
    defaultTTL: getNumberEnvVar('VITE_CACHE_TTL', 300), // 5 minutes
    maxSize: getNumberEnvVar('VITE_CACHE_MAX_SIZE', 100)
  }
};

// Validation
export function validateConfig(): void {
  const errors: string[] = [];
  
  if (!config.apiUrl) {
    errors.push('API URL is required');
  }
  
  try {
    new URL(config.apiUrl);
  } catch {
    errors.push('API URL must be a valid URL');
  }
  
  if (config.limits.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }
  
  if (config.limits.maxFilesPerPost <= 0) {
    errors.push('Max files per post must be greater than 0');
  }
  
  if (config.limits.maxPostLength <= 0) {
    errors.push('Max post length must be greater than 0');
  }
  
  if (errors.length > 0) {
    console.error('❌ Frontend configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Invalid configuration');
  }
  
  console.log('✅ Frontend configuration validated successfully');
}

// Development helpers
export const isDevelopment = config.environment === 'development';
export const isProduction = config.environment === 'production';
export const isTest = config.environment === 'test';

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  
  // Users
  PROFILE: '/users/profile',
  SETTINGS: '/users/settings',
  
  // Posts
  POSTS: '/posts',
  POST_BY_ID: (id: string) => `/posts/${id}`,
  SCHEDULE_POST: (id: string) => `/posts/${id}/schedule`,
  PUBLISH_POST: (id: string) => `/posts/${id}/publish`,
  
  // Platforms
  PLATFORMS: '/platforms',
  PLATFORM_CONNECT: (platform: string) => `/platforms/${platform}/connect`,
  PLATFORM_DISCONNECT: (platform: string) => `/platforms/${platform}/disconnect`,
  
  // OAuth
  OAUTH_AUTHORIZE: (platform: string) => `/oauth/${platform}/authorize`,
  OAUTH_CALLBACK: (platform: string) => `/oauth/${platform}/callback`,
  
  // Analytics
  ANALYTICS_OVERVIEW: '/analytics/overview',
  ANALYTICS_POSTS: '/analytics/posts',
  ANALYTICS_PLATFORMS: '/analytics/platforms',
  
  // Integrations
  INTEGRATIONS: '/integrations',
  INTEGRATION_BY_ID: (id: string) => `/integrations/${id}`,
  
  // Templates
  TEMPLATES: '/templates',
  TEMPLATE_BY_ID: (id: string) => `/templates/${id}`,
  
  // Health
  HEALTH: '/health'
} as const;

// Storage keys for localStorage/sessionStorage
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'sma_auth_token',
  REFRESH_TOKEN: 'sma_refresh_token',
  USER_PREFERENCES: 'sma_user_preferences',
  THEME: 'sma_theme',
  LANGUAGE: 'sma_language',
  DRAFT_POSTS: 'sma_draft_posts',
  LAST_SYNC: 'sma_last_sync'
} as const;

// Default values
export const DEFAULTS = {
  PAGINATION_SIZE: 20,
  DEBOUNCE_DELAY: 300,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  TOAST_DURATION: 5000,
  MODAL_ANIMATION_DURATION: 200
} as const;

export default config;