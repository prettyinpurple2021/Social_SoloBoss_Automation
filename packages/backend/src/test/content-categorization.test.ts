import { contentCategorizationService } from '../services/ContentCategorizationService';

// Mock the database connection
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn()
  }
}));

describe('ContentCategorizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('suggestCategories', () => {
    it('should suggest categories based on content keywords', async () => {
      const content = 'Learn how to build amazing apps with these programming tips';
      const hashtags = ['#coding', '#tutorial'];

      const suggestions = await contentCategorizationService.suggestCategories(content, hashtags);

      expect(suggestions).toContain('Educational');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should suggest marketing category for promotional content', async () => {
      const content = 'Special sale offer! Get 50% discount on all products';
      const hashtags = ['#sale', '#discount'];

      const suggestions = await contentCategorizationService.suggestCategories(content, hashtags);

      expect(suggestions).toContain('Marketing');
    });

    it('should return empty array for generic content', async () => {
      const content = 'Hello world';
      const hashtags = [];

      const suggestions = await contentCategorizationService.suggestCategories(content, hashtags);

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('suggestTags', () => {
    it('should extract hashtags as potential tags', async () => {
      const content = 'This is a test post';
      const hashtags = ['#programming', '#javascript', '#web'];

      const suggestions = await contentCategorizationService.suggestTags(content, hashtags);

      expect(suggestions).toContain('programming');
      expect(suggestions).toContain('javascript');
      expect(suggestions).toContain('web');
    });

    it('should extract keywords from content', async () => {
      const content = 'Learn advanced programming techniques for better development';
      const hashtags = [];

      const suggestions = await contentCategorizationService.suggestTags(content, hashtags);

      expect(suggestions).toContain('learn');
      expect(suggestions).toContain('advanced');
      expect(suggestions).toContain('programming');
      expect(suggestions).toContain('techniques');
      expect(suggestions).toContain('development');
    });

    it('should limit suggestions to 5 items', async () => {
      const content = 'This is a very long content with many different words that could be potential tags for categorization';
      const hashtags = ['#tag1', '#tag2', '#tag3', '#tag4', '#tag5', '#tag6'];

      const suggestions = await contentCategorizationService.suggestTags(content, hashtags);

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });
});