import { db } from '../database/connection';
import { 
  PlatformConnectionRow, 
  CreatePlatformConnectionInput, 
  UpdatePlatformConnectionInput,
  Platform 
} from '../types/database';

export class PlatformConnectionModel {
  static async create(input: CreatePlatformConnectionInput): Promise<PlatformConnectionRow> {
    const query = `
      INSERT INTO platform_connections (
        user_id, platform, platform_user_id, platform_username, 
        access_token, refresh_token, token_expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, platform) 
      DO UPDATE SET
        platform_user_id = EXCLUDED.platform_user_id,
        platform_username = EXCLUDED.platform_username,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.platform,
      input.platform_user_id,
      input.platform_username,
      input.access_token,
      input.refresh_token || null,
      input.token_expires_at || null
    ];

    const result = await db.query<PlatformConnectionRow>(query, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<PlatformConnectionRow | null> {
    const query = 'SELECT * FROM platform_connections WHERE id = $1';
    const result = await db.query<PlatformConnectionRow>(query, [id]);
    return result.rows[0] || null;
  }

  static async findByUserAndPlatform(userId: string, platform: Platform): Promise<PlatformConnectionRow | null> {
    const query = 'SELECT * FROM platform_connections WHERE user_id = $1 AND platform = $2';
    const result = await db.query<PlatformConnectionRow>(query, [userId, platform]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: string): Promise<PlatformConnectionRow[]> {
    const query = 'SELECT * FROM platform_connections WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await db.query<PlatformConnectionRow>(query, [userId]);
    return result.rows;
  }

  static async findActiveByUserId(userId: string): Promise<PlatformConnectionRow[]> {
    const query = `
      SELECT * FROM platform_connections 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY created_at DESC
    `;
    const result = await db.query<PlatformConnectionRow>(query, [userId]);
    return result.rows;
  }

  static async update(id: string, input: UpdatePlatformConnectionInput): Promise<PlatformConnectionRow | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.platform_user_id !== undefined) {
      updates.push(`platform_user_id = $${paramCount++}`);
      values.push(input.platform_user_id);
    }
    if (input.platform_username !== undefined) {
      updates.push(`platform_username = $${paramCount++}`);
      values.push(input.platform_username);
    }
    if (input.access_token !== undefined) {
      updates.push(`access_token = $${paramCount++}`);
      values.push(input.access_token);
    }
    if (input.refresh_token !== undefined) {
      updates.push(`refresh_token = $${paramCount++}`);
      values.push(input.refresh_token);
    }
    if (input.token_expires_at !== undefined) {
      updates.push(`token_expires_at = $${paramCount++}`);
      values.push(input.token_expires_at);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE platform_connections 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await db.query<PlatformConnectionRow>(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM platform_connections WHERE id = $1';
    const result = await db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  static async deactivate(id: string): Promise<PlatformConnectionRow | null> {
    const query = `
      UPDATE platform_connections 
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query<PlatformConnectionRow>(query, [id]);
    return result.rows[0] || null;
  }

  static async findExpiringSoon(hoursFromNow: number = 24): Promise<PlatformConnectionRow[]> {
    const query = `
      SELECT * FROM platform_connections 
      WHERE is_active = true 
        AND token_expires_at IS NOT NULL 
        AND token_expires_at <= NOW() + INTERVAL '${hoursFromNow} hours'
      ORDER BY token_expires_at ASC
    `;
    const result = await db.query<PlatformConnectionRow>(query);
    return result.rows;
  }
}