export const VALIDATION_RULES = {
  // User validation
  EMAIL_MAX_LENGTH: 255,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,

  // Post validation
  CONTENT_MIN_LENGTH: 1,
  CONTENT_MAX_LENGTH: 10000,
  HASHTAG_MIN_LENGTH: 2,
  HASHTAG_MAX_LENGTH: 100,
  MAX_HASHTAGS_PER_POST: 50,
  MAX_IMAGES_PER_POST: 10,

  // File validation
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],

  // Template validation
  TEMPLATE_NAME_MIN_LENGTH: 3,
  TEMPLATE_NAME_MAX_LENGTH: 100,
  TEMPLATE_DESCRIPTION_MAX_LENGTH: 500,
  TEMPLATE_CONTENT_MAX_LENGTH: 5000,

  // Integration validation
  WEBHOOK_URL_MAX_LENGTH: 2048,
  API_KEY_MIN_LENGTH: 16,
  API_KEY_MAX_LENGTH: 256,

  // Scheduling validation
  SCHEDULE_ADVANCE_MIN_MINUTES: 5,
  SCHEDULE_ADVANCE_MAX_DAYS: 365,
  BULK_SCHEDULE_MAX_POSTS: 100,

  // Analytics validation
  ANALYTICS_DATE_RANGE_MAX_DAYS: 365,
  EXPORT_MAX_RECORDS: 10000
} as const;

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  HASHTAG: /^#[a-zA-Z0-9_]+$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  TIMEZONE: /^[A-Za-z_]+\/[A-Za-z_]+$/,
  API_KEY: /^[a-zA-Z0-9_-]+$/,
  WEBHOOK_SECRET: /^[a-zA-Z0-9_-]{32,}$/
} as const;

export const CONTENT_LIMITS = {
  FACEBOOK: {
    CHARACTER_LIMIT: 63206,
    HASHTAG_LIMIT: 30,
    IMAGE_LIMIT: 10,
    VIDEO_LIMIT: 1
  },
  INSTAGRAM: {
    CHARACTER_LIMIT: 2200,
    HASHTAG_LIMIT: 30,
    IMAGE_LIMIT: 10,
    VIDEO_LIMIT: 1
  },
  PINTEREST: {
    CHARACTER_LIMIT: 500,
    HASHTAG_LIMIT: 20,
    IMAGE_LIMIT: 1,
    VIDEO_LIMIT: 1
  },
  X: {
    CHARACTER_LIMIT: 280,
    HASHTAG_LIMIT: 2,
    IMAGE_LIMIT: 4,
    VIDEO_LIMIT: 1
  }
} as const;

export const IMAGE_SPECS = {
  FACEBOOK: {
    RECOMMENDED_WIDTH: 1200,
    RECOMMENDED_HEIGHT: 630,
    ASPECT_RATIO: 1.91,
    MIN_WIDTH: 600,
    MIN_HEIGHT: 315
  },
  INSTAGRAM: {
    SQUARE: {
      RECOMMENDED_WIDTH: 1080,
      RECOMMENDED_HEIGHT: 1080,
      ASPECT_RATIO: 1
    },
    PORTRAIT: {
      RECOMMENDED_WIDTH: 1080,
      RECOMMENDED_HEIGHT: 1350,
      ASPECT_RATIO: 0.8
    },
    LANDSCAPE: {
      RECOMMENDED_WIDTH: 1080,
      RECOMMENDED_HEIGHT: 566,
      ASPECT_RATIO: 1.91
    }
  },
  PINTEREST: {
    RECOMMENDED_WIDTH: 1000,
    RECOMMENDED_HEIGHT: 1500,
    ASPECT_RATIO: 0.67,
    MIN_WIDTH: 600,
    MIN_HEIGHT: 900
  },
  X: {
    RECOMMENDED_WIDTH: 1200,
    RECOMMENDED_HEIGHT: 675,
    ASPECT_RATIO: 1.78,
    MIN_WIDTH: 600,
    MIN_HEIGHT: 335
  }
} as const;