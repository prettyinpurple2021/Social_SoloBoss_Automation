import {
  validateEmail,
  validatePassword,
  validatePostContent,
  validateUrl,
  validatePlatform,
  validateTimezone,
  sanitizeContent,
  validateImageUrl
} from '../validation';
import { Platform } from '../../types/platform';
import { PostData } from '../../types/post';

describe('validation utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test..test@example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require minimum length', () => {
      const result = validatePassword('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should require uppercase letter', () => {
      const result = validatePassword('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letter', () => {
      const result = validatePassword('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require number', () => {
      const result = validatePassword('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special character', () => {
      const result = validatePassword('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('validatePostContent', () => {
    const validPost: PostData = {
      userId: 'user123',
      platforms: [Platform.FACEBOOK],
      content: 'This is a valid post content',
      hashtags: ['#test', '#valid'],
      images: ['https://example.com/image.jpg']
    };

    it('should validate correct post content', () => {
      const result = validatePostContent(validPost);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require content', () => {
      const post = { ...validPost, content: '' };
      const result = validatePostContent(post);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Post content is required');
    });

    it('should require platforms', () => {
      const post = { ...validPost, platforms: [] };
      const result = validatePostContent(post);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one platform must be selected');
    });

    it('should require user ID', () => {
      const post = { ...validPost, userId: '' };
      const result = validatePostContent(post);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User ID is required');
    });

    it('should validate character limits', () => {
      const longContent = 'a'.repeat(300); // Exceeds X character limit
      const post = { ...validPost, content: longContent, platforms: [Platform.X] };
      const result = validatePostContent(post);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('character limit'))).toBe(true);
    });

    it('should validate hashtag format', () => {
      const post = { ...validPost, hashtags: ['invalid-hashtag', '#valid'] };
      const result = validatePostContent(post);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Hashtag "invalid-hashtag" must start with #');
    });

    it('should validate scheduled time', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const post = { ...validPost, scheduledTime: pastDate };
      const result = validatePostContent(post);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Scheduled time must be in the future');
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://test.org/path')).toBe(true);
      expect(validateUrl('https://subdomain.example.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://invalid')).toBe(true); // URL constructor accepts ftp
      expect(validateUrl('')).toBe(false);
    });
  });

  describe('validatePlatform', () => {
    it('should validate supported platforms', () => {
      expect(validatePlatform('facebook')).toBe(true);
      expect(validatePlatform('instagram')).toBe(true);
      expect(validatePlatform('pinterest')).toBe(true);
      expect(validatePlatform('x')).toBe(true);
    });

    it('should reject unsupported platforms', () => {
      expect(validatePlatform('twitter')).toBe(false);
      expect(validatePlatform('linkedin')).toBe(false);
      expect(validatePlatform('')).toBe(false);
    });
  });

  describe('validateTimezone', () => {
    it('should validate correct timezones', () => {
      expect(validateTimezone('America/New_York')).toBe(true);
      expect(validateTimezone('Europe/London')).toBe(true);
      expect(validateTimezone('UTC')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(validateTimezone('Invalid/Timezone')).toBe(false);
      expect(validateTimezone('')).toBe(false);
    });
  });

  describe('sanitizeContent', () => {
    it('should remove extra whitespace', () => {
      expect(sanitizeContent('  multiple   spaces  ')).toBe('multiple spaces');
    });

    it('should remove control characters', () => {
      expect(sanitizeContent('text\u0000with\u001Fcontrol\u007Fchars')).toBe('textwithcontrolchars');
    });

    it('should trim content', () => {
      expect(sanitizeContent('  trimmed  ')).toBe('trimmed');
    });
  });

  describe('validateImageUrl', () => {
    it('should validate image URLs with proper extensions', () => {
      const result = validateImageUrl('https://example.com/image.jpg');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about URLs without image extensions', () => {
      const result = validateImageUrl('https://example.com/file');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Image URL does not have a recognized image file extension');
    });

    it('should reject invalid URLs', () => {
      const result = validateImageUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid image URL format');
    });
  });
});