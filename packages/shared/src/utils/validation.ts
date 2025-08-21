import { Platform } from '../types/platform';
import { PostData } from '../types/post';
import { PLATFORM_CHARACTER_LIMITS, PLATFORM_HASHTAG_LIMITS, PLATFORM_IMAGE_LIMITS } from '../constants/platforms';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Additional check for consecutive dots
  if (email.includes('..')) {
    return false;
  }
  return emailRegex.test(email);
}

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: []
  };
}

export function validatePostContent(post: PostData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate required fields
  if (!post.content || post.content.trim().length === 0) {
    errors.push('Post content is required');
  }
  
  if (!post.platforms || post.platforms.length === 0) {
    errors.push('At least one platform must be selected');
  }
  
  if (!post.userId) {
    errors.push('User ID is required');
  }
  
  // Validate platform-specific constraints
  for (const platform of post.platforms) {
    const contentLength = post.content.length;
    const characterLimit = PLATFORM_CHARACTER_LIMITS[platform];
    
    if (contentLength > characterLimit) {
      errors.push(`Content exceeds ${platform} character limit (${contentLength}/${characterLimit})`);
    } else if (contentLength > characterLimit * 0.9) {
      warnings.push(`Content is close to ${platform} character limit (${contentLength}/${characterLimit})`);
    }
    
    // Validate hashtags
    if (post.hashtags && post.hashtags.length > PLATFORM_HASHTAG_LIMITS[platform]) {
      errors.push(`Too many hashtags for ${platform} (${post.hashtags.length}/${PLATFORM_HASHTAG_LIMITS[platform]})`);
    }
    
    // Validate images
    if (post.images && post.images.length > PLATFORM_IMAGE_LIMITS[platform]) {
      errors.push(`Too many images for ${platform} (${post.images.length}/${PLATFORM_IMAGE_LIMITS[platform]})`);
    }
  }
  
  // Validate scheduled time
  if (post.scheduledTime && post.scheduledTime <= new Date()) {
    errors.push('Scheduled time must be in the future');
  }
  
  // Validate hashtags format
  if (post.hashtags) {
    for (const hashtag of post.hashtags) {
      if (!hashtag.startsWith('#')) {
        errors.push(`Hashtag "${hashtag}" must start with #`);
      }
      
      if (hashtag.length < 2) {
        errors.push(`Hashtag "${hashtag}" is too short`);
      }
      
      if (!/^#[a-zA-Z0-9_]+$/.test(hashtag)) {
        errors.push(`Hashtag "${hashtag}" contains invalid characters`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validatePlatform(platform: string): platform is Platform {
  return Object.values(Platform).includes(platform as Platform);
}

export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function sanitizeContent(content: string): string {
  return content
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
}

export function validateImageUrl(url: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!validateUrl(url)) {
    errors.push('Invalid image URL format');
    return { isValid: false, errors, warnings };
  }
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasValidExtension = imageExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  if (!hasValidExtension) {
    warnings.push('Image URL does not have a recognized image file extension');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}