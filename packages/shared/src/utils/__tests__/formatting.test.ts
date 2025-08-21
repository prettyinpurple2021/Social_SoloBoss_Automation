import {
  formatPostForPlatform,
  truncateContent,
  extractHashtags,
  removeHashtags,
  formatDateTime,
  formatRelativeTime,
  generatePostPreview,
  formatFileSize,
  slugify,
  capitalizeWords,
  formatPlatformName,
  generateUniqueId,
  formatErrorMessage
} from '../formatting';
import { Platform } from '../../types/platform';
import { PostData } from '../../types/post';

describe('formatting utilities', () => {
  describe('formatPostForPlatform', () => {
    const basePost: PostData = {
      userId: 'user123',
      platforms: [Platform.FACEBOOK],
      content: 'This is a test post',
      hashtags: ['#test', '#social']
    };

    it('should format post with hashtags', () => {
      const formatted = formatPostForPlatform(basePost, Platform.FACEBOOK);
      expect(formatted).toBe('This is a test post\n\n#test #social');
    });

    it('should format post without hashtags', () => {
      const post = { ...basePost, hashtags: undefined };
      const formatted = formatPostForPlatform(post, Platform.FACEBOOK);
      expect(formatted).toBe('This is a test post');
    });

    it('should truncate long content', () => {
      const longContent = 'a'.repeat(300);
      const post = { ...basePost, content: longContent };
      const formatted = formatPostForPlatform(post, Platform.X);
      expect(formatted.length).toBeLessThanOrEqual(280);
      expect(formatted).toContain('...');
    });
  });

  describe('truncateContent', () => {
    it('should not truncate short content', () => {
      const content = 'Short content';
      expect(truncateContent(content, 100)).toBe(content);
    });

    it('should truncate long content', () => {
      const content = 'This is a very long piece of content that needs to be truncated';
      const truncated = truncateContent(content, 30);
      expect(truncated.length).toBeLessThanOrEqual(30);
      expect(truncated).toContain('...');
    });

    it('should truncate at word boundary when possible', () => {
      const content = 'This is a test sentence that should be truncated';
      const truncated = truncateContent(content, 20);
      expect(truncated).toBe('This is a test...');
    });
  });

  describe('extractHashtags', () => {
    it('should extract hashtags from content', () => {
      const content = 'This is a post with #hashtag1 and #hashtag2';
      const hashtags = extractHashtags(content);
      expect(hashtags).toEqual(['#hashtag1', '#hashtag2']);
    });

    it('should return empty array when no hashtags', () => {
      const content = 'This post has no hashtags';
      const hashtags = extractHashtags(content);
      expect(hashtags).toEqual([]);
    });

    it('should handle hashtags with numbers and underscores', () => {
      const content = 'Post with #hashtag_1 and #test123';
      const hashtags = extractHashtags(content);
      expect(hashtags).toEqual(['#hashtag_1', '#test123']);
    });
  });

  describe('removeHashtags', () => {
    it('should remove hashtags from content', () => {
      const content = 'This is a post with #hashtag1 and #hashtag2';
      const cleaned = removeHashtags(content);
      expect(cleaned).toBe('This is a post with and');
    });

    it('should handle content without hashtags', () => {
      const content = 'This post has no hashtags';
      const cleaned = removeHashtags(content);
      expect(cleaned).toBe(content);
    });
  });

  describe('formatDateTime', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDateTime(date);
      expect(formatted).toMatch(/Jan 15, 2024/);
    });

    it('should format date with timezone', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDateTime(date, 'America/New_York');
      expect(formatted).toMatch(/Jan 15, 2024/);
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "just now" for recent dates', () => {
      const date = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      expect(formatRelativeTime(date)).toBe('just now');
    });

    it('should return minutes for recent dates', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      expect(formatRelativeTime(date)).toBe('5 minutes ago');
    });

    it('should return hours for dates within a day', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      expect(formatRelativeTime(date)).toBe('3 hours ago');
    });

    it('should return days for dates within a week', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      expect(formatRelativeTime(date)).toBe('2 days ago');
    });
  });

  describe('generatePostPreview', () => {
    it('should generate preview for short posts', () => {
      const post: PostData = {
        userId: 'user123',
        platforms: [Platform.FACEBOOK],
        content: 'Short post'
      };
      const preview = generatePostPreview(post, Platform.FACEBOOK);
      expect(preview).toBe('Short post');
    });

    it('should truncate long posts', () => {
      const longContent = 'a'.repeat(150);
      const post: PostData = {
        userId: 'user123',
        platforms: [Platform.FACEBOOK],
        content: longContent
      };
      const preview = generatePostPreview(post, Platform.FACEBOOK);
      expect(preview.length).toBeLessThanOrEqual(100);
      expect(preview).toContain('...');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500.0 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1610612736)).toBe('1.5 GB');
    });
  });

  describe('slugify', () => {
    it('should convert text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    it('should handle multiple hyphens', () => {
      expect(slugify('Hello--World')).toBe('hello-world');
    });
  });

  describe('capitalizeWords', () => {
    it('should capitalize each word', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
    });

    it('should handle mixed case', () => {
      expect(capitalizeWords('hELLo WoRLD')).toBe('Hello World');
    });
  });

  describe('formatPlatformName', () => {
    it('should format platform names correctly', () => {
      expect(formatPlatformName(Platform.FACEBOOK)).toBe('Facebook');
      expect(formatPlatformName(Platform.INSTAGRAM)).toBe('Instagram');
      expect(formatPlatformName(Platform.PINTEREST)).toBe('Pinterest');
      expect(formatPlatformName(Platform.X)).toBe('X');
    });
  });

  describe('generateUniqueId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format Error objects', () => {
      const error = new Error('Test error');
      expect(formatErrorMessage(error)).toBe('Test error');
    });

    it('should format string errors', () => {
      expect(formatErrorMessage('String error')).toBe('String error');
    });

    it('should handle unknown errors', () => {
      expect(formatErrorMessage({ unknown: 'error' })).toBe('An unknown error occurred');
    });
  });
});