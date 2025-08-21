import { db } from '../database/connection';
import { 
  PlatformPostRow, 
  CreatePlatformPostInput, 
  UpdatePlatformPostInput,
  PostStatus,
  Platform 
} from '../types/database';

export class PlatformPostModel {
  static async create(input: CreatePlatformPostInput): Promise<PlatformPostRow> {
    const query = `
      INSERT INTO platform_posts (post_id, platform, content, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (post_id, platform) 
      DO UPDATE SET
        content = EXCLUDED.content,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      input.post_id,
      input.platform,
      input.content,
      input.status || PostStatus.DRAFT
    ];

    const result = await db.query<PlatformPostRow>(query, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<PlatformPostRow | null> {
    const query = 'SELECT * FROM platform_posts WHERE id = $1';
    const result = await db.query<PlatformPostRow>(query, [id]);
    return result.rows[0] || null;
  }

  static async findByPostId(postId: string): Promise<PlatformPostRow[]> {
    const query = 'SELECT * FROM platform_posts WHERE post_id = $1 ORDER BY created_at ASC';
    const result = await db.query<PlatformPostRow>(query, [postId]);
    return result.rows;
  }

  static async findByPostAndPlatform(postId: string, platform: Platform): Promise<PlatformPostRow | null> {
    const query = 'SELECT * FROM platform_posts WHERE post_id = $1 AND platform = $2';
    const result = await db.query<PlatformPostRow>(query, [postId, platform]);
    return result.rows[0] || null;
  }

  static async findByStatus(status: PostStatus, limit: number = 100): Promise<PlatformPostRow[]> {
    const query = `
      SELECT * FROM platform_posts 
      WHERE status = $1 
      ORDER BY created_at ASC 
      LIMIT $2
    `;
    const result = await db.query<PlatformPostRow>(query, [status, limit]);
    return result.rows;
  }

  static async findByPlatform(platform: Platform, limit: number = 50): Promise<PlatformPostRow[]> {
    const query = `
      SELECT * FROM platform_posts 
      WHERE platform = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await db.query<PlatformPostRow>(query, [platform, limit]);
    return result.rows;
  }

  static async findFailedPosts(maxRetries: number = 3): Promise<PlatformPostRow[]> {
    const query = `
      SELECT * FROM platform_posts 
      WHERE status = $1 AND retry_count < $2 
      ORDER BY created_at ASC
    `;
    const result = await db.query<PlatformPostRow>(query, [PostStatus.FAILED, maxRetries]);
    return result.rows;
  }

  static async update(id: string, input: UpdatePlatformPostInput): Promise<PlatformPostRow | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.platform_post_id !== undefined) {
      updates.push(`platform_post_id = $${paramCount++}`);
      values.push(input.platform_post_id);
    }
    if (input.content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(input.content);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(input.status);
    }
    if (input.published_at !== undefined) {
      updates.push(`published_at = $${paramCount++}`);
      values.push(input.published_at);
    }
    if (input.error !== undefined) {
      updates.push(`error = $${paramCount++}`);
      values.push(input.error);
    }
    if (input.retry_count !== undefined) {
      updates.push(`retry_count = $${paramCount++}`);
      values.push(input.retry_count);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE platform_posts 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await db.query<PlatformPostRow>(query, values);
    return result.rows[0] || null;
  }

  static async updateStatus(id: string, status: PostStatus, error?: string): Promise<PlatformPostRow | null> {
    const query = `
      UPDATE platform_posts 
      SET status = $1, error = $2, published_at = CASE WHEN $1 = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query<PlatformPostRow>(query, [status, error || null, id]);
    return result.rows[0] || null;
  }

  static async incrementRetryCount(id: string): Promise<PlatformPostRow | null> {
    const query = `
      UPDATE platform_posts 
      SET retry_count = retry_count + 1
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query<PlatformPostRow>(query, [id]);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM platform_posts WHERE id = $1';
    const result = await db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  static async deleteByPostId(postId: string): Promise<number> {
    const query = 'DELETE FROM platform_posts WHERE post_id = $1';
    const result = await db.query(query, [postId]);
    return result.rowCount || 0;
  }

  static async getPlatformStats(platform: Platform): Promise<{
    total: number;
    published: number;
    failed: number;
    pending: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status IN ('draft', 'scheduled', 'publishing')) as pending
      FROM platform_posts 
      WHERE platform = $1
    `;
    const result = await db.query(query, [platform]);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      published: parseInt(row.published),
      failed: parseInt(row.failed),
      pending: parseInt(row.pending)
    };
  }
}