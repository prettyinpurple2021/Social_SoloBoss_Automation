import { db } from '../database/connection';
import { 
  PostRow, 
  CreatePostInput, 
  UpdatePostInput,
  PostStatus,
  PostSource,
  Platform 
} from '../types/database';

export class PostModel {
  static async create(input: CreatePostInput): Promise<PostRow> {
    const query = `
      INSERT INTO posts (
        user_id, content, images, hashtags, platforms, 
        scheduled_time, status, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.content,
      input.images || [],
      input.hashtags || [],
      input.platforms,
      input.scheduled_time || null,
      input.status || PostStatus.DRAFT,
      input.source || PostSource.MANUAL
    ];

    const result = await db.query<PostRow>(query, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<PostRow | null> {
    const query = 'SELECT * FROM posts WHERE id = $1';
    const result = await db.query<PostRow>(query, [id]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<PostRow[]> {
    const query = `
      SELECT * FROM posts 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await db.query<PostRow>(query, [userId, limit, offset]);
    return result.rows;
  }

  static async findByStatus(status: PostStatus, limit: number = 100): Promise<PostRow[]> {
    const query = `
      SELECT * FROM posts 
      WHERE status = $1 
      ORDER BY scheduled_time ASC, created_at ASC 
      LIMIT $2
    `;
    const result = await db.query<PostRow>(query, [status, limit]);
    return result.rows;
  }

  static async findScheduledPosts(beforeTime?: Date): Promise<PostRow[]> {
    let query = `
      SELECT * FROM posts 
      WHERE status = $1 
        AND scheduled_time IS NOT NULL
    `;
    const values: any[] = [PostStatus.SCHEDULED];

    if (beforeTime) {
      query += ' AND scheduled_time <= $2';
      values.push(beforeTime);
    }

    query += ' ORDER BY scheduled_time ASC';

    const result = await db.query<PostRow>(query, values);
    return result.rows;
  }

  static async findByUserAndStatus(userId: string, status: PostStatus): Promise<PostRow[]> {
    const query = `
      SELECT * FROM posts 
      WHERE user_id = $1 AND status = $2 
      ORDER BY created_at DESC
    `;
    const result = await db.query<PostRow>(query, [userId, status]);
    return result.rows;
  }

  static async findByUserSourceAndStatus(userId: string, source: PostSource, status?: PostStatus): Promise<PostRow[]> {
    let query = `
      SELECT * FROM posts 
      WHERE user_id = $1 AND source = $2
    `;
    const values: any[] = [userId, source];

    if (status) {
      query += ' AND status = $3';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query<PostRow>(query, values);
    return result.rows;
  }

  static async findBySource(source: PostSource, limit: number = 50): Promise<PostRow[]> {
    const query = `
      SELECT * FROM posts 
      WHERE source = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await db.query<PostRow>(query, [source, limit]);
    return result.rows;
  }

  static async update(id: string, input: UpdatePostInput): Promise<PostRow | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(input.content);
    }
    if (input.images !== undefined) {
      updates.push(`images = $${paramCount++}`);
      values.push(input.images);
    }
    if (input.hashtags !== undefined) {
      updates.push(`hashtags = $${paramCount++}`);
      values.push(input.hashtags);
    }
    if (input.platforms !== undefined) {
      updates.push(`platforms = $${paramCount++}`);
      values.push(input.platforms);
    }
    if (input.scheduled_time !== undefined) {
      updates.push(`scheduled_time = $${paramCount++}`);
      values.push(input.scheduled_time);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(input.status);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE posts 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await db.query<PostRow>(query, values);
    return result.rows[0] || null;
  }

  static async updateStatus(id: string, status: PostStatus): Promise<PostRow | null> {
    const query = `
      UPDATE posts 
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query<PostRow>(query, [status, id]);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM posts WHERE id = $1';
    const result = await db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  static async getPostStats(userId: string): Promise<{
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    failed: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM posts 
      WHERE user_id = $1
    `;
    const result = await db.query(query, [userId]);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      draft: parseInt(row.draft),
      scheduled: parseInt(row.scheduled),
      published: parseInt(row.published),
      failed: parseInt(row.failed)
    };
  }
}