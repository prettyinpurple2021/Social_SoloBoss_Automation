import { db } from '../database';
import { BloggerIntegrationSettings } from '../types/blogger';

export interface BloggerIntegrationRow {
  id: string;
  user_id: string;
  blog_url: string;
  rss_feed_url: string;
  auto_approve: boolean;
  default_platforms: string[];
  custom_hashtags: string[];
  enabled: boolean;
  last_checked?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBloggerIntegrationInput {
  user_id: string;
  blog_url: string;
  rss_feed_url: string;
  auto_approve?: boolean;
  default_platforms?: string[];
  custom_hashtags?: string[];
  enabled?: boolean;
}

export interface UpdateBloggerIntegrationInput {
  blog_url?: string;
  rss_feed_url?: string;
  auto_approve?: boolean;
  default_platforms?: string[];
  custom_hashtags?: string[];
  enabled?: boolean;
  last_checked?: Date;
}

export class BloggerIntegrationModel {
  /**
   * Create a new blogger integration
   */
  static async create(input: CreateBloggerIntegrationInput): Promise<BloggerIntegrationRow> {
    const query = `
      INSERT INTO blogger_integrations (
        user_id, blog_url, rss_feed_url, auto_approve, 
        default_platforms, custom_hashtags, enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.blog_url,
      input.rss_feed_url,
      input.auto_approve ?? false,
      input.default_platforms ?? [],
      input.custom_hashtags ?? [],
      input.enabled ?? true
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Find blogger integration by user ID
   */
  static async findByUserId(userId: string): Promise<BloggerIntegrationRow | null> {
    const query = 'SELECT * FROM blogger_integrations WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Find blogger integration by ID
   */
  static async findById(id: string): Promise<BloggerIntegrationRow | null> {
    const query = 'SELECT * FROM blogger_integrations WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Update blogger integration
   */
  static async update(id: string, input: UpdateBloggerIntegrationInput): Promise<BloggerIntegrationRow | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.blog_url !== undefined) {
      fields.push(`blog_url = $${paramCount++}`);
      values.push(input.blog_url);
    }

    if (input.rss_feed_url !== undefined) {
      fields.push(`rss_feed_url = $${paramCount++}`);
      values.push(input.rss_feed_url);
    }

    if (input.auto_approve !== undefined) {
      fields.push(`auto_approve = $${paramCount++}`);
      values.push(input.auto_approve);
    }

    if (input.default_platforms !== undefined) {
      fields.push(`default_platforms = $${paramCount++}`);
      values.push(input.default_platforms);
    }

    if (input.custom_hashtags !== undefined) {
      fields.push(`custom_hashtags = $${paramCount++}`);
      values.push(input.custom_hashtags);
    }

    if (input.enabled !== undefined) {
      fields.push(`enabled = $${paramCount++}`);
      values.push(input.enabled);
    }

    if (input.last_checked !== undefined) {
      fields.push(`last_checked = $${paramCount++}`);
      values.push(input.last_checked);
    }

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = $${paramCount++}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE blogger_integrations 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete blogger integration
   */
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM blogger_integrations WHERE id = $1';
    const result = await db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get all active blogger integrations for monitoring
   */
  static async findActiveIntegrations(): Promise<BloggerIntegrationRow[]> {
    const query = 'SELECT * FROM blogger_integrations WHERE enabled = true ORDER BY last_checked ASC NULLS FIRST';
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Update last checked timestamp
   */
  static async updateLastChecked(id: string, timestamp: Date): Promise<void> {
    const query = 'UPDATE blogger_integrations SET last_checked = $1, updated_at = $2 WHERE id = $3';
    await db.query(query, [timestamp, new Date(), id]);
  }
}