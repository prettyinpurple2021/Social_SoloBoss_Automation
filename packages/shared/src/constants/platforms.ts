import { Platform } from '../types/platform';

export const PLATFORM_NAMES: Record<Platform, string> = {
  [Platform.FACEBOOK]: 'Facebook Business Page',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.PINTEREST]: 'Pinterest',
  [Platform.X]: 'X (formerly Twitter)'
};

export const PLATFORM_CHARACTER_LIMITS: Record<Platform, number> = {
  [Platform.FACEBOOK]: 63206,
  [Platform.INSTAGRAM]: 2200,
  [Platform.PINTEREST]: 500,
  [Platform.X]: 280
};

export const PLATFORM_IMAGE_LIMITS: Record<Platform, number> = {
  [Platform.FACEBOOK]: 10,
  [Platform.INSTAGRAM]: 10,
  [Platform.PINTEREST]: 1,
  [Platform.X]: 4
};

export const PLATFORM_HASHTAG_LIMITS: Record<Platform, number> = {
  [Platform.FACEBOOK]: 30,
  [Platform.INSTAGRAM]: 30,
  [Platform.PINTEREST]: 20,
  [Platform.X]: 2
};

export const PLATFORM_API_ENDPOINTS: Record<Platform, string> = {
  [Platform.FACEBOOK]: 'https://graph.facebook.com/v18.0',
  [Platform.INSTAGRAM]: 'https://graph.facebook.com/v18.0',
  [Platform.PINTEREST]: 'https://api.pinterest.com/v5',
  [Platform.X]: 'https://api.twitter.com/2'
};

export const OAUTH_SCOPES: Record<Platform, string[]> = {
  [Platform.FACEBOOK]: ['pages_manage_posts', 'pages_read_engagement'],
  [Platform.INSTAGRAM]: ['instagram_basic', 'instagram_content_publish'],
  [Platform.PINTEREST]: ['boards:read', 'pins:write'],
  [Platform.X]: ['tweet.read', 'tweet.write', 'users.read']
};

export const SUPPORTED_PLATFORMS = Object.values(Platform);

export const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.FACEBOOK]: '#1877F2',
  [Platform.INSTAGRAM]: '#E4405F',
  [Platform.PINTEREST]: '#BD081C',
  [Platform.X]: '#000000'
};