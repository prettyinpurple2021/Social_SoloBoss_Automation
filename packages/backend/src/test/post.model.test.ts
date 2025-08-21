import { PostModel } from '../models/Post';
import { db } from '../database/connection';
import { PostStatus, PostSource, Platform } from '../types/database';

// Mock the database connection
jest.mock('../database/connection');
const mockDb = db as jest.Mocked<typeof db>;

describe('PostModel', () => {
  const mockUserId = 'user-123';
  const mockPostId = 'post-123';
  
  const mockPostRow = {
    id: mockPostId,
    user_id: mockUserId,
    content: 'Test post content',
    images: [],
    hashtags: ['test', 'social'],
    platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
    scheduled_time: undefined,
    status: PostStatus.DRAFT,
    source: PostSource.MANUAL,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new post with all fields', async () => {
      const createInput = {
        user_id: mockUserId,
        content: 'Test post content',
        images: ['image1.jpg'],
        hashtags: ['test', 'social'],
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
        scheduled_time: new Date(),
        status: PostStatus.SCHEDULED,
        source: PostSource.MANUAL
      };

      mockDb.query.mockResolvedValue({ rows: [mockPostRow] } as any);

      const result = await PostModel.create(createInput);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO posts'),
        [
          createInput.user_id,
          createInput.content,
          createInput.images,
          createInput.hashtags,
          createInput.platforms,
          createInput.scheduled_time,
          createInput.status,
          createInput.source
        ]
      );
      expect(result).toEqual(mockPostRow);
    });

    it('should create a post with default values', async () => {
      const createInput = {
        user_id: mockUserId,
        content: 'Test post content',
        platforms: [Platform.FACEBOOK]
      };

      mockDb.query.mockResolvedValue({ rows: [mockPostRow] } as any);

      await PostModel.create(createInput);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO posts'),
        [
          createInput.user_id,
          createInput.content,
          [],
          [],
          createInput.platforms,
          null,
          PostStatus.DRAFT,
          PostSource.MANUAL
        ]
      );
    });
  });

  describe('findById', () => {
    it('should find a post by ID', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockPostRow] } as any);

      const result = await PostModel.findById(mockPostId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM posts WHERE id = $1',
        [mockPostId]
      );
      expect(result).toEqual(mockPostRow);
    });

    it('should return null when post not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await PostModel.findById(mockPostId);

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find posts by user ID with pagination', async () => {
      const mockPosts = [mockPostRow];
      mockDb.query.mockResolvedValue({ rows: mockPosts } as any);

      const result = await PostModel.findByUserId(mockUserId, 10, 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM posts WHERE user_id = $1'),
        [mockUserId, 10, 5]
      );
      expect(result).toEqual(mockPosts);
    });

    it('should use default pagination values', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await PostModel.findByUserId(mockUserId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM posts WHERE user_id = $1'),
        [mockUserId, 50, 0]
      );
    });
  });

  describe('findByStatus', () => {
    it('should find posts by status', async () => {
      const mockPosts = [mockPostRow];
      mockDb.query.mockResolvedValue({ rows: mockPosts } as any);

      const result = await PostModel.findByStatus(PostStatus.DRAFT, 25);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM posts WHERE status = $1'),
        [PostStatus.DRAFT, 25]
      );
      expect(result).toEqual(mockPosts);
    });
  });

  describe('findScheduledPosts', () => {
    it('should find scheduled posts without time filter', async () => {
      const mockPosts = [mockPostRow];
      mockDb.query.mockResolvedValue({ rows: mockPosts } as any);

      const result = await PostModel.findScheduledPosts();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1 AND scheduled_time IS NOT NULL'),
        [PostStatus.SCHEDULED]
      );
      expect(result).toEqual(mockPosts);
    });

    it('should find scheduled posts before specific time', async () => {
      const beforeTime = new Date();
      const mockPosts = [mockPostRow];
      mockDb.query.mockResolvedValue({ rows: mockPosts } as any);

      const result = await PostModel.findScheduledPosts(beforeTime);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND scheduled_time <= $2'),
        [PostStatus.SCHEDULED, beforeTime]
      );
      expect(result).toEqual(mockPosts);
    });
  });

  describe('findByUserAndStatus', () => {
    it('should find posts by user and status', async () => {
      const mockPosts = [mockPostRow];
      mockDb.query.mockResolvedValue({ rows: mockPosts } as any);

      const result = await PostModel.findByUserAndStatus(mockUserId, PostStatus.DRAFT);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND status = $2'),
        [mockUserId, PostStatus.DRAFT]
      );
      expect(result).toEqual(mockPosts);
    });
  });

  describe('findBySource', () => {
    it('should find posts by source', async () => {
      const mockPosts = [mockPostRow];
      mockDb.query.mockResolvedValue({ rows: mockPosts } as any);

      const result = await PostModel.findBySource(PostSource.BLOGGER, 25);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE source = $1'),
        [PostSource.BLOGGER, 25]
      );
      expect(result).toEqual(mockPosts);
    });
  });

  describe('update', () => {
    it('should update post with provided fields', async () => {
      const updateInput = {
        content: 'Updated content',
        hashtags: ['updated'],
        status: PostStatus.PUBLISHED
      };

      const updatedPost = { ...mockPostRow, ...updateInput };
      mockDb.query.mockResolvedValue({ rows: [updatedPost] } as any);

      const result = await PostModel.update(mockPostId, updateInput);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE posts SET'),
        expect.arrayContaining([
          updateInput.content,
          updateInput.hashtags,
          updateInput.status,
          mockPostId
        ])
      );
      expect(result).toEqual(updatedPost);
    });

    it('should return existing post when no updates provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockPostRow] } as any);

      const result = await PostModel.update(mockPostId, {});

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM posts WHERE id = $1',
        [mockPostId]
      );
      expect(result).toEqual(mockPostRow);
    });

    it('should return null when post not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await PostModel.update(mockPostId, { content: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update post status', async () => {
      const updatedPost = { ...mockPostRow, status: PostStatus.PUBLISHED };
      mockDb.query.mockResolvedValue({ rows: [updatedPost] } as any);

      const result = await PostModel.updateStatus(mockPostId, PostStatus.PUBLISHED);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE posts SET status = $1'),
        [PostStatus.PUBLISHED, mockPostId]
      );
      expect(result).toEqual(updatedPost);
    });

    it('should return null when post not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await PostModel.updateStatus(mockPostId, PostStatus.PUBLISHED);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a post and return true', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      const result = await PostModel.delete(mockPostId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM posts WHERE id = $1',
        [mockPostId]
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      const result = await PostModel.delete(mockPostId);

      expect(result).toBe(false);
    });

    it('should return false when rowCount is null', async () => {
      mockDb.query.mockResolvedValue({ rowCount: null } as any);

      const result = await PostModel.delete(mockPostId);

      expect(result).toBe(false);
    });
  });

  describe('getPostStats', () => {
    it('should return post statistics for user', async () => {
      const mockStatsRow = {
        total: '10',
        draft: '3',
        scheduled: '2',
        published: '4',
        failed: '1'
      };

      mockDb.query.mockResolvedValue({ rows: [mockStatsRow] } as any);

      const result = await PostModel.getPostStats(mockUserId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total'),
        [mockUserId]
      );
      expect(result).toEqual({
        total: 10,
        draft: 3,
        scheduled: 2,
        published: 4,
        failed: 1
      });
    });
  });
});