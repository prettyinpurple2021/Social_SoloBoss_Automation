export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_VERIFY_EMAIL: '/auth/verify-email',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',

  // Users
  USERS_PROFILE: '/users/profile',
  USERS_SETTINGS: '/users/settings',
  USERS_DELETE: '/users/delete',

  // Posts
  POSTS_LIST: '/posts',
  POSTS_CREATE: '/posts',
  POSTS_UPDATE: '/posts/:id',
  POSTS_DELETE: '/posts/:id',
  POSTS_SCHEDULE: '/posts/:id/schedule',
  POSTS_PUBLISH: '/posts/:id/publish',
  POSTS_DUPLICATE: '/posts/:id/duplicate',

  // Platform Connections
  PLATFORMS_LIST: '/platforms',
  PLATFORMS_CONNECT: '/platforms/:platform/connect',
  PLATFORMS_DISCONNECT: '/platforms/:platform/disconnect',
  PLATFORMS_REFRESH: '/platforms/:platform/refresh',
  PLATFORMS_STATUS: '/platforms/:platform/status',

  // OAuth
  OAUTH_AUTHORIZE: '/oauth/:platform/authorize',
  OAUTH_CALLBACK: '/oauth/:platform/callback',
  OAUTH_REVOKE: '/oauth/:platform/revoke',

  // Analytics
  ANALYTICS_OVERVIEW: '/analytics/overview',
  ANALYTICS_POSTS: '/analytics/posts',
  ANALYTICS_PLATFORMS: '/analytics/platforms',
  ANALYTICS_EXPORT: '/analytics/export',

  // Integrations
  INTEGRATIONS_LIST: '/integrations',
  INTEGRATIONS_CREATE: '/integrations',
  INTEGRATIONS_UPDATE: '/integrations/:id',
  INTEGRATIONS_DELETE: '/integrations/:id',
  INTEGRATIONS_TEST: '/integrations/:id/test',

  // Webhooks
  WEBHOOKS_BLOGGER: '/webhooks/blogger',
  WEBHOOKS_SOLOBOSS: '/webhooks/soloboss',

  // Templates
  TEMPLATES_LIST: '/templates',
  TEMPLATES_CREATE: '/templates',
  TEMPLATES_UPDATE: '/templates/:id',
  TEMPLATES_DELETE: '/templates/:id',

  // Scheduling
  SCHEDULING_RULES: '/scheduling/rules',
  SCHEDULING_OPTIMAL_TIMES: '/scheduling/optimal-times',
  SCHEDULING_BULK: '/scheduling/bulk',
  SCHEDULING_RECURRING: '/scheduling/recurring',

  // Health & Status
  HEALTH_CHECK: '/health',
  STATUS: '/status',
  VERSION: '/version'
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

export const API_RATE_LIMITS = {
  DEFAULT: 100, // requests per minute
  AUTH: 10, // login attempts per minute
  POSTS: 50, // post operations per minute
  ANALYTICS: 30, // analytics requests per minute
  WEBHOOKS: 1000 // webhook requests per minute
} as const;

export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  UPLOAD: 120000, // 2 minutes
  ANALYTICS: 60000, // 1 minute
  WEBHOOK: 10000 // 10 seconds
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1
} as const;

export const CACHE_KEYS = {
  USER_PROFILE: 'user:profile:',
  USER_SETTINGS: 'user:settings:',
  PLATFORM_CONNECTIONS: 'platforms:connections:',
  POST_ANALYTICS: 'analytics:post:',
  OPTIMAL_TIMES: 'scheduling:optimal:',
  TEMPLATES: 'templates:user:'
} as const;

export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400 // 24 hours
} as const;